#!/usr/bin/env node
import {
  loadConfig,
  runReconcileCheck,
  runReconcileFix,
  runReconcilePlan
} from "./chunk-GVFDEDEZ.js";

// src/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";

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

// src/mcp/server.ts
var _engineCache = null;
async function loadEngine() {
  const enginePath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    "..",
    "..",
    "..",
    "core",
    "governance-engine.mjs"
  );
  return await import(enginePath);
}
async function cachedEngine() {
  if (!_engineCache) {
    _engineCache = await loadEngine();
  }
  return _engineCache;
}
function textResponse(text, data) {
  return {
    content: [{ type: "text", text }],
    structuredContent: data ?? {}
  };
}
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
function getPackageVersion() {
  try {
    const pkgPath = path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      "..",
      "..",
      "package.json"
    );
    return JSON.parse(fs.readFileSync(pkgPath, "utf-8")).version;
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
  return textResponse(summary, report);
}
async function handleValidate(args) {
  const engine = await cachedEngine();
  const result = engine.validateFile(args.filePath);
  const status = result.valid ? "Valid" : `Invalid: ${result.errors.map((e) => e.message).join("; ")}`;
  return textResponse(status, result);
}
async function handleCoverage(args) {
  const engine = await cachedEngine();
  const coverage = engine.getCoverage(args.repoPath, args.paths);
  const areas = Object.entries(coverage.byArea).map(([name, data]) => `${name}: ${data.fileCount} files, ${data.complete ? "complete" : "incomplete"}`).join("\n");
  return textResponse(areas || "No coverage data", coverage);
}
async function handleSuggest(args) {
  const engine = await cachedEngine();
  const report = engine.runGovernance(args.repoPath);
  engine.emitDaemonEvent("kdoc.doc_drift", {
    changedFiles: args.changedFiles ?? [],
    suggestionCount: report.suggestions.length
  });
  const text = report.suggestions.length > 0 ? report.suggestions.map((s) => `[${s.priority}] ${s.type}: ${s.reason}`).join("\n") : "No suggestions \u2014 documentation looks complete.";
  return textResponse(text, { suggestions: report.suggestions });
}
async function handleSchema(args) {
  const engine = await cachedEngine();
  const schemas = engine.loadSchemas();
  if (args.kind) {
    const typeDef = schemas.frontmatter.types[args.kind];
    if (!typeDef) {
      return textResponse(`Unknown document kind: ${args.kind}`, { error: `Unknown kind: ${args.kind}` });
    }
    return textResponse(JSON.stringify(typeDef, null, 2), { kind: args.kind, schema: typeDef });
  }
  return textResponse(
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
    return textResponse("Error: .kdoc.yaml not found. Run `kdoc init` first.", { error: "no config" });
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
  return textResponse(summarizeReconcile(mode, result), result);
}
async function handleImpact(args) {
  if (args.changedFiles.length === 0) {
    return textResponse("No changed files provided", { affectedDocs: [] });
  }
  const cg = checkCodegraph(args.repoPath);
  const result = degradedImpact(args.repoPath, args.changedFiles);
  const text = result.affectedDocs.length > 0 ? result.affectedDocs.map((d) => `[${d.confidence}] ${d.doc}: ${d.reason}`).join("\n") : "No affected Knowledge documents found.";
  return textResponse(
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
        repoPath: z.string().describe("Absolute path to the project root")
      }
    },
    safeHandler(async (args) => handleHealth(args))
  );
  server.registerTool(
    "kdoc_validate",
    {
      description: "Validate frontmatter of a specific Knowledge document against schema",
      inputSchema: {
        filePath: z.string().describe("Absolute path to the file to validate")
      }
    },
    safeHandler(async (args) => handleValidate(args))
  );
  server.registerTool(
    "kdoc_coverage",
    {
      description: "Get documentation coverage metrics by Knowledge area",
      inputSchema: {
        repoPath: z.string().describe("Absolute path to the project root"),
        paths: z.array(z.string()).optional().describe("Limit to specific paths")
      }
    },
    safeHandler(async (args) => handleCoverage(args))
  );
  server.registerTool(
    "kdoc_suggest",
    {
      description: "Suggest missing documentation based on project structure and changed files",
      inputSchema: {
        repoPath: z.string().describe("Absolute path to the project root"),
        changedFiles: z.array(z.string()).optional().describe("Recently changed files to focus suggestions on")
      }
    },
    safeHandler(async (args) => handleSuggest(args))
  );
  server.registerTool(
    "kdoc_schema",
    {
      description: "Return the current Knowledge schema definitions (frontmatter fields, status values, area structure)",
      inputSchema: {
        kind: z.string().optional().describe('Document kind to return schema for (e.g., "adr", "feature"). Omit for full schema.')
      }
    },
    safeHandler(async (args) => handleSchema(args))
  );
  server.registerTool(
    "kdoc_reconcile",
    {
      description: "Run reconcile against the shared engine in check, plan, or fix mode",
      inputSchema: {
        repoPath: z.string().describe("Absolute path to the project root"),
        mode: z.enum(["check", "plan", "fix"]).optional().describe("Execution mode. Defaults to check."),
        approve: z.boolean().optional().describe("Allow approval-gated repairs when mode=fix"),
        area: z.string().optional().describe("Limit reconciliation to a Knowledge area"),
        package: z.string().optional().describe("Limit reconciliation to a package scope"),
        path: z.string().optional().describe("Limit reconciliation to a specific repo-relative path")
      }
    },
    safeHandler(async (args) => handleReconcile(args))
  );
  server.registerTool(
    "kdoc_impact",
    {
      description: "Determine which Knowledge documents are affected by code changes (requires CodeGraph, degrades gracefully)",
      inputSchema: {
        repoPath: z.string().describe("Absolute path to the project root"),
        changedFiles: z.array(z.string()).describe("List of changed file paths")
      }
    },
    safeHandler(async (args) => handleImpact(args))
  );
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
function parseProjectDir(argv, fallback) {
  const idx = argv.indexOf("--project");
  if (idx !== -1 && argv[idx + 1] && argv[idx + 1].trim() !== "") {
    return path.resolve(argv[idx + 1]);
  }
  return fallback;
}
export {
  parseProjectDir,
  startServer
};
//# sourceMappingURL=server-FJGIFZNG.js.map