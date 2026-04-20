#!/usr/bin/env node
import {
  buildDependencyGraph,
  getCriticalPath,
  getExecutionWaves,
  loadConfig,
  parseRoadmap,
  resolveNextUnblocked,
  runReconcileCheck,
  runReconcileFix,
  runReconcilePlan
} from "./chunk-HTESMSFS.js";

// src/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z as z2 } from "zod";
import { existsSync as existsSync3, readFileSync as readFileSync3 } from "fs";
import path2 from "path";
import { fileURLToPath, pathToFileURL } from "url";

// src/mcp/codegraph-client.ts
import { existsSync, readdirSync, readFileSync } from "fs";
import { join, relative, extname, basename } from "path";
import { spawnSync } from "child_process";
function checkCodegraph(projectDir) {
  const dbPath = join(projectDir, ".codegraph", "graph.db");
  if (existsSync(dbPath)) {
    return { available: true, dbPath };
  }
  return { available: false, reason: "CodeGraph database not found at .codegraph/graph.db" };
}
function walkMdFiles(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkMdFiles(full));
      } else if (entry.isFile() && extname(entry.name) === ".md") {
        results.push(full);
      }
    }
  } catch {
  }
  return results;
}
function findSymbolInDocs(knowledgeRoot, symbolName) {
  const docs = walkMdFiles(knowledgeRoot);
  const matches = [];
  for (const doc of docs) {
    try {
      const content = readFileSync(doc, "utf8");
      if (content.includes(symbolName)) {
        matches.push(relative(knowledgeRoot, doc));
      }
    } catch {
    }
  }
  return matches;
}
function degradedImpact(repoPath, changedFiles) {
  const knowledgeRoot = join(repoPath, "Knowledge");
  if (!existsSync(knowledgeRoot)) {
    return {
      degraded: true,
      affectedDocs: [],
      reason: "Knowledge directory not found"
    };
  }
  const affectedDocs = [];
  for (const file of changedFiles) {
    const parts = file.split("/");
    const moduleName = basename(file, extname(file));
    const dirName = parts.length > 1 ? parts[parts.length - 2] : "";
    const byName = findSymbolInDocs(knowledgeRoot, moduleName);
    const byDir = dirName ? findSymbolInDocs(knowledgeRoot, dirName) : [];
    const allMatches = [.../* @__PURE__ */ new Set([...byName, ...byDir])];
    for (const doc of allMatches) {
      affectedDocs.push({
        doc,
        reason: `References "${moduleName}" or "${dirName}" from changed file ${file}`,
        confidence: "low"
      });
    }
  }
  return {
    degraded: true,
    affectedDocs,
    reason: "CodeGraph not available \u2014 using path/name heuristics"
  };
}

// src/mcp/roadmap-tools.ts
import { appendFileSync, existsSync as existsSync2, readFileSync as readFileSync2, writeFileSync } from "fs";
import { homedir } from "os";
import path from "path";
import { parseDocument } from "yaml";
import { z } from "zod";
var sqliteModulePromise = null;
async function loadSqliteModule() {
  if (!sqliteModulePromise) {
    sqliteModulePromise = import("sqlite");
  }
  return sqliteModulePromise;
}
function textResponse(text, data) {
  return {
    content: [{ type: "text", text }],
    structuredContent: data ?? {}
  };
}
var DISCOVERY_INBOX_SQL = `
CREATE TABLE IF NOT EXISTS discovery_inbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  source_type TEXT NOT NULL
    CHECK(source_type IN ('workshop', 'retrospective', 'rule', 'agent', 'manual')),
  category TEXT NOT NULL
    CHECK(category IN ('bug', 'tech_debt', 'improvement', 'feature', 'risk')),
  priority TEXT NOT NULL DEFAULT 'insight'
    CHECK(priority IN ('blocker', 'insight', 'request')),
  title TEXT NOT NULL,
  description TEXT,
  affected_module TEXT,
  proposed_action TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'triaged', 'accepted', 'dismissed')),
  roadmap_phase_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  triaged_at TEXT,
  triaged_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_discovery_inbox_status
  ON discovery_inbox(status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_inbox_source
  ON discovery_inbox(source_type, source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_inbox_category
  ON discovery_inbox(category, status, created_at DESC);
`;
function safeHandler(fn) {
  return async (args) => {
    try {
      return await fn(args);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return textResponse(`Error: ${msg}`, { error: msg });
    }
  };
}
function resolveAiSessionsHome() {
  return path.resolve(process.env.AI_SESSIONS_HOME ?? path.join(homedir(), ".ai-sessions"));
}
function resolveAiSessionsSpoolFile() {
  return path.join(homedir(), ".ai-sessions", "spool", "events.jsonl");
}
async function openDiscoveryInboxDb() {
  const aiSessionsHome = resolveAiSessionsHome();
  const dbPath = path.join(aiSessionsHome, "sessions.db");
  if (!existsSync2(dbPath)) {
    throw new Error(`ai-sessions database not found at ${dbPath}`);
  }
  const { DatabaseSync } = await loadSqliteModule();
  const rawDb = new DatabaseSync(dbPath, { open: true, readOnly: false });
  const db = {
    exec: (sql) => {
      rawDb.exec(sql);
    },
    prepare: (sql) => {
      const stmt = rawDb.prepare(sql);
      return {
        run: (...params) => stmt.run(...params),
        get: (...params) => stmt.get(...params),
        all: (...params) => stmt.all(...params)
      };
    },
    close: () => {
      rawDb.close();
    }
  };
  db.exec(DISCOVERY_INBOX_SQL);
  return db;
}
function resolveProjectDir(repoPath, defaultProjectDir) {
  return path.resolve(repoPath ?? defaultProjectDir);
}
function resolveKnowledgeRoot(projectDir) {
  return loadConfig(projectDir)?.root ?? "Knowledge";
}
function resolveRoadmapDir(repoPath, defaultProjectDir) {
  const projectDir = resolveProjectDir(repoPath, defaultProjectDir);
  return path.join(projectDir, resolveKnowledgeRoot(projectDir), "Roadmap");
}
function getPhaseHorizon(phase) {
  if (phase.horizon) return phase.horizon;
  if (phase.status === "in_progress") return "now";
  return "next";
}
function inferEffortFromSize(size) {
  const normalized = size.trim().toLowerCase();
  if (normalized.startsWith("small")) return "S";
  if (normalized.startsWith("medium")) return "M";
  if (normalized.startsWith("large")) return "L";
  if (normalized.startsWith("xl") || normalized.startsWith("extra large")) return "XL";
  return null;
}
function getReadyEffort(phase, subPhase) {
  return phase.estimatedEffort ?? inferEffortFromSize(subPhase.size);
}
function getPhaseAcceptanceCriteria(phase) {
  if ((phase.acceptanceCriteria ?? []).length > 0) {
    return [...new Set(phase.acceptanceCriteria ?? [])];
  }
  return [
    ...new Set(
      phase.subPhases.flatMap((subPhase) => subPhase.acceptanceCriteria).filter(Boolean)
    )
  ];
}
function getPhaseDependencies(phase) {
  return [
    ...new Set([
      ...phase.dependsOn,
      ...phase.subPhases.flatMap((subPhase) => subPhase.blockedBy)
    ].filter(Boolean))
  ];
}
function getPrimaryModulePath(phase) {
  const modulePaths = [...new Set(phase.subPhases.map((subPhase) => subPhase.modulePath).filter(Boolean))];
  return modulePaths[0] ?? "";
}
function serializeGraph(graph) {
  return {
    nodes: [...graph.nodes.entries()].map(([id, node]) => ({
      id,
      type: "subPhases" in node ? "phase" : "sub-phase",
      name: node.name,
      status: node.status,
      path: node.path
    })),
    edges: [...graph.edges.entries()].flatMap(
      ([to, dependencies]) => dependencies.map((from) => ({ from, to }))
    )
  };
}
function appendEvidence(body, evidence) {
  const trimmedBody = body.trimEnd();
  const line = `- ${(/* @__PURE__ */ new Date()).toISOString()}: ${evidence}`;
  if (!trimmedBody) {
    return `## Status Evidence
${line}
`;
  }
  const sectionPattern = /^## Status Evidence[^\n]*\n([\s\S]*?)(?=^## |\Z)/m;
  const match = sectionPattern.exec(trimmedBody);
  if (match) {
    const sectionStart = match.index;
    const sectionEnd = sectionStart + match[0].length;
    const sectionBody = match[1].replace(/\n*$/, "");
    const nextSection = trimmedBody.slice(sectionEnd);
    const updatedSection = `## Status Evidence
${sectionBody ? `${sectionBody}
` : ""}${line}
`;
    return `${trimmedBody.slice(0, sectionStart)}${updatedSection}${nextSection}`;
  }
  return `${trimmedBody}

## Status Evidence
${line}
`;
}
function summarizePhaseStatus(subPhases) {
  if (subPhases.length === 0) {
    return "pending";
  }
  if (subPhases.every((subPhase) => subPhase.status === "completed")) {
    return "completed";
  }
  if (subPhases.every((subPhase) => subPhase.status === "completed" || subPhase.status === "completed_with_notes")) {
    return "completed_with_notes";
  }
  if (subPhases.some((subPhase) => subPhase.status === "blocked")) {
    return "blocked";
  }
  if (subPhases.some((subPhase) => subPhase.status === "in_progress")) {
    return "in_progress";
  }
  return "pending";
}
function updatePhaseLifecycleFields(document, status) {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (status === "in_progress" && !document.get("started_at")) {
    document.set("started_at", today);
  }
  if ((status === "completed" || status === "completed_with_notes") && !document.get("completed_at")) {
    document.set("completed_at", today);
  }
}
function readMarkdownDocument(filePath) {
  const content = readFileSync2(filePath, "utf8");
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    throw new Error(`No frontmatter found in ${filePath}`);
  }
  const document = parseDocument(match[1]);
  if (document.errors.length > 0) {
    throw document.errors[0];
  }
  return {
    document,
    body: content.slice(match[0].length)
  };
}
function writeMarkdownDocument(filePath, document, body) {
  const frontmatter = document.toString({ lineWidth: 120 }).trimEnd();
  const normalizedBody = body.replace(/^\n+/, "");
  const nextContent = normalizedBody.length > 0 ? `---
${frontmatter}
---
${normalizedBody}` : `---
${frontmatter}
---
`;
  writeFileSync(filePath, nextContent, "utf8");
}
function findRoadmapItem(phases, itemId) {
  for (const phase of phases) {
    if (phase.id === itemId) {
      return {
        phase,
        filePath: phase.path,
        previousStatus: phase.status
      };
    }
    const subPhase = phase.subPhases.find((candidate) => candidate.id === itemId);
    if (subPhase) {
      return {
        phase,
        subPhase,
        filePath: subPhase.path,
        previousStatus: subPhase.status
      };
    }
  }
  throw new Error(`Roadmap item not found: ${itemId}`);
}
async function emitRoadmapStatusChange(eventData) {
  try {
    const spoolFile = resolveAiSessionsSpoolFile();
    const spoolDir = path.dirname(spoolFile);
    if (!existsSync2(spoolDir)) {
      return;
    }
    const timestamp = typeof eventData.timestamp === "string" ? eventData.timestamp : (/* @__PURE__ */ new Date()).toISOString();
    const payload = { ...eventData, timestamp };
    appendFileSync(spoolFile, `${JSON.stringify({
      type: "roadmap.status_change",
      data: payload,
      timestamp,
      event_type: "roadmap.status_change",
      event_data: payload,
      source: process.env.CLAUDE_SESSION_ID ? "mcp:kdoc" : "kdoc-cli",
      session_id: process.env.CLAUDE_SESSION_ID ?? "cli",
      event_class: "record",
      created_at: timestamp
    })}
`);
  } catch {
  }
}
async function handleRoadmapScan(args, defaultProjectDir) {
  const roadmapDir = resolveRoadmapDir(args.repo_path, defaultProjectDir);
  const phases = parseRoadmap(roadmapDir);
  const graph = buildDependencyGraph(phases);
  const waves = getExecutionWaves(graph);
  const criticalPath = getCriticalPath(graph);
  const subPhaseCount = phases.reduce((total, phase) => total + phase.subPhases.length, 0);
  return textResponse(
    `Roadmap scan: ${phases.length} phase(s), ${subPhaseCount} sub-phase(s), ${waves.length} wave(s).`,
    {
      phases,
      dependency_graph: serializeGraph(graph),
      waves,
      critical_path: criticalPath
    }
  );
}
async function handleRoadmapNextReady(args, defaultProjectDir) {
  const roadmapDir = resolveRoadmapDir(args.repo_path, defaultProjectDir);
  const readyItems = resolveNextUnblocked(roadmapDir).map((result) => ({
    id: result.subPhase.id,
    name: result.subPhase.name,
    phase: result.phase.id,
    status: result.subPhase.status,
    horizon: getPhaseHorizon(result.phase),
    effort: getReadyEffort(result.phase, result.subPhase),
    acceptance_criteria: result.subPhase.acceptanceCriteria.length > 0 ? result.subPhase.acceptanceCriteria : getPhaseAcceptanceCriteria(result.phase),
    module_path: result.subPhase.modulePath
  })).filter((item) => !args.horizon || item.horizon === args.horizon);
  return textResponse(
    `Roadmap next ready: ${readyItems.length} item(s).`,
    { ready_items: readyItems }
  );
}
async function handleRoadmapPhaseDetail(args, defaultProjectDir) {
  const roadmapDir = resolveRoadmapDir(args.repo_path, defaultProjectDir);
  const phase = parseRoadmap(roadmapDir).find((candidate) => candidate.id === args.phase_id);
  if (!phase) {
    throw new Error(`Phase not found: ${args.phase_id}`);
  }
  return textResponse(
    `Roadmap phase detail: ${phase.id} (${phase.subPhases.length} sub-phase(s)).`,
    {
      phase,
      sub_phases: phase.subPhases,
      acceptance_criteria: getPhaseAcceptanceCriteria(phase),
      dependencies: getPhaseDependencies(phase),
      module_path: getPrimaryModulePath(phase)
    }
  );
}
async function handleRoadmapUpdateStatus(args, defaultProjectDir) {
  const projectDir = resolveProjectDir(args.repo_path, defaultProjectDir);
  const roadmapDir = resolveRoadmapDir(args.repo_path, defaultProjectDir);
  const phases = parseRoadmap(roadmapDir);
  const item = findRoadmapItem(phases, args.phase_id);
  const { document, body } = readMarkdownDocument(item.filePath);
  const previousStatus = String(document.get("status") ?? item.previousStatus ?? "");
  document.set("status", args.status);
  if (!item.subPhase) {
    updatePhaseLifecycleFields(document, args.status);
  }
  writeMarkdownDocument(
    item.filePath,
    document,
    args.evidence ? appendEvidence(body, args.evidence) : body
  );
  let parentPhaseStatus = item.subPhase ? void 0 : args.status;
  if (item.subPhase) {
    const refreshedPhase = parseRoadmap(roadmapDir).find((phase) => phase.id === item.phase.id);
    if (refreshedPhase) {
      const aggregatedStatus = summarizePhaseStatus(refreshedPhase.subPhases);
      parentPhaseStatus = aggregatedStatus;
      if (aggregatedStatus !== refreshedPhase.status) {
        const { document: phaseDocument, body: phaseBody } = readMarkdownDocument(refreshedPhase.path);
        phaseDocument.set("status", aggregatedStatus);
        updatePhaseLifecycleFields(phaseDocument, aggregatedStatus);
        writeMarkdownDocument(refreshedPhase.path, phaseDocument, phaseBody);
      }
    }
  }
  await emitRoadmapStatusChange({
    phase_id: args.phase_id,
    parent_phase: item.phase.id,
    old_status: previousStatus,
    previous_status: previousStatus,
    new_status: args.status,
    parent_phase_status: parentPhaseStatus,
    evidence: args.evidence,
    repo_path: projectDir,
    file_path: item.filePath,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  return textResponse(
    `Roadmap status updated: ${args.phase_id} ${previousStatus || "unknown"} -> ${args.status}.`,
    {
      success: true,
      previous_status: previousStatus,
      new_status: args.status,
      parent_phase_status: parentPhaseStatus
    }
  );
}
async function handleRoadmapIntakeAdd(args) {
  const db = await openDiscoveryInboxDb();
  try {
    const duplicate = db.prepare(`
      SELECT *
      FROM discovery_inbox
      WHERE source = ?
        AND source_type = ?
        AND title = ?
        AND status IN ('pending', 'triaged', 'accepted')
      ORDER BY id DESC
      LIMIT 1
    `).get(args.source, args.source_type, args.title);
    const item = duplicate ?? (() => {
      const result = db.prepare(`
        INSERT INTO discovery_inbox (
          source,
          source_type,
          category,
          priority,
          title,
          description,
          affected_module,
          proposed_action
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        args.source,
        args.source_type,
        args.category,
        args.priority ?? "insight",
        args.title,
        args.description ?? null,
        args.affected_module ?? null,
        args.proposed_action ?? null
      );
      if (result.lastInsertRowid == null) {
        throw new Error("Failed to resolve discovery inbox row id after insert.");
      }
      return db.prepare("SELECT * FROM discovery_inbox WHERE id = ?").get(result.lastInsertRowid);
    })();
    if (!item) {
      throw new Error("Failed to load discovery inbox item after insert.");
    }
    return textResponse(
      duplicate ? `Discovery inbox item already exists: #${item.id} ${item.title}` : `Created discovery inbox item #${item.id} ${item.title}`,
      {
        success: true,
        created: !duplicate,
        item
      }
    );
  } finally {
    db.close();
  }
}
async function handleRoadmapIntakeList(args) {
  const db = await openDiscoveryInboxDb();
  try {
    const conditions = [];
    const params = [];
    if (args.status) {
      conditions.push("status = ?");
      params.push(args.status);
    }
    if (args.category) {
      conditions.push("category = ?");
      params.push(args.category);
    }
    if (args.priority) {
      conditions.push("priority = ?");
      params.push(args.priority);
    }
    if (args.source_type) {
      conditions.push("source_type = ?");
      params.push(args.source_type);
    }
    params.push(Math.max(1, Math.min(args.limit ?? 25, 200)));
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const items = db.prepare(`
      SELECT *
      FROM discovery_inbox
      ${whereClause}
      ORDER BY
        CASE priority
          WHEN 'blocker' THEN 0
          WHEN 'request' THEN 1
          ELSE 2
        END ASC,
        created_at DESC,
        id DESC
      LIMIT ?
    `).all(...params);
    return textResponse(`${items.length} discovery inbox item(s)`, {
      count: items.length,
      items
    });
  } finally {
    db.close();
  }
}
function registerRoadmapTools(server, defaultProjectDir) {
  server.registerTool(
    "kdoc_roadmap_scan",
    {
      description: "Scan the roadmap and return structured phase, dependency, wave, and critical-path data.",
      inputSchema: {
        repo_path: z.string().optional().describe("Absolute path to the project root. Defaults to the MCP server project.")
      }
    },
    safeHandler((args) => handleRoadmapScan(args, defaultProjectDir))
  );
  server.registerTool(
    "kdoc_roadmap_next_ready",
    {
      description: "Return roadmap sub-phases that are ready to start because all dependencies are satisfied.",
      inputSchema: {
        repo_path: z.string().optional().describe("Absolute path to the project root. Defaults to the MCP server project."),
        horizon: z.enum(["now", "next", "later"]).optional().describe("Optional horizon filter for ready items.")
      }
    },
    safeHandler((args) => handleRoadmapNextReady(args, defaultProjectDir))
  );
  server.registerTool(
    "kdoc_roadmap_phase_detail",
    {
      description: "Return full detail for a roadmap phase, including sub-phases, dependencies, and acceptance criteria.",
      inputSchema: {
        phase_id: z.string().describe('Phase identifier, for example "phase-2".'),
        repo_path: z.string().optional().describe("Absolute path to the project root. Defaults to the MCP server project.")
      }
    },
    safeHandler((args) => handleRoadmapPhaseDetail(args, defaultProjectDir))
  );
  server.registerTool(
    "kdoc_roadmap_update_status",
    {
      description: "Update the status of a roadmap phase or sub-phase and optionally append evidence to the document body.",
      inputSchema: {
        phase_id: z.string().describe("Roadmap phase or sub-phase identifier."),
        status: z.enum(["pending", "in_progress", "completed", "completed_with_notes", "blocked"]).describe("New roadmap status value."),
        evidence: z.string().optional().describe("Optional evidence string to append to the roadmap document."),
        repo_path: z.string().optional().describe("Absolute path to the project root. Defaults to the MCP server project.")
      }
    },
    safeHandler((args) => handleRoadmapUpdateStatus(args, defaultProjectDir))
  );
  server.registerTool(
    "kdoc_roadmap_intake_add",
    {
      description: "Add a discovery inbox item that can later be triaged into the roadmap.",
      inputSchema: {
        source: z.string().describe("Origin identifier, for example a workshop or rule name."),
        source_type: z.enum(["workshop", "retrospective", "rule", "agent", "manual"]).describe("Origin category for the discovery item."),
        category: z.enum(["bug", "tech_debt", "improvement", "feature", "risk"]).describe("Discovery category."),
        priority: z.enum(["blocker", "insight", "request"]).optional().describe("Inbox priority. Defaults to insight."),
        title: z.string().describe("Short title for the inbox item."),
        description: z.string().optional().describe("Optional detail text."),
        affected_module: z.string().optional().describe("Optional affected module or path."),
        proposed_action: z.string().optional().describe("Optional proposed follow-up.")
      }
    },
    safeHandler((args) => handleRoadmapIntakeAdd(args))
  );
  server.registerTool(
    "kdoc_roadmap_intake_list",
    {
      description: "List discovery inbox items that may feed the roadmap backlog.",
      inputSchema: {
        status: z.enum(["pending", "triaged", "accepted", "dismissed"]).optional().describe("Optional status filter."),
        category: z.enum(["bug", "tech_debt", "improvement", "feature", "risk"]).optional().describe("Optional category filter."),
        priority: z.enum(["blocker", "insight", "request"]).optional().describe("Optional priority filter."),
        source_type: z.enum(["workshop", "retrospective", "rule", "agent", "manual"]).optional().describe("Optional source type filter."),
        limit: z.number().int().optional().default(25).describe("Maximum number of rows to return.")
      }
    },
    safeHandler((args) => handleRoadmapIntakeList(args))
  );
}

// src/mcp/server.ts
var _engineCache = null;
function resolveGovernanceEnginePath() {
  const currentDir = path2.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path2.join(currentDir, "..", "..", "core", "governance-engine.mjs"),
    path2.join(currentDir, "..", "core", "governance-engine.mjs"),
    path2.join(currentDir, "..", "..", "..", "core", "governance-engine.mjs")
  ];
  const enginePath = candidates.find((candidate) => existsSync3(candidate));
  if (!enginePath) {
    throw new Error(
      "Unable to resolve governance-engine.mjs. Searched:\n" + candidates.join("\n")
    );
  }
  return enginePath;
}
async function loadEngine() {
  return await import(pathToFileURL(resolveGovernanceEnginePath()).href);
}
async function cachedEngine() {
  if (!_engineCache) {
    _engineCache = await loadEngine();
  }
  return _engineCache;
}
function textResponse2(text, data) {
  return {
    content: [{ type: "text", text }],
    structuredContent: data ?? {}
  };
}
function safeHandler2(fn) {
  return async (args) => {
    try {
      return await fn(args);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return textResponse2(`Error: ${msg}`, { error: msg });
    }
  };
}
function getPackageVersion() {
  try {
    const pkgPath = path2.resolve(
      path2.dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "package.json"
    );
    return JSON.parse(readFileSync3(pkgPath, "utf-8")).version;
  } catch {
    return "0.0.0";
  }
}
async function handleHealth(args) {
  const engine = await cachedEngine();
  const report = engine.runGovernance(args.repoPath);
  engine.emitDaemonEvent("kdoc.governance_check", {
    healthScore: report.healthScore,
    violationCount: report.violations.length,
    suggestionCount: report.suggestions.length,
    repoPath: args.repoPath
  });
  const summary = `Health: ${report.healthScore}/100 | ${report.violations.length} violation(s) | ${report.suggestions.length} suggestion(s)`;
  return textResponse2(summary, report);
}
async function handleValidate(args) {
  const engine = await cachedEngine();
  const result = engine.validateFile(args.filePath);
  const status = result.valid ? "Valid" : `Invalid: ${result.errors.map((e) => e.message).join("; ")}`;
  return textResponse2(status, result);
}
async function handleCoverage(args) {
  const engine = await cachedEngine();
  const coverage = engine.getCoverage(args.repoPath, args.paths);
  const areas = Object.entries(coverage.byArea).map(([name, data]) => `${name}: ${data.fileCount} files, ${data.complete ? "complete" : "incomplete"}`).join("\n");
  return textResponse2(areas || "No coverage data", coverage);
}
async function handleSuggest(args) {
  const engine = await cachedEngine();
  const report = engine.runGovernance(args.repoPath);
  engine.emitDaemonEvent("kdoc.doc_drift", {
    changedFiles: args.changedFiles ?? [],
    suggestionCount: report.suggestions.length
  });
  const text = report.suggestions.length > 0 ? report.suggestions.map((s) => `[${s.priority}] ${s.type}: ${s.reason}`).join("\n") : "No suggestions \u2014 documentation looks complete.";
  return textResponse2(text, { suggestions: report.suggestions });
}
async function handleSchema(args) {
  const engine = await cachedEngine();
  const schemas = engine.loadSchemas();
  if (args.kind) {
    const typeDef = schemas.frontmatter.types[args.kind];
    if (!typeDef) {
      return textResponse2(`Unknown document kind: ${args.kind}`, { error: `Unknown kind: ${args.kind}` });
    }
    return textResponse2(JSON.stringify(typeDef, null, 2), { kind: args.kind, schema: typeDef });
  }
  return textResponse2(
    `Structure: ${Object.keys(schemas.structure.areas).length} areas
Types: ${Object.keys(schemas.frontmatter.types).join(", ")}`,
    schemas
  );
}
function buildReconcileScope(args) {
  const scope = {
    area: args.area,
    package: args.package,
    path: args.path
  };
  return Object.values(scope).some((value) => typeof value === "string" && value.trim() !== "") ? scope : void 0;
}
function summarizeReconcile(mode, payload) {
  const findings = Array.isArray(payload.findings) ? payload.findings.length : 0;
  const warnings = Array.isArray(payload.warnings) ? payload.warnings.length : 0;
  if (mode === "fix") {
    const repairs = Array.isArray(payload.results) ? payload.results.length : 0;
    const deferredCount = typeof payload.deferredCount === "number" ? payload.deferredCount : 0;
    const clean = payload.clean === true ? "clean" : "remaining findings";
    return `Reconcile fix: ${repairs} repair(s) applied, ${deferredCount} deferred, ${clean}.`;
  }
  if (mode === "plan") {
    return `Reconcile plan: ${findings} finding(s) captured.`;
  }
  return `Reconcile check: ${findings} finding(s), ${warnings} warning(s).`;
}
async function handleReconcile(args) {
  const mode = args.mode ?? "check";
  const scope = buildReconcileScope(args);
  const config = loadConfig(args.repoPath);
  if (!config) {
    return textResponse2("Error: .kdoc.yaml not found. Run `kdoc init` first.", { error: "no config" });
  }
  let result;
  if (mode === "plan") {
    result = await runReconcilePlan(args.repoPath, config, scope);
  } else if (mode === "fix") {
    result = await runReconcileFix(args.repoPath, config, scope, {
      approve: args.approve
    });
  } else {
    result = await runReconcileCheck(args.repoPath, config, scope);
  }
  return textResponse2(summarizeReconcile(mode, result), result);
}
async function handleImpact(args) {
  if (args.changedFiles.length === 0) {
    return textResponse2("No changed files provided", { affectedDocs: [] });
  }
  const cg = checkCodegraph(args.repoPath);
  const result = degradedImpact(args.repoPath, args.changedFiles);
  const text = result.affectedDocs.length > 0 ? result.affectedDocs.map((d) => `[${d.confidence}] ${d.doc}: ${d.reason}`).join("\n") : "No affected Knowledge documents found.";
  return textResponse2(
    `Impact (${cg.available ? "codegraph" : "heuristic"}):
${text}`,
    { ...result, codegraphAvailable: cg.available }
  );
}
async function startServer(projectDir) {
  const server = new McpServer({
    name: "kdoc",
    version: getPackageVersion()
  });
  server.registerTool(
    "kdoc_health",
    {
      description: "Run a full Knowledge governance health check \u2014 returns health score, violations, coverage, and suggestions",
      inputSchema: {
        repoPath: z2.string().describe("Absolute path to the project root")
      }
    },
    safeHandler2(async (args) => handleHealth(args))
  );
  server.registerTool(
    "kdoc_validate",
    {
      description: "Validate frontmatter of a specific Knowledge document against schema",
      inputSchema: {
        filePath: z2.string().describe("Absolute path to the file to validate")
      }
    },
    safeHandler2(async (args) => handleValidate(args))
  );
  server.registerTool(
    "kdoc_coverage",
    {
      description: "Get documentation coverage metrics by Knowledge area",
      inputSchema: {
        repoPath: z2.string().describe("Absolute path to the project root"),
        paths: z2.array(z2.string()).optional().describe("Limit to specific paths")
      }
    },
    safeHandler2(async (args) => handleCoverage(args))
  );
  server.registerTool(
    "kdoc_suggest",
    {
      description: "Suggest missing documentation based on project structure and changed files",
      inputSchema: {
        repoPath: z2.string().describe("Absolute path to the project root"),
        changedFiles: z2.array(z2.string()).optional().describe("Recently changed files to focus suggestions on")
      }
    },
    safeHandler2(async (args) => handleSuggest(args))
  );
  server.registerTool(
    "kdoc_schema",
    {
      description: "Return the current Knowledge schema definitions (frontmatter fields, status values, area structure)",
      inputSchema: {
        kind: z2.string().optional().describe('Document kind to return schema for (e.g., "adr", "feature"). Omit for full schema.')
      }
    },
    safeHandler2(async (args) => handleSchema(args))
  );
  server.registerTool(
    "kdoc_reconcile",
    {
      description: "Run reconcile against the shared engine in check, plan, or fix mode",
      inputSchema: {
        repoPath: z2.string().describe("Absolute path to the project root"),
        mode: z2.enum(["check", "plan", "fix"]).optional().describe("Execution mode. Defaults to check."),
        approve: z2.boolean().optional().describe("Allow approval-gated repairs when mode=fix"),
        area: z2.string().optional().describe("Limit reconciliation to a Knowledge area"),
        package: z2.string().optional().describe("Limit reconciliation to a package scope"),
        path: z2.string().optional().describe("Limit reconciliation to a specific repo-relative path")
      }
    },
    safeHandler2(async (args) => handleReconcile(args))
  );
  server.registerTool(
    "kdoc_impact",
    {
      description: "Determine which Knowledge documents are affected by code changes (requires CodeGraph, degrades gracefully)",
      inputSchema: {
        repoPath: z2.string().describe("Absolute path to the project root"),
        changedFiles: z2.array(z2.string()).describe("List of changed file paths")
      }
    },
    safeHandler2(async (args) => handleImpact(args))
  );
  registerRoadmapTools(server, projectDir);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
function parseProjectDir(argv, fallback) {
  const idx = argv.indexOf("--project");
  if (idx !== -1 && argv[idx + 1] && argv[idx + 1].trim() !== "") {
    return path2.resolve(argv[idx + 1]);
  }
  return fallback;
}
export {
  parseProjectDir,
  startServer
};
//# sourceMappingURL=server-O4TRWPA2.js.map