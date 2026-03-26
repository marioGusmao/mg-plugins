#!/usr/bin/env node

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
function grepExports(scanPath) {
  try {
    const result = spawnSync("grep", [
      "-rn",
      "--include=*.ts",
      "--include=*.js",
      "--include=*.tsx",
      "--include=*.jsx",
      "-E",
      "^export (function|class|const|type|interface|enum) ",
      scanPath
    ], { encoding: "utf8", timeout: 1e4 });
    if (!result.stdout) return [];
    return result.stdout.split("\n").filter(Boolean).map((line) => {
      const match = line.match(/export (?:function|class|const|type|interface|enum) (\w+)/);
      return match ? match[1] : "";
    }).filter(Boolean);
  } catch {
    return [];
  }
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
function degradedReconcile(repoPath, scanPath) {
  const knowledgeRoot = join(repoPath, "Knowledge");
  if (!existsSync(knowledgeRoot)) {
    return {
      degraded: true,
      driftItems: [{ doc: "Knowledge/", finding: "Knowledge directory not found", severity: "error" }],
      confidence: "low",
      reason: "CodeGraph not available and Knowledge directory missing"
    };
  }
  const exports = grepExports(scanPath);
  const driftItems = [];
  if (exports.length === 0) {
    driftItems.push({
      doc: scanPath,
      finding: "No exported symbols found via grep \u2014 cannot verify documentation coverage",
      severity: "info"
    });
  } else {
    const documented = /* @__PURE__ */ new Set();
    const undocumented = [];
    for (const exp of exports.slice(0, 50)) {
      const refs = findSymbolInDocs(knowledgeRoot, exp);
      if (refs.length > 0) {
        documented.add(exp);
      } else {
        undocumented.push(exp);
      }
    }
    if (undocumented.length > 0) {
      driftItems.push({
        doc: scanPath,
        finding: `${undocumented.length} exported symbol(s) not referenced in Knowledge docs: ${undocumented.slice(0, 5).join(", ")}${undocumented.length > 5 ? "..." : ""}`,
        severity: "warning"
      });
    }
    if (documented.size > 0) {
      driftItems.push({
        doc: scanPath,
        finding: `${documented.size} exported symbol(s) found in Knowledge docs`,
        severity: "info"
      });
    }
  }
  return {
    degraded: true,
    driftItems,
    confidence: "low",
    reason: "CodeGraph not available \u2014 using grep-based heuristics"
  };
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
async function handleReconcile(args) {
  const engine = await cachedEngine();
  const cg = checkCodegraph(args.repoPath);
  const result = degradedReconcile(args.repoPath, args.path);
  const driftCount = result.driftItems.filter((d) => d.severity !== "info").length;
  if (driftCount > 0) {
    engine.emitDaemonEvent("kdoc.doc_drift", {
      degraded: !cg.available,
      path: args.path,
      driftCount,
      confidence: result.confidence
    });
  }
  const text = result.driftItems.length > 0 ? result.driftItems.map((d) => `[${d.severity}] ${d.finding}`).join("\n") : "No drift detected.";
  return textResponse(
    `Reconcile (${result.confidence} confidence, ${cg.available ? "codegraph" : "heuristic"}):
${text}`,
    { ...result, codegraphAvailable: cg.available }
  );
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
      description: "Compare documentation against code reality (requires CodeGraph for full analysis, degrades gracefully without)",
      inputSchema: {
        repoPath: z.string().describe("Absolute path to the project root"),
        path: z.string().describe("Specific path to reconcile within the project")
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
//# sourceMappingURL=server-LKREY57Y.js.map