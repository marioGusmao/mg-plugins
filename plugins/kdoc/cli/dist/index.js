#!/usr/bin/env node
import {
  appendFileEntry,
  assembleBrief,
  buildDependencyGraph,
  buildScopedRenderValues,
  cleanupLockTmp,
  configExists,
  createEmptyLock,
  createTemplateResolver,
  deleteIfEmpty,
  ensureDir,
  finalizeLock,
  formatNextAsJson,
  formatNextAsMarkdown,
  getCriticalPath,
  getExecutionWaves,
  getGitOwner,
  getKdocVersion,
  getNextUnblocked,
  hasPendingLockTmp,
  hashFile,
  hashString,
  loadConfig,
  loadLock,
  loadTemplate,
  parseKnowledgeDocs,
  parseRoadmap,
  readFileSafe,
  registerDoctorCommand,
  registerGenerateCommand,
  renderTemplate,
  resolveDocumentTree,
  resolveReference,
  resolveRenderScopePath,
  resolveRoadmapStatus,
  resolveRootScope,
  resolveScopeForPackage,
  resolveScopes,
  runReconcileCheck,
  runReconcileFix,
  runReconcilePlan,
  safeWriteFile,
  slugify,
  writeConfig,
  writeKnowledgeJsonl,
  writeLock
} from "./chunk-GVFDEDEZ.js";

// src/index.ts
import { Command as Command10 } from "commander";
import { readFileSync as readFileSync12 } from "fs";
import { join as join15, dirname as dirname8 } from "path";
import { fileURLToPath as fileURLToPath6 } from "url";

// src/commands/init.ts
import { existsSync as existsSync6, readFileSync as readFileSync5 } from "fs";
import { join as join7 } from "path";
import { Command } from "commander";
import { checkbox, input, select } from "@inquirer/prompts";

// src/scaffold/detect.ts
import { existsSync as existsSync2, readdirSync as readdirSync2, readFileSync as readFileSync2 } from "fs";
import { join as join2, relative, basename as basename2 } from "path";
import fg from "fast-glob";

// src/packs/installer.ts
import { existsSync, readFileSync, readdirSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";
var __dirname = dirname(fileURLToPath(import.meta.url));
var ASSET_MAPPINGS = [
  { sourceDir: "templates", targetPrefix: (kr, p) => join(kr, "Templates", p) },
  { sourceDir: "guides", targetPrefix: (kr, p) => join(kr, "Guides", p) },
  { sourceDir: "design", targetPrefix: (kr, p) => join(kr, "Design", p) },
  { sourceDir: "scripts", targetPrefix: (_kr, p) => join("scripts", "kdoc", p) }
];
function getPacksRoot() {
  const bundledPath = join(__dirname, "..", "..", "packs");
  if (existsSync(bundledPath)) return bundledPath;
  return join(__dirname, "..", "..", "..", "packs");
}
function getPackRoot(packName) {
  return join(getPacksRoot(), packName);
}
function walkRelative(root, base = "") {
  if (!existsSync(root)) return [];
  const entries = readdirSync(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const rel = base ? join(base, entry.name) : entry.name;
    if (entry.isDirectory()) {
      files.push(...walkRelative(join(root, entry.name), rel));
    } else if (entry.isFile()) {
      files.push(rel);
    }
  }
  return files;
}
function buildPackRenderValues(projectDir, packName) {
  const values = {
    PROJECT_NAME: basename(projectDir) || "project",
    DATE: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
    SCOPE: "root",
    KNOWLEDGE_ROOT: "Knowledge",
    OWNER: getGitOwner(projectDir) || "repository owner",
    ADR_NEXT_SEQUENCE: "0001",
    TLDR_SCOPES: "Frontend, Backend, Shared",
    TLDR_STRUCTURE_COMMENT: "|- Frontend/\n|- Backend/\n\\- Shared/",
    WIKILINK_PREFIX: ""
  };
  return values;
}
async function installPackAssets(packName, projectDir, config, options = {}) {
  const { dryRun = false, force = false } = options;
  const packRoot = getPackRoot(packName);
  const knowledgeRoot = config.root ?? "Knowledge";
  const result = { installed: [], skipped: [], errors: [] };
  if (!existsSync(packRoot)) {
    result.errors.push(`Pack directory not found: ${packRoot}`);
    return result;
  }
  const renderValues = buildPackRenderValues(projectDir, packName);
  const existingLock = dryRun ? null : loadLock(projectDir);
  for (const mapping of ASSET_MAPPINGS) {
    const sourceDir = join(packRoot, mapping.sourceDir);
    const targetPrefix = mapping.targetPrefix(knowledgeRoot, packName);
    const files = walkRelative(sourceDir);
    for (const relFile of files) {
      const sourcePath = join(sourceDir, relFile);
      const targetRelPath = join(targetPrefix, relFile);
      const targetAbsPath = join(projectDir, targetRelPath);
      try {
        let content = readFileSync(sourcePath, "utf8");
        if (relFile.endsWith(".md") && content.includes("{{")) {
          content = renderTemplate(content, renderValues).content;
        }
        const contentHash = hashString(content);
        if (existsSync(targetAbsPath)) {
          const existingContent = readFileSync(targetAbsPath, "utf8");
          const existingHash = hashString(existingContent);
          if (existingHash === contentHash) {
            result.skipped.push(targetRelPath);
            continue;
          }
          if (!force) {
            result.skipped.push(targetRelPath);
            continue;
          }
        }
        if (dryRun) {
          result.installed.push(targetRelPath);
          continue;
        }
        ensureDir(dirname(targetAbsPath));
        safeWriteFile(targetAbsPath, content);
        result.installed.push(targetRelPath);
        if (existingLock && mapping.sourceDir === "templates") {
          const entry = {
            action: "created",
            hash: contentHash,
            templateHash: contentHash,
            template: `packs/${packName}/${mapping.sourceDir}/${relFile}`
          };
          appendFileEntry(projectDir, existingLock, targetRelPath, entry);
        }
      } catch (err) {
        result.errors.push(`${targetRelPath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  if (!dryRun && existingLock) {
    finalizeLock(projectDir);
  }
  return result;
}

// src/scaffold/detect.ts
function loadStackIndicators() {
  const indicators = [];
  const packsRoot = getPacksRoot();
  if (!existsSync2(packsRoot)) {
    return [
      { pattern: "next.config.ts", pack: "nextjs" },
      { pattern: "next.config.js", pack: "nextjs" },
      { pattern: "next.config.mjs", pack: "nextjs" },
      { pattern: "Package.swift", pack: "swift-ios" },
      { pattern: "*.xcodeproj", pack: "swift-ios" }
    ];
  }
  for (const entry of readdirSync2(packsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join2(packsRoot, entry.name, "pack.json");
    if (!existsSync2(manifestPath)) continue;
    try {
      const manifest = JSON.parse(readFileSync2(manifestPath, "utf8"));
      for (const pattern of manifest.detect.files) {
        indicators.push({ pattern, pack: manifest.name });
      }
    } catch {
    }
  }
  return indicators.length > 0 ? indicators : [
    { pattern: "next.config.ts", pack: "nextjs" },
    { pattern: "next.config.js", pack: "nextjs" },
    { pattern: "next.config.mjs", pack: "nextjs" },
    { pattern: "Package.swift", pack: "swift-ios" },
    { pattern: "*.xcodeproj", pack: "swift-ios" }
  ];
}
var STACK_INDICATORS = loadStackIndicators();
async function detectStack(projectDir) {
  const detected = /* @__PURE__ */ new Map();
  const patterns = [];
  for (const indicator of STACK_INDICATORS) {
    patterns.push(indicator.pattern);
    patterns.push(`*/${indicator.pattern}`);
    patterns.push(`*/*/${indicator.pattern}`);
  }
  const matches = await fg(patterns, {
    cwd: projectDir,
    absolute: true,
    onlyFiles: false,
    ignore: ["node_modules/**", ".git/**"]
  });
  for (const matchPath of matches) {
    const rel = relative(projectDir, matchPath);
    const parts = rel.split("/");
    const depth = parts.length - 1;
    const fileName = parts[parts.length - 1];
    const indicator = STACK_INDICATORS.find((ind) => {
      if (ind.pattern.includes("*")) {
        const ext = ind.pattern.replace("*", "");
        return fileName.endsWith(ext);
      }
      return fileName === ind.pattern;
    });
    if (!indicator) continue;
    const pack = indicator.pack;
    const existing = detected.get(pack);
    if (!existing || depth < existing.depth) {
      detected.set(pack, { name: pack, depth, path: matchPath });
    }
  }
  const packs = Array.from(detected.values());
  const isMonorepo = packs.some((p) => p.depth > 0);
  return { packs, isMonorepo };
}
function countFilesRecursive(dir) {
  let count = 0;
  const entries = readdirSync2(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) count++;
    else if (entry.isDirectory()) count += countFilesRecursive(join2(dir, entry.name));
  }
  return count;
}
function detectKnowledgeState(projectDir) {
  const knowledgeDir = join2(projectDir, "Knowledge");
  const hasKnowledgeDir = existsSync2(knowledgeDir);
  let existingAreas = [];
  let fileCount = 0;
  if (hasKnowledgeDir) {
    const entries = readdirSync2(knowledgeDir, { withFileTypes: true });
    existingAreas = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    fileCount = countFilesRecursive(knowledgeDir);
  }
  return {
    hasKnowledgeDir,
    existingAreas,
    fileCount,
    hasConfig: existsSync2(join2(projectDir, ".kdoc.yaml")),
    hasLock: existsSync2(join2(projectDir, ".kdoc.lock")),
    hasPendingLockTmp: existsSync2(join2(projectDir, ".kdoc.lock.tmp"))
  };
}
function detectAITools(projectDir) {
  const tools = [];
  if (existsSync2(join2(projectDir, ".claude")) || existsSync2(join2(projectDir, ".claude-plugin"))) {
    tools.push("claude-code");
  }
  if (existsSync2(join2(projectDir, "AGENTS.md")) || existsSync2(join2(projectDir, ".codex"))) {
    tools.push("codex");
  }
  return { tools };
}
function detectTopology(projectDir) {
  const pkgJsonPath = join2(projectDir, "package.json");
  if (existsSync2(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync2(pkgJsonPath, "utf8"));
      if (pkg.workspaces && (Array.isArray(pkg.workspaces) || pkg.workspaces.packages)) {
        return { suggested: "monorepo", reason: "package.json workspaces detected" };
      }
    } catch {
    }
  }
  if (existsSync2(join2(projectDir, "pnpm-workspace.yaml"))) {
    return { suggested: "monorepo", reason: "pnpm-workspace.yaml detected" };
  }
  const hasPackageJson = existsSync2(pkgJsonPath);
  const hasCodeFiles = fg.sync(["**/*.{ts,js,tsx,jsx,py,rb,go,rs,swift,java,kt}"], {
    cwd: projectDir,
    ignore: ["node_modules/**", ".git/**", "Knowledge/**"],
    onlyFiles: true,
    deep: 2
  }).length > 0;
  if (!hasPackageJson && !hasCodeFiles) {
    return { suggested: "vault", reason: "No package.json or code files found" };
  }
  return { suggested: "single", reason: "Single project (no workspace metadata)" };
}
function detectPackages(projectDir) {
  const packages = {};
  let patterns = [];
  const pkgJsonPath = join2(projectDir, "package.json");
  if (existsSync2(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync2(pkgJsonPath, "utf8"));
      if (Array.isArray(pkg.workspaces)) {
        patterns = pkg.workspaces;
      } else if (pkg.workspaces?.packages) {
        patterns = pkg.workspaces.packages;
      }
    } catch {
    }
  }
  if (patterns.length === 0) {
    const pnpmPath = join2(projectDir, "pnpm-workspace.yaml");
    if (existsSync2(pnpmPath)) {
      try {
        const content = readFileSync2(pnpmPath, "utf8");
        const match = content.match(/packages:\s*\n((?:\s+-\s+.+\n?)+)/);
        if (match) {
          patterns = match[1].split("\n").map((l) => l.replace(/^\s+-\s+['"]?/, "").replace(/['"]?\s*$/, "")).filter(Boolean);
        }
      } catch {
      }
    }
  }
  if (patterns.length === 0) return { packages };
  for (const pattern of patterns) {
    const matches = fg.sync(pattern, {
      cwd: projectDir,
      onlyDirectories: true,
      ignore: ["node_modules/**"]
    });
    for (const match of matches) {
      const pkgPath = join2(projectDir, match, "package.json");
      if (existsSync2(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync2(pkgPath, "utf8"));
          const name = pkg.name ?? basename2(match);
          packages[name] = match;
        } catch {
          packages[basename2(match)] = match;
        }
      } else {
        packages[basename2(match)] = match;
      }
    }
  }
  return { packages };
}
async function detectProject(projectDir) {
  const [stack, knowledge, aiTools] = await Promise.all([
    detectStack(projectDir),
    Promise.resolve(detectKnowledgeState(projectDir)),
    Promise.resolve(detectAITools(projectDir))
  ]);
  return { stack, knowledge, aiTools };
}

// src/scaffold/plan.ts
import { existsSync as existsSync3 } from "fs";
import { join as join4, relative as relative2 } from "path";

// src/topology/paths.ts
import { join as join3 } from "path";
var AREA_DIR_MAP = {
  "adr": "ADR",
  "tldr": "TLDR",
  "roadmap": "Roadmap",
  "design": "Design",
  "guides": "Guides",
  "agent-memory": "AgentMemory",
  "runbooks": "runbooks",
  "threat-models": "ThreatModels",
  "templates": "Templates",
  "governance": "governance",
  "context-pack": "",
  // ContextPack.md lives at Knowledge root
  "index": ""
  // INDEX.md lives at Knowledge root
};
function knowledgePath(scope, area, filename) {
  if (scope.type === "category") {
    return filename ? join3(scope.knowledgeRoot, filename) : scope.knowledgeRoot;
  }
  const dirName = AREA_DIR_MAP[area] ?? area;
  const areaPath = dirName ? join3(scope.knowledgeRoot, dirName) : scope.knowledgeRoot;
  return filename ? join3(areaPath, filename) : areaPath;
}

// src/scaffold/plan.ts
var MERGE_CANDIDATES = {
  "CLAUDE.md": { strategy: "markers", markerName: "core" },
  "AGENTS.md": { strategy: "markers", markerName: "core" },
  ".gitignore": { strategy: "markers", markerName: "core" },
  "package.json": { strategy: "prefix" },
  "turbo.json": { strategy: "prefix" }
};
function deriveDesiredFiles(config, _detection, projectDir) {
  const files = [];
  const scopes = resolveScopes(config, projectDir);
  const relPath = (absolutePath) => relative2(projectDir, absolutePath).replaceAll("\\", "/");
  for (const scope of scopes) {
    if (scope.type === "category") {
      files.push({
        path: relPath(join4(scope.knowledgeRoot, "README.md")),
        templateName: "core/templates/readme-category.md"
      });
      continue;
    }
    const areas = scope.areas ?? {};
    if (areas["adr"]?.enabled) {
      files.push({
        path: relPath(knowledgePath(scope, "adr", "README.md")),
        templateName: "core/templates/readme-adr.md"
      });
    }
    if (areas["tldr"]?.enabled) {
      files.push({
        path: relPath(knowledgePath(scope, "tldr", "README.md")),
        templateName: "core/templates/readme-tldr.md"
      });
      for (const areaScope of areas["tldr"].scopes ?? []) {
        files.push({
          path: relPath(knowledgePath(scope, "tldr", join4(areaScope, ".gitkeep"))),
          templateName: "core/templates/gitkeep"
        });
      }
    }
    if (areas["roadmap"]?.enabled) {
      files.push({
        path: relPath(knowledgePath(scope, "roadmap", "README.md")),
        templateName: "core/templates/readme-roadmap.md"
      });
    }
    if (areas["context-pack"]?.enabled) {
      files.push({
        path: relPath(knowledgePath(scope, "context-pack", "ContextPack.md")),
        templateName: "core/templates/context-pack.md"
      });
    }
    if (areas["agent-memory"]?.enabled) {
      files.push({
        path: relPath(knowledgePath(scope, "agent-memory", "MEMORY.md")),
        templateName: "core/templates/memory.md"
      });
    }
    if (areas["guides"]?.enabled) {
      files.push({
        path: relPath(knowledgePath(scope, "guides", ".gitkeep")),
        templateName: "core/templates/gitkeep"
      });
    }
    if (areas["runbooks"]?.enabled) {
      files.push({
        path: relPath(knowledgePath(scope, "runbooks", ".gitkeep")),
        templateName: "core/templates/gitkeep"
      });
    }
    if (areas["templates"]?.enabled) {
      files.push({
        path: relPath(knowledgePath(scope, "templates", ".gitkeep")),
        templateName: "core/templates/gitkeep"
      });
    }
  }
  for (const tool of config.tools ?? []) {
    if (tool === "claude-code") {
      files.push({ path: "CLAUDE.md", templateName: "core/templates/claude-md-block.md" });
    }
    if (tool === "codex") {
      files.push({ path: "AGENTS.md", templateName: "core/templates/agents-md-block.md" });
    }
  }
  files.push({ path: ".gitignore", templateName: "core/templates/gitignore-block" });
  files.push({ path: "package.json", templateName: "core/templates/package-json-scripts" });
  return files;
}
function classifyOperation(desiredPath, templateName, projectDir, lock, resolver) {
  const resolved = resolver(templateName);
  if (!resolved) return null;
  const absPath = join4(projectDir, desiredPath);
  const fileName = desiredPath.split("/").pop() ?? desiredPath;
  const mergeConfig = MERGE_CANDIDATES[fileName];
  if (!existsSync3(absPath)) {
    return {
      path: desiredPath,
      type: "CREATE",
      source: resolved.sourcePath,
      ...mergeConfig ? { mergeStrategy: mergeConfig.strategy, markerName: mergeConfig.markerName } : {}
    };
  }
  const lockEntry = lock?.files[desiredPath];
  if (lockEntry) {
    const expectedHash = lockEntry.action === "created" ? lockEntry.hash : lockEntry.blockHash;
    let currentHash;
    try {
      currentHash = hashFile(absPath);
    } catch {
      currentHash = "";
    }
    if (currentHash === expectedHash) {
      return { path: desiredPath, type: "SKIP", source: resolved.sourcePath, reason: "unmodified" };
    } else {
      return { path: desiredPath, type: "CONFLICT", source: resolved.sourcePath, reason: "user-modified" };
    }
  }
  if (mergeConfig) {
    return {
      path: desiredPath,
      type: "MERGE",
      source: resolved.sourcePath,
      mergeStrategy: mergeConfig.strategy,
      markerName: mergeConfig.markerName
    };
  }
  return {
    path: desiredPath,
    type: "SKIP",
    source: resolved.sourcePath,
    reason: `file exists and is not managed by kdoc \u2014 skipping`
  };
}
function planScaffold(options) {
  const { config, detection, lock, projectDir, templateResolver } = options;
  const desired = deriveDesiredFiles(config, detection, projectDir);
  const operations = [];
  for (const { path, templateName } of desired) {
    const op = classifyOperation(path, templateName, projectDir, lock, templateResolver);
    if (op) operations.push(op);
  }
  return operations;
}

// src/scaffold/execute.ts
import { existsSync as existsSync4, readFileSync as readFileSync3, copyFileSync } from "fs";
import { join as join5, dirname as dirname2 } from "path";

// src/scaffold/merge/markers.ts
function getDelimiters(fileName, markerName) {
  const isGitignore = fileName === ".gitignore" || fileName.endsWith(".gitignore");
  if (isGitignore) {
    return {
      start: `# kdoc:${markerName}:start`,
      end: `# kdoc:${markerName}:end`
    };
  }
  return {
    start: `<!-- kdoc:${markerName}:start -->`,
    end: `<!-- kdoc:${markerName}:end -->`
  };
}
function injectMarkerBlock(fileContent, blockContent, fileName, markerName) {
  const { start, end } = getDelimiters(fileName, markerName);
  const fullBlock = `${start}
${blockContent}
${end}`;
  const hasStart = fileContent.includes(start);
  const hasEnd = fileContent.includes(end);
  if (hasStart !== hasEnd) {
    throw new Error(
      `Corrupted kdoc markers in ${fileName}: found ${hasStart ? "start" : "end"} marker for "${markerName}" but not the other. Fix manually by adding the missing marker or removing the orphaned one.`
    );
  }
  if (hasStart && hasEnd) {
    const startIdx = fileContent.indexOf(start);
    const endIdx = fileContent.indexOf(end) + end.length;
    return fileContent.slice(0, startIdx) + fullBlock + fileContent.slice(endIdx);
  }
  if (fileContent.length === 0) return fullBlock;
  const separator = fileContent.endsWith("\n") ? "\n" : "\n\n";
  return fileContent + separator + fullBlock;
}
function removeMarkerBlock(fileContent, fileName, markerName) {
  const { start, end } = getDelimiters(fileName, markerName);
  const hasStart = fileContent.includes(start);
  const hasEnd = fileContent.includes(end);
  if (hasStart !== hasEnd) {
    throw new Error(
      `Corrupted kdoc markers in ${fileName}: found ${hasStart ? "start" : "end"} marker for "${markerName}" but not the other. Fix manually by adding the missing marker or removing the orphaned one.`
    );
  }
  if (!hasStart && !hasEnd) {
    return fileContent;
  }
  const startIdx = fileContent.indexOf(start);
  const endIdx = fileContent.indexOf(end) + end.length;
  const before = fileContent.slice(0, startIdx);
  const after = fileContent.slice(endIdx);
  return (before + after).replace(/\n{3,}/g, "\n\n").trim();
}

// src/scaffold/merge/package-json.ts
function mergePackageJsonScripts(fileContent, kdocScripts) {
  const pkg = JSON.parse(fileContent);
  if (!pkg["scripts"]) pkg["scripts"] = {};
  const scripts = pkg["scripts"];
  for (const [key, value] of Object.entries(kdocScripts)) {
    scripts[key] = value;
  }
  return JSON.stringify(pkg, null, 2) + "\n";
}
function removePackageJsonScripts(fileContent) {
  const pkg = JSON.parse(fileContent);
  if (!pkg["scripts"]) return fileContent;
  const scripts = pkg["scripts"];
  for (const key of Object.keys(scripts)) {
    if (key.startsWith("kdoc:")) delete scripts[key];
  }
  return JSON.stringify(pkg, null, 2) + "\n";
}

// src/scaffold/merge/turbo-json.ts
function mergeTurboJsonTasks(fileContent, kdocTasks) {
  const turbo = JSON.parse(fileContent);
  if (!turbo["tasks"]) turbo["tasks"] = {};
  const tasks = turbo["tasks"];
  for (const [key, value] of Object.entries(kdocTasks)) {
    tasks[key] = value;
  }
  return JSON.stringify(turbo, null, 2) + "\n";
}
function removeTurboJsonTasks(fileContent) {
  const turbo = JSON.parse(fileContent);
  if (!turbo["tasks"]) return fileContent;
  const tasks = turbo["tasks"];
  for (const key of Object.keys(tasks)) {
    if (key.startsWith("kdoc:")) delete tasks[key];
  }
  return JSON.stringify(turbo, null, 2) + "\n";
}

// src/scaffold/execute.ts
function backupFile(projectDir, relativePath) {
  const absSource = join5(projectDir, relativePath);
  const absDest = join5(projectDir, ".kdoc.backup", relativePath);
  if (!existsSync4(absSource)) return;
  if (existsSync4(absDest)) return;
  ensureDir(dirname2(absDest));
  copyFileSync(absSource, absDest);
}
async function applyMerge(op, projectDir, templateContent) {
  const absPath = join5(projectDir, op.path);
  const fileName = op.path.split("/").pop() ?? op.path;
  const existing = existsSync4(absPath) ? readFileSync3(absPath, "utf8") : "";
  if (op.mergeStrategy === "markers") {
    return injectMarkerBlock(existing, templateContent, fileName, op.markerName ?? "core");
  }
  if (op.mergeStrategy === "prefix") {
    if (fileName === "package.json") {
      let scripts;
      try {
        scripts = JSON.parse(templateContent);
      } catch {
        scripts = {};
      }
      const existingContent = existing || "{}";
      return mergePackageJsonScripts(existingContent, scripts);
    }
    if (fileName === "turbo.json") {
      let tasks;
      try {
        tasks = JSON.parse(templateContent);
      } catch {
        tasks = {};
      }
      const existingContent = existing || "{}";
      return mergeTurboJsonTasks(existingContent, tasks);
    }
  }
  return existing + "\n" + templateContent;
}
function renderScaffoldTemplate(op, templateContent, config, projectDir) {
  if (!templateContent.includes("{{")) return templateContent;
  const values = buildScopedRenderValues(
    config,
    projectDir,
    resolveRenderScopePath(config, op.path)
  );
  return renderTemplate(templateContent, values).content;
}
async function executeScaffold(options) {
  const {
    operations,
    config,
    projectDir,
    kdocVersion,
    templateContents,
    dryRun = false,
    force = false,
    onProgress
  } = options;
  const summary = {
    created: [],
    merged: [],
    updated: [],
    removed: [],
    renamed: [],
    skipped: [],
    conflicts: [],
    errors: []
  };
  const lockConfig = {
    root: config.root ?? "Knowledge",
    packs: config.packs ?? [],
    tools: config.tools ?? [],
    ...config.topology ? { topology: config.topology } : {},
    ...config.packages ? { packages: Object.fromEntries(
      Object.entries(config.packages).map(([name, packageConfig]) => [name, { path: packageConfig.path }])
    ) } : {}
  };
  const existingLock = loadLock(projectDir);
  const lock = existingLock ? { ...existingLock, kdocVersion, config: lockConfig, files: { ...existingLock.files } } : createEmptyLock(kdocVersion, lockConfig);
  for (const op of operations) {
    try {
      if (op.type === "SKIP") {
        summary.skipped.push(op.path);
        onProgress?.(op, "skipped");
        continue;
      }
      if (op.type === "CONFLICT") {
        if (!force) {
          summary.conflicts.push(op.path);
          onProgress?.(op, "conflict");
          continue;
        }
        const renderedContent = renderScaffoldTemplate(
          op,
          templateContents.get(op.source) ?? "",
          config,
          projectDir
        );
        if (!dryRun) {
          backupFile(projectDir, op.path);
          safeWriteFile(join5(projectDir, op.path), renderedContent);
          const fileHash = hashString(renderedContent);
          const templateHash = hashString(templateContents.get(op.source) ?? "");
          const entry = {
            action: "created",
            hash: fileHash,
            templateHash,
            template: op.source
          };
          appendFileEntry(projectDir, lock, op.path, entry);
        }
        summary.created.push(op.path);
        onProgress?.(op, "done");
        continue;
      }
      const templateContent = renderScaffoldTemplate(
        op,
        templateContents.get(op.source) ?? "",
        config,
        projectDir
      );
      if (op.type === "CREATE") {
        if (!dryRun) {
          safeWriteFile(join5(projectDir, op.path), templateContent);
          const fileHash = hashString(templateContent);
          const templateHash = hashString(templateContent);
          const entry = {
            action: "created",
            hash: fileHash,
            templateHash,
            template: op.source
          };
          appendFileEntry(projectDir, lock, op.path, entry);
        }
        summary.created.push(op.path);
        onProgress?.(op, "done");
        continue;
      }
      if (op.type === "MERGE") {
        if (!dryRun) {
          backupFile(projectDir, op.path);
          const merged = await applyMerge(op, projectDir, templateContent);
          safeWriteFile(join5(projectDir, op.path), merged);
          const blockHash = hashString(templateContent);
          const templateHash = hashString(templateContent);
          const entry = {
            action: "merged",
            blockHash,
            templateHash,
            template: op.source,
            strategy: op.mergeStrategy ?? "markers",
            ...op.markerName ? { markerName: op.markerName } : {}
          };
          appendFileEntry(projectDir, lock, op.path, entry);
        }
        summary.merged.push(op.path);
        onProgress?.(op, "done");
        continue;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push({ path: op.path, error: message });
      onProgress?.(op, "error");
    }
  }
  if (!dryRun) {
    finalizeLock(projectDir);
  }
  return summary;
}

// src/constants.ts
var SYNTHETIC_TEMPLATES = {
  "core/templates/gitkeep": "",
  "core/templates/claude-md-block.md": "kdoc Knowledge documentation toolkit is installed.\n\nRun `npx kdoc doctor` to check your setup.\n",
  "core/templates/agents-md-block.md": "kdoc Knowledge documentation toolkit is installed.\n\nRun `npx kdoc doctor` to check your setup.\n",
  "core/templates/gitignore-block": ".kdoc.backup/\n.kdoc.lock.tmp\n",
  "core/templates/package-json-scripts": JSON.stringify({ "kdoc:check": "npx kdoc doctor" })
};
var KNOWN_PACKS = ["nextjs", "swift-ios"];
var KNOWN_TOOLS = ["claude-code", "codex"];
var KNOWN_AREAS = [
  "adr",
  "tldr",
  "roadmap",
  "design",
  "guides",
  "agent-memory",
  "runbooks",
  "threat-models",
  "templates",
  "governance",
  "context-pack",
  "index"
];

// src/integrations/runner.ts
import { existsSync as existsSync5, readFileSync as readFileSync4 } from "fs";
import { dirname as dirname3, join as join6 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { spawnSync } from "child_process";
var __dirname2 = dirname3(fileURLToPath2(import.meta.url));
function getKdocRoot() {
  const bundledPath = join6(__dirname2, "..", "..");
  if (existsSync5(join6(bundledPath, "integrations"))) return bundledPath;
  return join6(__dirname2, "..", "..", "..");
}
function normalizeManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value;
  const readStringArray = (key) => {
    const raw = record[key];
    return Array.isArray(raw) ? raw.filter((entry) => typeof entry === "string") : [];
  };
  return {
    created: readStringArray("created"),
    merged: readStringArray("merged"),
    skipped: readStringArray("skipped")
  };
}
function installerPathFor(tool) {
  return join6(getKdocRoot(), "integrations", tool, "install.js");
}
function readInstalledContent(projectDir, relativePath) {
  const absolutePath = join6(projectDir, relativePath);
  if (!existsSync5(absolutePath)) return null;
  try {
    return readFileSync4(absolutePath, "utf8");
  } catch {
    return null;
  }
}
function trackInstallerManifest(projectDir, manifest) {
  const lock = loadLock(projectDir);
  if (!lock) return;
  for (const relativePath of manifest.created) {
    if (lock.files[relativePath]) continue;
    const content = readInstalledContent(projectDir, relativePath);
    if (content === null) continue;
    const fileHash = hashString(content);
    const entry = {
      action: "created",
      hash: fileHash,
      templateHash: fileHash,
      template: `tool-installed:${relativePath}`
    };
    appendFileEntry(projectDir, lock, relativePath, entry);
  }
  finalizeLock(projectDir);
}
function runToolInstaller(tool, projectDir, options = {}) {
  const installerPath = installerPathFor(tool);
  const manifest = { created: [], merged: [], skipped: [] };
  const warnings = [];
  if (!existsSync5(installerPath)) {
    warnings.push(`Installer missing for tool "${tool}" at ${installerPath}; kept scaffold-only fallback.`);
    return {
      ok: true,
      fallbackUsed: true,
      manifest,
      stdout: "",
      stderr: "",
      warnings
    };
  }
  const args = [
    installerPath,
    "--project-root",
    projectDir,
    "--kdoc-root",
    getKdocRoot(),
    "--manifest"
  ];
  if (options.dryRun) args.push("--dry-run");
  if (options.yes) args.push("--yes");
  const result = spawnSync("node", args, {
    cwd: projectDir,
    encoding: "utf8"
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (result.status !== 0) {
    warnings.push(`Installer for tool "${tool}" exited with code ${result.status}; kept scaffold-only fallback.`);
    return {
      ok: false,
      fallbackUsed: true,
      manifest,
      stdout,
      stderr,
      warnings
    };
  }
  const parsed = normalizeManifest((() => {
    try {
      return JSON.parse(stdout.trim() || "{}");
    } catch {
      return null;
    }
  })());
  if (!parsed) {
    warnings.push(`Installer for tool "${tool}" did not return a manifest; kept scaffold-only fallback.`);
    return {
      ok: true,
      fallbackUsed: true,
      manifest,
      stdout,
      stderr,
      warnings
    };
  }
  if (!options.dryRun) {
    trackInstallerManifest(projectDir, parsed);
  }
  return {
    ok: true,
    fallbackUsed: false,
    manifest: parsed,
    stdout,
    stderr,
    warnings
  };
}

// src/commands/init.ts
function getProjectDir() {
  return process.env.KDOC_PROJECT_DIR ?? process.cwd();
}
var PACK_DEFAULT_AREAS = {
  nextjs: [
    "adr",
    "tldr",
    "roadmap",
    "design",
    "guides",
    "agent-memory",
    "runbooks",
    "templates",
    "context-pack",
    "index"
  ],
  "swift-ios": ["adr", "tldr", "roadmap", "guides", "agent-memory", "templates", "context-pack"]
};
var DEFAULT_AREAS = [...KNOWN_AREAS];
var DEFAULT_VAULT_CATEGORIES = ["Notes", "Decisions", "Research", "Templates"];
var TOPOLOGY_OPTIONS = ["single", "monorepo", "vault"];
function parseTopologyOption(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (TOPOLOGY_OPTIONS.includes(normalized)) {
    return normalized;
  }
  return null;
}
function makeTemplateResolver() {
  return createTemplateResolver(SYNTHETIC_TEMPLATES);
}
function buildConfig(options) {
  const { packs, tools, areas, topology, packages = {}, categories } = options;
  const areaMap = {};
  for (const area of KNOWN_AREAS) {
    areaMap[area] = { enabled: areas.includes(area) };
  }
  return {
    version: 2,
    root: "Knowledge",
    packs,
    tools,
    areas: areaMap,
    topology,
    packages,
    ...categories ? { categories } : {},
    governance: {
      "sync-check": true,
      wikilinks: true,
      "adr-governance": true,
      "index-build": true,
      "intent-check": true,
      "enforced-paths": []
    },
    scripts: { prefix: "kdoc" },
    extensionAreas: []
  };
}
function printSummary(summary) {
  console.log("\nScaffold complete:");
  if (summary.created.length) console.log(`  Created : ${summary.created.length} file(s)`);
  if (summary.merged.length) console.log(`  Merged  : ${summary.merged.length} file(s)`);
  if (summary.skipped.length) console.log(`  Skipped : ${summary.skipped.length} file(s)`);
  if (summary.conflicts.length) {
    console.log(`  Conflicts: ${summary.conflicts.length} file(s) (review manually)`);
    for (const c of summary.conflicts) console.log(`    - ${c}`);
  }
  if (summary.errors.length) {
    console.log(`  Errors  : ${summary.errors.length} file(s)`);
    for (const e of summary.errors) console.log(`    - ${e.path}: ${e.error}`);
  }
}
function createInitCommand() {
  const cmd = new Command("init");
  cmd.description("Scaffold a Knowledge documentation structure into this project").option("--pack <packs>", "Comma-separated list of packs (nextjs,swift-ios)").option("--tools <tools>", "Comma-separated list of AI tools (claude-code,codex)").option("--topology <topology>", "Knowledge topology (single, monorepo, vault)").option("--yes", "Non-interactive: skip all prompts and use detected defaults").option("--dry-run", "Show what would be done without making changes").option("--verbose", "Log each file operation as it runs").action(async (options) => {
    const projectDir = getProjectDir();
    const yes = !!options.yes;
    const dryRun = !!options.dryRun;
    const verbose = !!options.verbose;
    const selectedTopologyOption = parseTopologyOption(options.topology);
    try {
      if (options.topology && !selectedTopologyOption) {
        console.error("Error: --topology must be one of: single, monorepo, vault.");
        process.exitCode = 1;
        return;
      }
      if (dryRun && configExists(projectDir)) {
        const existingConfig = loadConfig(projectDir);
        if (existingConfig) {
          const mergedConfig = { ...existingConfig };
          if (selectedTopologyOption) mergedConfig.topology = selectedTopologyOption;
          if (options.tools) {
            mergedConfig.tools = options.tools.split(",").map((s) => s.trim()).filter(Boolean);
          }
          if (options.pack) {
            mergedConfig.packs = options.pack.split(",").map((s) => s.trim()).filter(Boolean);
          }
          const resolver2 = makeTemplateResolver();
          const detection2 = await detectProject(projectDir);
          const existingLock2 = loadLock(projectDir);
          const operations2 = planScaffold({
            config: mergedConfig,
            detection: detection2,
            lock: existingLock2,
            projectDir,
            templateResolver: resolver2
          });
          for (const op of operations2) {
            if (op.type === "CONFLICT") {
              const absPath = join7(projectDir, op.path);
              if (existsSync6(absPath)) {
                const content = readFileSync5(absPath, "utf8");
                if (content.includes("<!-- kdoc:") || content.includes('"kdoc:')) {
                  op.type = "SKIP";
                  op.reason = "kdoc markers already present";
                }
              }
            }
          }
          const creates = operations2.filter((o) => o.type === "CREATE").length;
          const merges = operations2.filter((o) => o.type === "MERGE").length;
          const skips = operations2.filter((o) => o.type === "SKIP").length;
          const conflicts = operations2.filter((o) => o.type === "CONFLICT").length;
          console.log(`
Plan: ${creates} create, ${merges} merge, ${skips} skip, ${conflicts} conflict`);
          for (const op of operations2) {
            console.log(`  [${op.type.padEnd(8)}] ${op.path}`);
          }
          console.log("\nDry run complete. No files were changed.");
          return;
        }
      }
      const detection = await detectProject(projectDir);
      const topologyDetection = detectTopology(projectDir);
      const detectedPackages = detectPackages(projectDir);
      if (hasPendingLockTmp(projectDir)) {
        if (!yes) {
          const action = await select({
            message: "Previous install was interrupted. What would you like to do?",
            choices: [
              { name: "Resume from partial state", value: "resume" },
              { name: "Start fresh (delete partial state)", value: "fresh" }
            ]
          });
          if (action === "fresh") {
            cleanupLockTmp(projectDir);
          }
        }
      }
      let selectedPacks;
      if (options.pack) {
        selectedPacks = options.pack.split(",").map((s) => s.trim()).filter(Boolean);
      } else if (yes) {
        selectedPacks = detection.stack.packs.map((p) => p.name);
      } else {
        selectedPacks = await checkbox({
          message: "Which technology packs would you like to install?",
          choices: KNOWN_PACKS.map((p) => ({
            name: p,
            value: p,
            checked: detection.stack.packs.some((dp) => dp.name === p)
          }))
        });
      }
      for (const pack of selectedPacks) {
        if (!KNOWN_PACKS.includes(pack)) {
          console.error(`Error: Unknown pack "${pack}". Valid packs: ${KNOWN_PACKS.join(", ")}`);
          process.exitCode = 1;
          return;
        }
      }
      let selectedTools;
      if (options.tools) {
        selectedTools = options.tools.split(",").map((s) => s.trim()).filter(Boolean);
      } else if (yes) {
        selectedTools = detection.aiTools.tools;
      } else {
        selectedTools = await checkbox({
          message: "Which AI tool integrations would you like to configure?",
          choices: KNOWN_TOOLS.map((t) => ({
            name: t,
            value: t,
            checked: detection.aiTools.tools.includes(t)
          }))
        });
      }
      for (const tool of selectedTools) {
        if (!KNOWN_TOOLS.includes(tool)) {
          console.error(`Error: Unknown tool "${tool}". Valid tools: ${KNOWN_TOOLS.join(", ")}`);
          process.exitCode = 1;
          return;
        }
      }
      let selectedTopology;
      if (selectedTopologyOption) {
        selectedTopology = selectedTopologyOption;
      } else if (yes) {
        selectedTopology = topologyDetection.suggested === "monorepo" ? "monorepo" : "single";
      } else {
        selectedTopology = await select({
          message: `Project topology (detected: ${topologyDetection.suggested})`,
          default: topologyDetection.suggested,
          choices: [
            { name: "Single project", value: "single" },
            { name: "Monorepo (multiple packages)", value: "monorepo" },
            { name: "Knowledge vault (no code)", value: "vault" }
          ]
        });
      }
      let selectedPackages = {};
      let selectedCategories;
      if (selectedTopology === "monorepo") {
        const detectedPackageEntries = Object.entries(detectedPackages.packages);
        if (yes) {
          selectedPackages = Object.fromEntries(
            detectedPackageEntries.map(([name, path]) => [name, { path }])
          );
        } else if (detectedPackageEntries.length > 0) {
          const chosen = await checkbox({
            message: "Which packages should get Knowledge scopes?",
            choices: detectedPackageEntries.map(([name, path]) => ({
              name: `${name} (${path})`,
              value: name,
              checked: true
            }))
          });
          selectedPackages = Object.fromEntries(
            chosen.map((name) => [name, { path: detectedPackages.packages[name] }])
          );
        }
      }
      if (selectedTopology === "vault") {
        const categoryInput = yes ? DEFAULT_VAULT_CATEGORIES.join(", ") : await input({
          message: "Vault categories (comma-separated)",
          default: DEFAULT_VAULT_CATEGORIES.join(", ")
        });
        const categoryNames = categoryInput.split(",").map((value) => value.trim()).filter(Boolean);
        selectedCategories = Object.fromEntries(
          categoryNames.map((name) => [name, { label: name }])
        );
      }
      let selectedAreas;
      if (selectedTopology === "vault") {
        selectedAreas = [];
      } else if (yes) {
        const packDefaults = selectedPacks.length > 0 ? [...new Set(selectedPacks.flatMap((p) => PACK_DEFAULT_AREAS[p] ?? DEFAULT_AREAS))] : DEFAULT_AREAS;
        selectedAreas = packDefaults;
      } else {
        const packDefaults = selectedPacks.length > 0 ? [...new Set(selectedPacks.flatMap((p) => PACK_DEFAULT_AREAS[p] ?? DEFAULT_AREAS))] : DEFAULT_AREAS;
        selectedAreas = await checkbox({
          message: "Which Knowledge areas would you like to enable?",
          choices: KNOWN_AREAS.map((a) => ({
            name: a,
            value: a,
            checked: packDefaults.includes(a)
          }))
        });
      }
      const config = buildConfig({
        packs: selectedPacks,
        tools: selectedTools,
        areas: selectedAreas,
        topology: selectedTopology,
        packages: selectedPackages,
        categories: selectedCategories
      });
      const resolver = makeTemplateResolver();
      const existingLock = loadLock(projectDir);
      const operations = planScaffold({
        config,
        detection,
        lock: existingLock,
        projectDir,
        templateResolver: resolver
      });
      if (verbose || dryRun) {
        const creates = operations.filter((o) => o.type === "CREATE").length;
        const merges = operations.filter((o) => o.type === "MERGE").length;
        const skips = operations.filter((o) => o.type === "SKIP").length;
        const conflicts = operations.filter((o) => o.type === "CONFLICT").length;
        console.log(`
Plan: ${creates} create, ${merges} merge, ${skips} skip, ${conflicts} conflict`);
      }
      if (dryRun) {
        for (const op of operations) {
          console.log(`  [${op.type.padEnd(8)}] ${op.path}`);
        }
        console.log("\nDry run complete. No files were changed.");
        return;
      }
      const templateContents = /* @__PURE__ */ new Map();
      for (const op of operations) {
        const resolved = resolver(op.source);
        if (resolved) {
          templateContents.set(op.source, resolved.content);
        } else if (existsSync6(op.source)) {
          templateContents.set(op.source, readFileSync5(op.source, "utf8"));
        }
      }
      const summary = await executeScaffold({
        operations,
        config,
        projectDir,
        kdocVersion: getKdocVersion(),
        templateContents,
        dryRun,
        verbose,
        onProgress: verbose ? (op, result) => console.log(`  [${result.toUpperCase().padEnd(8)}] ${op.path}`) : void 0
      });
      for (const pack of config.packs) {
        const packResult = await installPackAssets(pack, projectDir, config, {
          dryRun
        });
        if (packResult.errors.length > 0) {
          for (const e of packResult.errors) console.warn(`Warning: ${e}`);
        }
      }
      writeConfig(projectDir, config);
      for (const tool of selectedTools) {
        try {
          const toolResult = runToolInstaller(tool, projectDir, { yes });
          for (const warning of toolResult.warnings) {
            console.warn(`Warning: ${warning}`);
          }
        } catch (err) {
          console.warn(`Warning: tool installer for "${tool}" failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      printSummary(summary);
      if (summary.errors.length > 0) {
        process.exitCode = 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });
  return cmd;
}

// src/commands/add.ts
import { existsSync as existsSync7, mkdirSync, readFileSync as readFileSync6 } from "fs";
import { join as join8 } from "path";
import { Command as Command2 } from "commander";
function getProjectDir2() {
  return process.env.KDOC_PROJECT_DIR ?? process.cwd();
}
function makeTemplateResolver2() {
  return createTemplateResolver(SYNTHETIC_TEMPLATES);
}
async function runScopedScaffold(projectDir, updatedConfig, { force = false } = {}) {
  const detection = await detectProject(projectDir);
  const existingLock = loadLock(projectDir);
  const resolver = makeTemplateResolver2();
  const operations = planScaffold({
    config: updatedConfig,
    detection,
    lock: existingLock,
    projectDir,
    templateResolver: resolver
  });
  const templateContents = /* @__PURE__ */ new Map();
  for (const op of operations) {
    const resolved = resolver(op.source);
    if (resolved) {
      templateContents.set(op.source, resolved.content);
    } else if (existsSync7(op.source)) {
      templateContents.set(op.source, readFileSync6(op.source, "utf8"));
    }
  }
  const summary = await executeScaffold({
    operations,
    config: updatedConfig,
    projectDir,
    kdocVersion: getKdocVersion(),
    templateContents,
    force
  });
  if (summary.errors.length > 0) {
    console.error("Scaffold errors:");
    for (const e of summary.errors) console.error(`  - ${e.path}: ${e.error}`);
    return false;
  }
  const creates = summary.created.length;
  const merges = summary.merged.length;
  const skips = summary.skipped.length;
  console.log(`Done: ${creates} created, ${merges} merged, ${skips} skipped`);
  return true;
}
function createAddCommand() {
  const cmd = new Command2("add");
  cmd.description("Add a Knowledge area to an existing kdoc installation").argument("<area>", `Area to add (${KNOWN_AREAS.join(", ")})`).option("--package <name>", "Enable the area only for a configured package scope").option("--yes", "Non-interactive mode").option("--force", "Overwrite user-modified managed files without asking").option("--verbose", "Log each file operation as it runs").action(async (area, options) => {
    const projectDir = getProjectDir2();
    if (!configExists(projectDir)) {
      console.error("Error: No .kdoc.yaml found. Run `kdoc init` first.");
      process.exitCode = 1;
      return;
    }
    if (!KNOWN_AREAS.includes(area)) {
      console.error(
        `Error: Unknown area "${area}". Valid areas: ${KNOWN_AREAS.join(", ")}`
      );
      process.exitCode = 1;
      return;
    }
    try {
      const config = loadConfig(projectDir);
      if (!config) {
        console.error("Error: Failed to load .kdoc.yaml.");
        process.exitCode = 1;
        return;
      }
      let updatedConfig;
      if (options.package) {
        if (config.topology !== "monorepo") {
          console.error('Error: --package can only be used when topology is "monorepo".');
          process.exitCode = 1;
          return;
        }
        const packageConfig = config.packages?.[options.package];
        if (!packageConfig) {
          console.error(
            `Error: Unknown package "${options.package}". Valid packages: ${Object.keys(config.packages ?? {}).join(", ")}`
          );
          process.exitCode = 1;
          return;
        }
        const inheritedAreas = {
          ...config.areas,
          ...packageConfig.areas ?? {}
        };
        updatedConfig = {
          ...config,
          packages: {
            ...config.packages,
            [options.package]: {
              ...packageConfig,
              areas: {
                ...inheritedAreas,
                [area]: { enabled: true }
              }
            }
          }
        };
      } else {
        updatedConfig = {
          ...config,
          areas: {
            ...config.areas,
            [area]: { enabled: true }
          }
        };
      }
      const success = await runScopedScaffold(projectDir, updatedConfig, { force: !!options.force });
      if (success) {
        const dirName = AREA_DIR_MAP[area];
        if (dirName) {
          const knowledgeRoot = updatedConfig.root ?? "Knowledge";
          const baseDir = options.package ? join8(projectDir, knowledgeRoot, "packages", options.package) : join8(projectDir, knowledgeRoot);
          mkdirSync(join8(baseDir, dirName), { recursive: true });
        }
        writeConfig(projectDir, updatedConfig);
        console.log(
          options.package ? `Area "${area}" added successfully for package "${options.package}".` : `Area "${area}" added successfully.`
        );
      } else {
        process.exitCode = 1;
      }
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    }
  });
  return cmd;
}
function createAddPackCommand() {
  const cmd = new Command2("add-pack");
  cmd.description("Add a technology pack to an existing kdoc installation").argument("<pack>", `Pack to add (${KNOWN_PACKS.join(", ")})`).option("--yes", "Non-interactive mode").option("--dry-run", "Show what would be done without making changes").action(async (pack, options) => {
    const projectDir = getProjectDir2();
    if (!configExists(projectDir)) {
      console.error("Error: No .kdoc.yaml found. Run `kdoc init` first.");
      process.exitCode = 1;
      return;
    }
    if (!KNOWN_PACKS.includes(pack)) {
      console.error(
        `Error: Unknown pack "${pack}". Valid packs: ${KNOWN_PACKS.join(", ")}`
      );
      process.exitCode = 1;
      return;
    }
    try {
      const config = loadConfig(projectDir);
      if (!config) {
        console.error("Error: Failed to load .kdoc.yaml.");
        process.exitCode = 1;
        return;
      }
      const updatedConfig = {
        ...config,
        // Use Set to deduplicate — idempotent if pack already present
        packs: [.../* @__PURE__ */ new Set([...config.packs, pack])]
      };
      if (options.dryRun) {
        console.log(`[DRY RUN] Would add pack "${pack}" to config.`);
        console.log(`[DRY RUN] Would run scaffold with updated config.`);
        const packResult = await installPackAssets(pack, projectDir, updatedConfig, { dryRun: true });
        if (packResult.installed.length > 0) {
          console.log(`[DRY RUN] Pack assets to install:`);
          for (const f of packResult.installed) console.log(`  [CREATE  ] ${f}`);
        }
        if (packResult.skipped.length > 0) {
          console.log(`[DRY RUN] Pack assets already present:`);
          for (const f of packResult.skipped) console.log(`  [SKIP    ] ${f}`);
        }
        return;
      }
      const success = await runScopedScaffold(projectDir, updatedConfig, { force: !!options.force });
      if (success) {
        const packResult = await installPackAssets(pack, projectDir, updatedConfig, {
          force: !!options.force
        });
        if (packResult.errors.length > 0) {
          for (const e of packResult.errors) console.warn(`Warning: ${e}`);
        }
        writeConfig(projectDir, updatedConfig);
        const packInstalled = packResult.installed.length;
        const packSkipped = packResult.skipped.length;
        console.log(`Pack "${pack}" added successfully.${packInstalled > 0 ? ` ${packInstalled} assets installed, ${packSkipped} skipped.` : ""}`);
      } else {
        process.exitCode = 1;
      }
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    }
  });
  return cmd;
}
function createAddToolCommand() {
  const cmd = new Command2("add-tool");
  cmd.description("Add an AI tool integration to an existing kdoc installation").argument("<tool>", `Tool to add (${KNOWN_TOOLS.join(", ")})`).option("--yes", "Non-interactive mode").option("--force", "Overwrite user-modified managed files without asking").option("--dry-run", "Show what would be done without making changes").action(async (tool, options) => {
    const projectDir = getProjectDir2();
    if (!configExists(projectDir)) {
      console.error("Error: No .kdoc.yaml found. Run `kdoc init` first.");
      process.exitCode = 1;
      return;
    }
    if (!KNOWN_TOOLS.includes(tool)) {
      console.error(
        `Error: Unknown tool "${tool}". Valid tools: ${KNOWN_TOOLS.join(", ")}`
      );
      process.exitCode = 1;
      return;
    }
    try {
      const config = loadConfig(projectDir);
      if (!config) {
        console.error("Error: Failed to load .kdoc.yaml.");
        process.exitCode = 1;
        return;
      }
      const updatedConfig = {
        ...config,
        // Use Set to deduplicate — idempotent if tool already present
        tools: [.../* @__PURE__ */ new Set([...config.tools, tool])]
      };
      if (options.dryRun) {
        console.log(`[DRY RUN] Would add tool "${tool}" to config.`);
        console.log(`[DRY RUN] Would run scaffold with updated config.`);
        const toolResult = runToolInstaller(tool, projectDir, {
          dryRun: true,
          yes: !!options.yes
        });
        console.log(
          `[DRY RUN] Tool installer would create ${toolResult.manifest.created.length} file(s), merge ${toolResult.manifest.merged.length} file(s), and skip ${toolResult.manifest.skipped.length} file(s).`
        );
        for (const warning of toolResult.warnings) {
          console.warn(`Warning: ${warning}`);
        }
        return;
      }
      const success = await runScopedScaffold(projectDir, updatedConfig, { force: !!options.force });
      if (success) {
        writeConfig(projectDir, updatedConfig);
        const toolResult = runToolInstaller(tool, projectDir, {
          yes: !!options.yes
        });
        for (const warning of toolResult.warnings) {
          console.warn(`Warning: ${warning}`);
        }
        console.log(`Tool "${tool}" added successfully.`);
      } else {
        process.exitCode = 1;
      }
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    }
  });
  return cmd;
}

// src/commands/update.ts
import { Command as Command3 } from "commander";
import { existsSync as existsSync8, readFileSync as readFileSync7, renameSync, unlinkSync, copyFileSync as copyFileSync2 } from "fs";
import { join as join9, dirname as dirname4 } from "path";
import { fileURLToPath as fileURLToPath3 } from "url";
import fg2 from "fast-glob";
var __filename = fileURLToPath3(import.meta.url);
var __dirname3 = dirname4(__filename);
var SYNTHETIC_TEMPLATES2 = {
  "core/templates/gitkeep": "",
  "core/templates/claude-md-block.md": "kdoc Knowledge documentation toolkit is installed.\n\nRun `npx kdoc doctor` to check your setup.\n",
  "core/templates/agents-md-block.md": "kdoc Knowledge documentation toolkit is installed.\n\nRun `npx kdoc doctor` to check your setup.\n",
  "core/templates/gitignore-block": ".kdoc.backup/\n.kdoc.lock.tmp\n",
  "core/templates/package-json-scripts": JSON.stringify({ "kdoc:check": "npx kdoc doctor" })
};
function makeUpdateTemplateResolver() {
  const cliRoot = join9(__dirname3, "..", "..");
  const kdocRoot = join9(cliRoot, "..");
  const coreTemplatesDir = join9(kdocRoot, "core", "templates");
  const packsDir = join9(kdocRoot, "packs");
  return (templateName) => {
    if (templateName in SYNTHETIC_TEMPLATES2) {
      return { sourcePath: templateName, content: SYNTHETIC_TEMPLATES2[templateName] };
    }
    if (templateName.startsWith("core/templates/")) {
      const relFile = templateName.slice("core/templates/".length);
      const filePath = join9(coreTemplatesDir, relFile);
      if (existsSync8(filePath)) {
        return { sourcePath: templateName, content: readFileSync7(filePath, "utf8") };
      }
      return null;
    }
    const packsMatch = templateName.match(/^packs\/([^/]+)\/templates\/(.+)$/);
    if (packsMatch) {
      const [, packName, relFile] = packsMatch;
      const filePath = join9(packsDir, packName, "templates", relFile);
      if (existsSync8(filePath)) {
        return { sourcePath: templateName, content: readFileSync7(filePath, "utf8") };
      }
      return null;
    }
    return null;
  };
}
function deriveDesiredFiles2(config) {
  const files = [];
  const root = config.root ?? "Knowledge";
  const areas = config.areas ?? {};
  function addAreaFiles(prefix, scopeAreas) {
    if (scopeAreas["adr"]?.enabled) {
      files.push({ path: `${prefix}/ADR/README.md`, templateName: "core/templates/readme-adr.md" });
    }
    if (scopeAreas["tldr"]?.enabled) {
      files.push({ path: `${prefix}/TLDR/README.md`, templateName: "core/templates/readme-tldr.md" });
      for (const scope of scopeAreas["tldr"].scopes ?? []) {
        files.push({ path: `${prefix}/TLDR/${scope}/.gitkeep`, templateName: "core/templates/gitkeep" });
      }
    }
    if (scopeAreas["roadmap"]?.enabled) {
      files.push({ path: `${prefix}/Roadmap/README.md`, templateName: "core/templates/readme-roadmap.md" });
    }
    if (scopeAreas["context-pack"]?.enabled) {
      files.push({ path: `${prefix}/ContextPack.md`, templateName: "core/templates/context-pack.md" });
    }
    if (scopeAreas["agent-memory"]?.enabled) {
      files.push({ path: `${prefix}/AgentMemory/MEMORY.md`, templateName: "core/templates/memory.md" });
    }
    if (scopeAreas["guides"]?.enabled) {
      files.push({ path: `${prefix}/Guides/.gitkeep`, templateName: "core/templates/gitkeep" });
    }
    if (scopeAreas["runbooks"]?.enabled) {
      files.push({ path: `${prefix}/runbooks/.gitkeep`, templateName: "core/templates/gitkeep" });
    }
    if (scopeAreas["templates"]?.enabled) {
      files.push({ path: `${prefix}/Templates/.gitkeep`, templateName: "core/templates/gitkeep" });
    }
  }
  addAreaFiles(root, areas);
  if (config.topology === "monorepo" && config.packages) {
    for (const [pkgName, pkgConfig] of Object.entries(config.packages)) {
      const pkgAreas = pkgConfig.areas ?? areas;
      addAreaFiles(`${root}/packages/${pkgName}`, pkgAreas);
    }
  }
  if (config.topology === "vault" && config.categories) {
    for (const [catName] of Object.entries(config.categories)) {
      files.push({ path: `${root}/${catName}/README.md`, templateName: "core/templates/readme-category.md" });
    }
  }
  for (const tool of config.tools ?? []) {
    if (tool === "claude-code") {
      files.push({ path: "CLAUDE.md", templateName: "core/templates/claude-md-block.md" });
    }
    if (tool === "codex") {
      files.push({ path: "AGENTS.md", templateName: "core/templates/agents-md-block.md" });
    }
  }
  files.push({ path: ".gitignore", templateName: "core/templates/gitignore-block" });
  files.push({ path: "package.json", templateName: "core/templates/package-json-scripts" });
  return files;
}
function buildDesiredState(config, projectDir, templateResolver) {
  const resolver = templateResolver ?? makeUpdateTemplateResolver();
  const desired = deriveDesiredFiles2(config);
  const manifest = {};
  for (const { path, templateName } of desired) {
    const resolved = resolver(templateName);
    if (!resolved) continue;
    const currentTemplateHash = hashString(resolved.content);
    const absPath = join9(projectDir, path);
    let currentFileHash;
    if (existsSync8(absPath)) {
      try {
        currentFileHash = hashFile(absPath);
      } catch {
      }
    }
    manifest[path] = {
      template: templateName,
      currentTemplateHash,
      currentFileHash
    };
  }
  return manifest;
}
function diffDesiredState(lock, desired) {
  const ops = [];
  const templateToLockPath = /* @__PURE__ */ new Map();
  for (const [path, entry] of Object.entries(lock.files)) {
    templateToLockPath.set(entry.template, path);
  }
  const matchedLockPaths = /* @__PURE__ */ new Set();
  for (const [desiredPath, desiredEntry] of Object.entries(desired)) {
    const lockEntry = lock.files[desiredPath];
    if (lockEntry) {
      matchedLockPaths.add(desiredPath);
      if (lockEntry.action === "merged") {
        ops.push({ type: "SKIP", path: desiredPath });
        continue;
      }
      if (lockEntry.action === "created") {
        const templateChanged = lockEntry.templateHash !== desiredEntry.currentTemplateHash;
        if (!templateChanged) {
          ops.push({ type: "SKIP", path: desiredPath });
          continue;
        }
        const userModified = desiredEntry.currentFileHash !== void 0 && desiredEntry.currentFileHash !== lockEntry.hash;
        ops.push({ type: "UPDATE", path: desiredPath, template: desiredEntry.template, userModified });
      }
    } else {
      const oldPath = templateToLockPath.get(desiredEntry.template);
      if (oldPath && !matchedLockPaths.has(oldPath)) {
        matchedLockPaths.add(oldPath);
        const oldEntry = lock.files[oldPath];
        const userModified = oldEntry.action === "created" && desiredEntry.currentFileHash !== void 0 && desiredEntry.currentFileHash !== oldEntry.hash;
        ops.push({
          type: "RENAME",
          oldPath,
          newPath: desiredPath,
          template: desiredEntry.template,
          userModified
        });
      } else {
        ops.push({ type: "CREATE", path: desiredPath, template: desiredEntry.template });
      }
    }
  }
  for (const [lockPath, lockEntry] of Object.entries(lock.files)) {
    if (!matchedLockPaths.has(lockPath)) {
      if (lockEntry.action === "merged") {
        ops.push({ type: "SKIP", path: lockPath });
      } else {
        ops.push({ type: "REMOVE", path: lockPath, userModified: false });
      }
    }
  }
  return ops;
}
function backupFile2(projectDir, relativePath) {
  const absSource = join9(projectDir, relativePath);
  const absDest = join9(projectDir, ".kdoc.backup", relativePath);
  if (!existsSync8(absSource)) return;
  if (existsSync8(absDest)) return;
  ensureDir(dirname4(absDest));
  copyFileSync2(absSource, absDest);
}
async function executeUpdate(ops, lock, projectDir, config, templateResolver, opts) {
  const result = {
    created: [],
    updated: [],
    removed: [],
    renamed: [],
    skipped: [],
    errors: []
  };
  const updatedLock = {
    ...lock,
    files: { ...lock.files },
    kdocVersion: getKdocVersion(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  for (const op of ops) {
    try {
      if (op.type === "SKIP") {
        result.skipped.push(op.path);
        continue;
      }
      if (op.type === "CREATE") {
        const resolved = templateResolver(op.template);
        if (!resolved) {
          result.errors.push({ path: op.path, error: `Template not found: ${op.template}` });
          continue;
        }
        const renderValues = buildScopedRenderValues(
          config,
          projectDir,
          resolveRenderScopePath(config, op.path)
        );
        const { content: rendered } = renderTemplate(resolved.content, renderValues);
        const absPath = join9(projectDir, op.path);
        safeWriteFile(absPath, rendered);
        const fileHash = hashString(rendered);
        const templateHash = hashString(resolved.content);
        updatedLock.files[op.path] = {
          action: "created",
          hash: fileHash,
          templateHash,
          template: op.template
        };
        result.created.push(op.path);
        continue;
      }
      if (op.type === "UPDATE") {
        if (op.userModified && !opts.force) {
          result.skipped.push(op.path);
          continue;
        }
        const resolved = templateResolver(op.template);
        if (!resolved) {
          result.errors.push({ path: op.path, error: `Template not found: ${op.template}` });
          continue;
        }
        if (op.userModified) {
          backupFile2(projectDir, op.path);
        }
        const renderValues = buildScopedRenderValues(
          config,
          projectDir,
          resolveRenderScopePath(config, op.path)
        );
        const { content: rendered } = renderTemplate(resolved.content, renderValues);
        const absPath = join9(projectDir, op.path);
        safeWriteFile(absPath, rendered);
        const fileHash = hashString(rendered);
        const templateHash = hashString(resolved.content);
        updatedLock.files[op.path] = {
          action: "created",
          hash: fileHash,
          templateHash,
          template: op.template
        };
        result.updated.push(op.path);
        continue;
      }
      if (op.type === "REMOVE") {
        const absPath = join9(projectDir, op.path);
        if (existsSync8(absPath)) {
          const lockEntry = lock.files[op.path];
          if (lockEntry?.action === "created") {
            try {
              const currentHash = hashFile(absPath);
              if (currentHash !== lockEntry.hash && !opts.force) {
                result.skipped.push(op.path);
                continue;
              }
              if (currentHash !== lockEntry.hash) {
                backupFile2(projectDir, op.path);
              }
            } catch {
              result.skipped.push(op.path);
              continue;
            }
          }
          unlinkSync(absPath);
        }
        delete updatedLock.files[op.path];
        result.removed.push(op.path);
        continue;
      }
      if (op.type === "RENAME") {
        if (op.userModified && !opts.force) {
          result.skipped.push(op.oldPath);
          continue;
        }
        const resolved = templateResolver(op.template);
        if (!resolved) {
          result.errors.push({ path: op.newPath, error: `Template not found: ${op.template}` });
          continue;
        }
        const absOld = join9(projectDir, op.oldPath);
        const absNew = join9(projectDir, op.newPath);
        if (op.userModified) {
          backupFile2(projectDir, op.oldPath);
        }
        ensureDir(dirname4(absNew));
        if (existsSync8(absOld)) {
          renameSync(absOld, absNew);
        }
        const renderValues = buildScopedRenderValues(
          config,
          projectDir,
          resolveRenderScopePath(config, op.newPath)
        );
        const { content: rendered } = renderTemplate(resolved.content, renderValues);
        safeWriteFile(absNew, rendered);
        delete updatedLock.files[op.oldPath];
        const fileHash = hashString(rendered);
        const templateHash = hashString(resolved.content);
        updatedLock.files[op.newPath] = {
          action: "created",
          hash: fileHash,
          templateHash,
          template: op.template
        };
        result.renamed.push({ from: op.oldPath, to: op.newPath });
        continue;
      }
    } catch (err) {
      const path = "path" in op ? op.path : "newPath" in op ? op.newPath : "unknown";
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ path, error: message });
    }
  }
  writeLock(projectDir, updatedLock);
  return result;
}
function parseYamlFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: "", body: content, hasFrontmatter: false };
  return { frontmatter: match[1], body: match[2], hasFrontmatter: true };
}
function hasIntentField(frontmatter) {
  return /^intent\s*:/m.test(frontmatter);
}
function hasWhySection(body) {
  return /^##\s+(Why|Rationale)\b/m.test(body);
}
function addIntentToFrontmatter(frontmatter) {
  const lines = frontmatter.split("\n");
  lines.push('intent: ""');
  return lines.join("\n");
}
function addWhySection(body) {
  const lines = body.split("\n");
  let insertIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^#\s+/.test(lines[i])) {
      insertIndex = i + 1;
      break;
    }
  }
  const whyBlock = [
    "",
    "## Why",
    "",
    "> TODO: Describe why this exists and what intent it serves.",
    ""
  ];
  if (insertIndex >= 0) {
    lines.splice(insertIndex, 0, ...whyBlock);
  } else {
    lines.unshift(...whyBlock);
  }
  return lines.join("\n");
}
async function retrofitIntent(projectDir, config, dryRun) {
  const root = config.root ?? "Knowledge";
  const knowledgeDir = join9(projectDir, root);
  if (!existsSync8(knowledgeDir)) {
    console.log(`No Knowledge directory found at ${root}/`);
    return { modified: [], skipped: [] };
  }
  const mdFiles = fg2.sync("**/*.md", {
    cwd: knowledgeDir,
    absolute: false,
    ignore: ["**/node_modules/**", "**/.obsidian/**"]
  });
  const modified = [];
  const skipped = [];
  for (const relPath of mdFiles) {
    const absPath = join9(knowledgeDir, relPath);
    const content = readFileSync7(absPath, "utf8");
    const { frontmatter, body, hasFrontmatter } = parseYamlFrontmatter(content);
    if (!hasFrontmatter) {
      skipped.push(relPath);
      continue;
    }
    let newFrontmatter = frontmatter;
    let newBody = body;
    let changed = false;
    if (!hasIntentField(frontmatter)) {
      newFrontmatter = addIntentToFrontmatter(frontmatter);
      changed = true;
    }
    if (!hasWhySection(body)) {
      newBody = addWhySection(body);
      changed = true;
    }
    if (changed) {
      if (!dryRun) {
        const newContent = `---
${newFrontmatter}
---
${newBody}`;
        safeWriteFile(absPath, newContent);
      }
      modified.push(relPath);
    } else {
      skipped.push(relPath);
    }
  }
  return { modified, skipped };
}
function registerUpdateCommand(program) {
  const cmd = new Command3("update");
  cmd.description("Update scripts and templates to the current kdoc version").option("--force", "Overwrite user-modified files without prompting").option("--dry-run", "Show planned operations without executing them").option("--yes", "Non-interactive: skip prompts (conflicts default to Skip)").option("--retrofit-intent", "Add missing intent fields and ## Why sections to existing docs").action(async (opts) => {
    const cwd = process.env.KDOC_PROJECT_DIR ?? process.cwd();
    const config = loadConfig(cwd);
    if (!config) {
      console.error("Error: .kdoc.yaml not found. Run `kdoc init` first.");
      process.exitCode = 2;
      return;
    }
    if (opts.retrofitIntent) {
      console.log("kdoc update: scanning for missing intent/rationale...");
      const { modified, skipped } = await retrofitIntent(cwd, config, opts.dryRun ?? false);
      if (opts.dryRun) {
        console.log(`
[dry-run] Would modify ${modified.length} file(s):`);
        for (const f of modified) console.log(`  [MODIFY] ${f}`);
        console.log(`  Skipped: ${skipped.length} file(s) (already have intent or no frontmatter)`);
        console.log("\n[dry-run] No changes applied.");
      } else {
        console.log(`
Modified ${modified.length} file(s):`);
        for (const f of modified) console.log(`  [MODIFY] ${f}`);
        console.log(`Skipped: ${skipped.length} file(s)`);
      }
      return;
    }
    const lock = loadLock(cwd);
    if (!lock) {
      console.error("Error: .kdoc.lock not found. No installation found to update.");
      process.exitCode = 2;
      return;
    }
    const templateResolver = makeUpdateTemplateResolver();
    const desired = buildDesiredState(config, cwd, templateResolver);
    const ops = diffDesiredState(lock, desired);
    if (opts.dryRun) {
      const nonSkipOps2 = ops.filter((o) => o.type !== "SKIP");
      console.log("kdoc update: planned operations:");
      for (const op of ops) {
        if (op.type === "RENAME") {
          console.log(`  [${op.type.padEnd(6)}] ${op.oldPath} \u2192 ${op.newPath}`);
        } else {
          console.log(`  [${op.type.padEnd(6)}] ${op.path}`);
        }
      }
      if (nonSkipOps2.length === 0) console.log("  (no changes needed)");
      console.log("\n[dry-run] No changes applied.");
      return;
    }
    const nonSkipOps = ops.filter((o) => o.type !== "SKIP");
    const packToolResult = { created: [], skipped: [], errors: [] };
    for (const pack of config.packs ?? []) {
      const packResult = await installPackAssets(pack, cwd, config, { force: opts.force });
      packToolResult.created.push(...packResult.installed);
      packToolResult.skipped.push(...packResult.skipped);
      packToolResult.errors.push(...packResult.errors.map((error) => ({ path: pack, error })));
    }
    for (const tool of config.tools ?? []) {
      try {
        const toolResult = runToolInstaller(tool, cwd, { yes: opts.yes });
        packToolResult.created.push(...toolResult.manifest.created);
        packToolResult.skipped.push(...toolResult.manifest.skipped);
        for (const warning of toolResult.warnings) {
          console.warn(`Warning: ${warning}`);
        }
      } catch {
      }
    }
    if (nonSkipOps.length === 0 && packToolResult.created.length === 0 && packToolResult.errors.length === 0) {
      console.log("kdoc update: already up to date.");
      return;
    }
    const result = nonSkipOps.length > 0 ? await executeUpdate(ops, lock, cwd, config, templateResolver, {
      force: opts.force,
      yes: opts.yes
    }) : { created: [], updated: [], skipped: [], removed: [], renamed: [], errors: [] };
    for (const path of packToolResult.created) {
      if (!result.created.includes(path)) result.created.push(path);
    }
    result.errors.push(...packToolResult.errors);
    if (result.created.length > 0) {
      console.log(`Created ${result.created.length} file(s):`);
      for (const f of result.created) console.log(`  [CREATE] ${f}`);
    }
    if (result.updated.length > 0) {
      console.log(`Updated ${result.updated.length} file(s):`);
      for (const f of result.updated) console.log(`  [UPDATE] ${f}`);
    }
    if (result.removed.length > 0) {
      console.log(`Removed ${result.removed.length} file(s):`);
      for (const f of result.removed) console.log(`  [REMOVE] ${f}`);
    }
    if (result.renamed.length > 0) {
      console.log(`Renamed ${result.renamed.length} file(s):`);
      for (const r of result.renamed) console.log(`  [RENAME] ${r.from} \u2192 ${r.to}`);
    }
    if (result.skipped.length > 0) {
      console.log(`Skipped ${result.skipped.length} file(s) (user-modified, use --force to overwrite)`);
    }
    if (result.errors.length > 0) {
      console.error(`Errors (${result.errors.length}):`);
      for (const e of result.errors) console.error(`  [ERROR] ${e.path}: ${e.error}`);
      process.exitCode = 1;
    }
    console.log("kdoc update complete.");
  });
  program.addCommand(cmd);
}

// src/commands/create.ts
import { Command as Command4 } from "commander";
import { existsSync as existsSync9, readdirSync as readdirSync3 } from "fs";
import { basename as basename3, join as join10 } from "path";
import { readFileSync as readFileSync8 } from "fs";
import { dirname as dirname5 } from "path";
import { fileURLToPath as fileURLToPath4 } from "url";
import { parse as parseYaml } from "yaml";
var VALID_TYPES = [
  "adr",
  "tldr",
  "phase",
  "sub-phase",
  "flow-spec",
  "guide",
  "threat-model",
  "runbook",
  "test-map"
];
function validateCreateArgs(args) {
  if (!VALID_TYPES.includes(args.type)) {
    return { valid: false, error: `Unknown type "${args.type}". Valid types: ${VALID_TYPES.join(", ")}` };
  }
  if (!args.name || args.name.trim() === "") {
    return { valid: false, error: "Name is required. Use: kdoc create <type> <name>" };
  }
  const kebabRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  let warning;
  if (!kebabRegex.test(args.name)) {
    const slugified = slugify(args.name);
    warning = `Name "${args.name}" will be transformed to "${slugified}"`;
  }
  if (args.package && args.category) {
    return { valid: false, error: "Use either --package or --category, not both." };
  }
  if (args.type === "tldr" && !args.scope) {
    return { valid: false, error: "TLDR requires --scope flag. Example: kdoc create tldr my-feature --scope Admin" };
  }
  if (args.type === "sub-phase" && !args.parent) {
    return { valid: false, error: 'Sub-phase requires --parent flag. Example: kdoc create sub-phase "My Task" --parent 1' };
  }
  return { valid: true, warning };
}
function resolveAdrNumber(adrDir) {
  if (!existsSync9(adrDir)) return "0001";
  const entries = readdirSync3(adrDir);
  const numbers = entries.map((f) => {
    const match = f.match(/^ADR-(\d{4})-/);
    return match ? parseInt(match[1], 10) : 0;
  }).filter((n) => n > 0);
  const max = numbers.length > 0 ? Math.max(...numbers) : 0;
  return String(max + 1).padStart(4, "0");
}
function resolvePhaseNumber(phasesDir) {
  if (!existsSync9(phasesDir)) return 1;
  const entries = readdirSync3(phasesDir);
  const numbers = entries.map((f) => {
    const match = f.match(/^phase-(\d+)\.md$/);
    return match ? parseInt(match[1], 10) : 0;
  }).filter((n) => n > 0);
  return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
}
function resolveSubPhaseNumber(parentDir, parentNum) {
  if (!existsSync9(parentDir)) return 1;
  const entries = readdirSync3(parentDir);
  const prefix = `${parentNum}.`;
  const numbers = entries.map((f) => {
    if (f.startsWith(prefix) && f.endsWith(".md")) {
      const x = parseInt(f.slice(prefix.length, -3), 10);
      return isNaN(x) ? 0 : x;
    }
    const match = f.match(/^(\d+)\.md$/);
    return match ? parseInt(match[1], 10) : 0;
  }).filter((n) => n > 0);
  return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
}
function resolveDocumentSlug(type, name) {
  const slug = slugify(name);
  if (!slug) {
    throw new Error(`Unable to derive a filename slug for ${type} from "${name}".`);
  }
  return slug;
}
function buildAdrIntent(title) {
  const normalized = title.trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  const sentence = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return sentence.endsWith(".") ? sentence : `${sentence}.`;
}
function replaceFrontmatterField(content, field, value) {
  const serialized = JSON.stringify(value);
  const pattern = new RegExp(`^${field}:\\s*.*$`, "m");
  return pattern.test(content) ? content.replace(pattern, `${field}: ${serialized}`) : content;
}
function normalizeCreatedContent(type, content, options) {
  switch (type) {
    case "adr":
      return replaceFrontmatterField(content, "intent", buildAdrIntent(options.name));
    case "tldr":
      return replaceFrontmatterField(content, "id", `tldr-${options.slug}`);
    case "guide":
      return replaceFrontmatterField(content, "id", `guide-${options.slug}`);
    case "threat-model":
      return replaceFrontmatterField(content, "id", `tm-${options.slug}`);
    case "phase": {
      let result = content;
      if (options.phaseNum) {
        result = replaceFrontmatterField(result, "id", `phase-${options.phaseNum}`);
      }
      return result;
    }
    case "sub-phase": {
      let result = content;
      if (options.parent && options.subPhaseNum) {
        result = replaceFrontmatterField(result, "id", `${options.parent}.${options.subPhaseNum}`);
        result = replaceFrontmatterField(result, "parent_phase", `phase-${options.parent}`);
      }
      return result;
    }
    default:
      return content;
  }
}
function findDuplicateAdrPath(adrDir, slug) {
  if (!existsSync9(adrDir)) return null;
  for (const entry of readdirSync3(adrDir)) {
    const match = entry.match(/^ADR-\d{4}-(.+)\.md$/);
    if (!match) continue;
    if (slugify(match[1]) === slug) {
      return join10(adrDir, entry);
    }
  }
  return null;
}
function resolveCreatePath(type, name, opts) {
  const { scope, root, adrNumber, tldrScope, parent } = opts;
  const knowledgeScope = scope ?? {
    name: "root",
    type: "root",
    knowledgeRoot: root ?? "",
    areas: {}
  };
  const slug = resolveDocumentSlug(type, name);
  if (knowledgeScope.type === "category") {
    return join10(knowledgeScope.knowledgeRoot, `${slug}.md`);
  }
  switch (type) {
    case "adr":
      return knowledgePath(knowledgeScope, "adr", `ADR-${adrNumber}-${slug}.md`);
    case "tldr":
      return knowledgePath(knowledgeScope, "tldr", join10(tldrScope ?? "_noscope", `${slug}.md`));
    case "phase": {
      const phasesDir = knowledgePath(knowledgeScope, "roadmap", "phases");
      const phaseNum = resolvePhaseNumber(phasesDir);
      return join10(phasesDir, `phase-${phaseNum}.md`);
    }
    case "sub-phase": {
      const phasesDir = knowledgePath(knowledgeScope, "roadmap", "phases");
      const parentDir = join10(phasesDir, `phase-${parent}`);
      const subNum = resolveSubPhaseNumber(parentDir, parent);
      return join10(parentDir, `${parent}.${subNum}.md`);
    }
    case "flow-spec":
      return knowledgePath(knowledgeScope, "design", `${slug}-flow.md`);
    case "guide":
      return knowledgePath(knowledgeScope, "guides", `${slug}.md`);
    case "threat-model":
      return knowledgePath(knowledgeScope, "threat-models", `${slug}.md`);
    case "runbook":
      return knowledgePath(knowledgeScope, "runbooks", `${slug}.md`);
    case "test-map":
      return knowledgePath(knowledgeScope, "templates", `${slug}-test-map.md`);
    default:
      throw new Error(`Unknown type: ${type}`);
  }
}
function registerCreateCommand(program) {
  const cmd = new Command4("create");
  cmd.description("Create a new Knowledge document (adr, tldr, phase, sub-phase, flow-spec, guide, runbook, threat-model, test-map)").argument("<type>", "Document type to create").argument("[name]", "Document name (kebab-case)").option("--scope <scope>", "Scope for TLDR documents (required for tldr type)").option("--package <name>", "Create the document inside a configured monorepo package scope").option("--category <name>", "Create the document inside a configured vault category").option("--status <status>", "Initial status (default: proposed for ADR, draft for TLDR)").option("--parent <number>", "Parent phase number (required for sub-phase)").option("--dry-run", "Show what would be done without making changes").option("--yes", "Non-interactive mode").action(async (type, name, opts) => {
    const cwd = process.cwd();
    const args = {
      type,
      name: name ?? "",
      scope: opts.scope,
      status: opts.status,
      package: opts.package,
      category: opts.category,
      parent: opts.parent
    };
    const validation = validateCreateArgs(args);
    if (!validation.valid) {
      console.error(`Error: ${validation.error}`);
      process.exitCode = 1;
      return;
    }
    if (validation.warning) {
      console.warn(`Warning: ${validation.warning}`);
    }
    const config = loadConfig(cwd);
    if (!config) {
      console.error("Error: .kdoc.yaml not found. Run `kdoc init` first.");
      process.exitCode = 2;
      return;
    }
    if (opts.package && config.topology !== "monorepo") {
      console.error('Error: --package can only be used when topology is "monorepo".');
      process.exitCode = 1;
      return;
    }
    if (opts.category && config.topology !== "vault") {
      console.error('Error: --category can only be used when topology is "vault".');
      process.exitCode = 1;
      return;
    }
    let knowledgeScope;
    if (opts.package) {
      const packageScope = resolveScopeForPackage(config, cwd, opts.package);
      if (!packageScope) {
        console.error(
          `Error: Unknown package "${opts.package}". Valid packages: ${Object.keys(config.packages ?? {}).join(", ")}`
        );
        process.exitCode = 1;
        return;
      }
      knowledgeScope = packageScope;
    } else if (opts.category) {
      const categoryConfig = config.categories?.[opts.category];
      if (!categoryConfig) {
        console.error(
          `Error: Unknown category "${opts.category}". Valid categories: ${Object.keys(config.categories ?? {}).join(", ")}`
        );
        process.exitCode = 1;
        return;
      }
      knowledgeScope = {
        name: opts.category,
        type: "category",
        knowledgeRoot: join10(cwd, config.root, opts.category),
        areas: {}
      };
    } else if (config.topology === "vault") {
      console.error(
        `Error: Vault topology requires --category. Valid categories: ${Object.keys(config.categories ?? {}).join(", ")}`
      );
      process.exitCode = 1;
      return;
    } else {
      knowledgeScope = resolveRootScope(config, cwd);
    }
    let adrNumber;
    const normalizedName = name.trim();
    const documentSlug = resolveDocumentSlug(type, normalizedName);
    if (type === "adr") {
      const adrDir = knowledgePath(knowledgeScope, "adr");
      const duplicatePath = findDuplicateAdrPath(adrDir, documentSlug);
      if (duplicatePath) {
        console.error(`Error: ADR with the same title already exists: ${duplicatePath}`);
        process.exitCode = 1;
        return;
      }
      adrNumber = resolveAdrNumber(adrDir);
    }
    const outputPath = resolveCreatePath(type, normalizedName, {
      scope: knowledgeScope,
      adrNumber,
      tldrScope: opts.scope,
      parent: opts.parent
    });
    if (existsSync9(outputPath)) {
      console.error(`Error: File already exists: ${outputPath}`);
      process.exitCode = 1;
      return;
    }
    const templateContent = loadTemplate(type);
    const projectName = basename3(cwd) || "project";
    const defaultStatus = type === "adr" ? "proposed" : "draft";
    const values = {
      ID: adrNumber ?? "",
      NUMBER: adrNumber ?? "",
      NAME: type === "tldr" || type === "threat-model" || type === "flow-spec" ? documentSlug : normalizedName,
      TITLE: normalizedName,
      STATUS: opts.status ?? defaultStatus,
      SCOPE: knowledgeScope.type === "root" ? "root" : knowledgeScope.name,
      AREA: type,
      PROJECT_NAME: projectName,
      TYPE: type,
      KNOWLEDGE_ROOT: config.root,
      ...opts.category ? { CATEGORY_NAME: opts.category, CATEGORY_LABEL: config.categories?.[opts.category]?.label ?? opts.category } : {}
    };
    const { content, warnings } = renderTemplate(templateContent, values);
    for (const warning of warnings) {
      console.warn(`Warning: ${warning}`);
    }
    let phaseNum;
    let subPhaseNum;
    if (type === "phase") {
      const phasesDir = knowledgePath(knowledgeScope, "roadmap", "phases");
      phaseNum = resolvePhaseNumber(phasesDir);
    }
    if (type === "sub-phase" && opts.parent) {
      const phasesDir = knowledgePath(knowledgeScope, "roadmap", "phases");
      const parentDir = join10(phasesDir, `phase-${opts.parent}`);
      subPhaseNum = resolveSubPhaseNumber(parentDir, opts.parent);
    }
    const normalizedContent = normalizeCreatedContent(type, content, {
      name: normalizedName,
      slug: documentSlug,
      parent: opts.parent,
      phaseNum,
      subPhaseNum
    });
    if (opts.dryRun) {
      console.log(`[DRY RUN] Would create: ${outputPath}`);
      console.log("--- Preview ---");
      console.log(normalizedContent);
      console.log("--- End Preview ---");
      return;
    }
    safeWriteFile(outputPath, normalizedContent);
    console.log(`Created: ${outputPath}`);
    try {
      const __create_dir = dirname5(fileURLToPath4(import.meta.url));
      const enginePath = join10(__create_dir, "..", "..", "..", "core", "governance-engine.mjs");
      const engine = await import(enginePath);
      engine.emitDaemonEvent("kdoc.artifact_created", {
        type,
        name: normalizedName,
        path: outputPath
      });
    } catch {
    }
    try {
      const __create_dirname = dirname5(fileURLToPath4(import.meta.url));
      const schemaPath = join10(__create_dirname, "..", "..", "..", "core", "schema", "frontmatter-schemas.json");
      const schemas = JSON.parse(readFileSync8(schemaPath, "utf8"));
      const typeDef = schemas.types[type] ?? schemas.types[type.replace("-", "_")];
      if (typeDef) {
        const created = readFileSafe(outputPath) ?? "";
        const fmMatch = created.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (fmMatch) {
          const parsed = parseYaml(fmMatch[1]);
          if (parsed && typeof parsed === "object") {
            const missingFields = (typeDef.required ?? []).filter(
              (field) => !(field in parsed)
            );
            if (missingFields.length > 0) {
              console.warn(`Warning: Created file is missing required frontmatter fields: ${missingFields.join(", ")}`);
            }
            const status = parsed.status;
            if (status && typeDef.status_values && !typeDef.status_values.includes(status)) {
              console.warn(`Warning: Invalid status "${status}". Valid values: ${typeDef.status_values.join(", ")}`);
            }
            const secTier = parsed["security-tier"];
            if (secTier && schemas.field_values?.["security-tier"] && !schemas.field_values["security-tier"].includes(secTier)) {
              console.warn(`Warning: Invalid security-tier "${secTier}". Valid values: ${schemas.field_values["security-tier"].join(", ")}`);
            }
          }
        }
      }
    } catch {
    }
  });
  program.addCommand(cmd);
}

// src/commands/undo.ts
import { Command as Command5 } from "commander";
import { existsSync as existsSync10, readFileSync as readFileSync9, writeFileSync, rmSync } from "fs";
import { join as join11, dirname as dirname6, resolve } from "path";
function undoCreatedEntry(filePath, lockedHash, opts) {
  if (!existsSync10(filePath)) {
    return { path: filePath, action: "skipped", reason: "File does not exist" };
  }
  const currentHash = hashFile(filePath);
  const isUnmodified = currentHash === lockedHash;
  if (isUnmodified || opts.force) {
    rmSync(filePath, { force: true });
    pruneEmptyAncestors(filePath);
    return { path: filePath, action: "deleted" };
  }
  return { path: filePath, action: "kept", reason: "File was modified by user (--yes defaults to Keep)" };
}
function undoMergedMarkersEntry(filePath, markerName) {
  if (!existsSync10(filePath)) {
    return { path: filePath, action: "skipped", reason: "File does not exist" };
  }
  const content = readFileSync9(filePath, "utf8");
  const fileName = filePath.split("/").pop() ?? filePath;
  const startMarker = filePath.endsWith(".gitignore") ? `# kdoc:${markerName}:start` : `<!-- kdoc:${markerName}:start -->`;
  if (!content.includes(startMarker)) {
    return { path: filePath, action: "skipped", reason: "Marker block not found" };
  }
  const cleaned = removeMarkerBlock(content, fileName, markerName);
  if (cleaned.trim() === "") {
    rmSync(filePath, { force: true });
    pruneEmptyAncestors(filePath);
    return { path: filePath, action: "deleted" };
  }
  writeFileSync(filePath, cleaned, "utf8");
  return { path: filePath, action: "cleaned" };
}
function undoMergedPrefixEntry(filePath) {
  if (!existsSync10(filePath)) {
    return { path: filePath, action: "skipped", reason: "File does not exist" };
  }
  const content = readFileSync9(filePath, "utf8");
  const fileName = filePath.split("/").pop() ?? "";
  let cleaned;
  if (fileName === "turbo.json") {
    cleaned = removeTurboJsonTasks(content);
  } else {
    cleaned = removePackageJsonScripts(content);
  }
  writeFileSync(filePath, cleaned, "utf8");
  return { path: filePath, action: "cleaned" };
}
function pruneEmptyAncestors(filePath) {
  let current = dirname6(resolve(filePath));
  const root = resolve(process.cwd());
  while (current !== root && current !== dirname6(current)) {
    const deleted = deleteIfEmpty(current);
    if (!deleted) break;
    current = dirname6(current);
  }
}
function registerUndoCommand(program) {
  const cmd = new Command5("undo");
  cmd.description("Revert all kdoc scaffold operations (reads .kdoc.lock)").option("--keep-config", "Preserve .kdoc.yaml after undo (skip removal prompt)").option("--yes", "Non-interactive: modified files default to Keep, config removal defaults to No").option("--force", "Delete all managed files even if user-modified").option("--dry-run", "Show what would be done without making changes").action(async (opts) => {
    const cwd = process.cwd();
    const undoOpts = { force: !!opts.force, yes: !!opts.yes || !!opts.force, dryRun: !!opts.dryRun };
    const lock = loadLock(cwd);
    if (!lock) {
      console.error("Error: No .kdoc.lock or .kdoc.lock.tmp found. Nothing to undo.");
      process.exitCode = 1;
      return;
    }
    if (undoOpts.dryRun) {
      for (const filePath of Object.keys(lock.files)) {
        console.log(`[DRY RUN] Would delete: ${filePath}`);
      }
      return;
    }
    const results = [];
    for (const [filePath, entry] of Object.entries(lock.files)) {
      const absolutePath = join11(cwd, filePath);
      if (entry.action === "created") {
        results.push(undoCreatedEntry(absolutePath, entry.hash, undoOpts));
      } else if (entry.action === "merged" && entry.strategy === "markers") {
        const markerName = entry.markerName ?? "core";
        results.push(undoMergedMarkersEntry(absolutePath, markerName));
      } else if (entry.action === "merged" && entry.strategy === "prefix") {
        results.push(undoMergedPrefixEntry(absolutePath));
      }
    }
    const lockPath = join11(cwd, ".kdoc.lock");
    const lockTmpPath = join11(cwd, ".kdoc.lock.tmp");
    if (existsSync10(lockPath)) rmSync(lockPath);
    if (existsSync10(lockTmpPath)) rmSync(lockTmpPath);
    const backupDir = join11(cwd, ".kdoc.backup");
    if (existsSync10(backupDir)) rmSync(backupDir, { recursive: true });
    if (!opts.keepConfig && configExists(cwd)) {
      if (undoOpts.yes) {
        console.log(".kdoc.yaml kept (pass --force to remove, or delete manually).");
      } else {
        console.log(".kdoc.yaml kept. Remove manually if desired, or re-run with --force.");
      }
    }
    const deleted = results.filter((r) => r.action === "deleted").length;
    const cleaned = results.filter((r) => r.action === "cleaned").length;
    const kept = results.filter((r) => r.action === "kept").length;
    const skipped = results.filter((r) => r.action === "skipped").length;
    console.log(`
Undo complete: ${deleted} deleted, ${cleaned} cleaned, ${kept} kept, ${skipped} skipped.`);
    for (const r of results.filter((r2) => r2.action === "kept")) {
      console.log(`  [kept] ${r.path}: ${r.reason}`);
    }
  });
  program.addCommand(cmd);
}

// src/commands/selftest.ts
import { spawnSync as spawnSync2 } from "child_process";
import { mkdtempSync, readdirSync as readdirSync4, readFileSync as readFileSync10, writeFileSync as writeFileSync2, rmSync as rmSync2 } from "fs";
import { join as join12, relative as relative3 } from "path";
import { tmpdir } from "os";
import { createHash } from "crypto";
import { fileURLToPath as fileURLToPath5 } from "url";
function hashBuffer(buf) {
  return "sha256:" + createHash("sha256").update(buf).digest("hex");
}
function captureSnapshot(rootDir) {
  const snapshot = {};
  function walk(dir) {
    for (const entry of readdirSync4(dir, { withFileTypes: true })) {
      const fullPath = join12(dir, entry.name);
      const relPath = relative3(rootDir, fullPath);
      if (entry.isDirectory()) {
        snapshot[relPath] = { hash: "", size: 0, isDirectory: true };
        walk(fullPath);
      } else {
        const buf = readFileSync10(fullPath);
        snapshot[relPath] = {
          hash: hashBuffer(buf),
          size: buf.length,
          isDirectory: false
        };
      }
    }
  }
  walk(rootDir);
  return snapshot;
}
function diffSnapshots(a, b) {
  const added = Object.keys(b).filter((k) => !(k in a));
  const removed = Object.keys(a).filter((k) => !(k in b));
  const changed = Object.keys(a).filter((k) => k in b && a[k].hash !== b[k].hash);
  return { added, removed, changed };
}
var __selftest_filename = fileURLToPath5(import.meta.url);
function runKdoc(args, cwd) {
  const cliPath = __selftest_filename;
  const childEnv = { ...process.env };
  delete childEnv.VITEST;
  delete childEnv.KDOC_PROJECT_DIR;
  const result = spawnSync2("node", [cliPath, ...args], {
    encoding: "utf8",
    timeout: 3e4,
    cwd,
    env: childEnv
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? 1,
    error: result.error?.message ?? null,
    signal: result.signal ?? null
  };
}
function formatRunFailure(prefix, result) {
  const parts = [`${prefix} (exit ${result.status})`];
  if (result.signal) parts.push(`signal: ${result.signal}`);
  if (result.error) parts.push(`spawn error: ${result.error}`);
  const output = result.stderr || result.stdout;
  if (output) parts.push(output.slice(0, 200));
  return parts.join(": ");
}
function step(name, fn) {
  try {
    const outcome = fn();
    if (typeof outcome === "string") {
      return { name, passed: false, detail: outcome };
    }
    if (outcome) {
      return { name, passed: outcome.passed ?? false, detail: outcome.detail };
    }
    return { name, passed: true, detail: "ok" };
  } catch (e) {
    return { name, passed: false, detail: e instanceof Error ? e.message : String(e) };
  }
}
function runSelftest(opts) {
  const results = [];
  const tmpDir = mkdtempSync(join12(tmpdir(), "kdoc-selftest-"));
  try {
    const emptySnapshot = captureSnapshot(tmpDir);
    results.push({ name: "prepare", passed: true, detail: `temp dir: ${tmpDir}` });
    const initArgs = ["init", "--yes"];
    if (opts.pack) initArgs.push("--pack", opts.pack);
    if (opts.tools) initArgs.push("--tools", opts.tools);
    results.push(step("init", () => {
      const r = runKdoc(initArgs, tmpDir);
      if (opts.verbose) process.stderr.write(r.stdout + r.stderr);
      if (!r.ok) return formatRunFailure("init failed", r);
      return null;
    }));
    if (!results[results.length - 1].passed) return results;
    const initSnapshot = captureSnapshot(tmpDir);
    const initFileCount = Object.keys(initSnapshot).filter((k) => !initSnapshot[k].isDirectory).length;
    results.push({ name: "snapshot", passed: true, detail: `${initFileCount} files created` });
    results.push(step("doctor", () => {
      const r = runKdoc(["doctor", "--json"], tmpDir);
      if (opts.verbose) process.stderr.write(r.stdout + r.stderr);
      try {
        const report = JSON.parse(r.stdout);
        const fails = report.checks?.filter((c) => c.status === "fail") ?? [];
        if (fails.length > 0) {
          return { passed: true, detail: `${fails.length} check failures (non-blocking)` };
        }
        return null;
      } catch {
        return formatRunFailure("doctor produced invalid JSON", r);
      }
    }));
    results.push(step("mutate", () => {
      const files = Object.keys(initSnapshot).filter((k) => !initSnapshot[k].isDirectory);
      const mutations = [];
      const readmeFile = files.find((f) => f.includes("README.md")) ?? files[0];
      if (readmeFile) {
        const fullPath = join12(tmpDir, readmeFile);
        const content = readFileSync10(fullPath, "utf8");
        writeFileSync2(fullPath, content + "\n\n## User addition\nThis was added by the user.\n");
        mutations.push(`appended: ${readmeFile}`);
      }
      const otherFile = files.find((f) => f !== readmeFile && f.endsWith(".md"));
      if (otherFile) {
        const fullPath = join12(tmpDir, otherFile);
        const content = readFileSync10(fullPath, "utf8");
        writeFileSync2(fullPath, content + "\nModified by selftest.\n");
        mutations.push(`modified: ${otherFile}`);
      }
      const configFile = files.find((f) => f === ".kdoc.yaml");
      if (configFile) {
        const fullPath = join12(tmpDir, configFile);
        const content = readFileSync10(fullPath, "utf8");
        writeFileSync2(fullPath, content + "\n# User comment\n");
        mutations.push(`edited: ${configFile}`);
      }
      if (mutations.length === 0) return "no files to mutate";
      return null;
    }));
    results.push(step("re-init", () => {
      const r = runKdoc(initArgs, tmpDir);
      if (opts.verbose) process.stderr.write(r.stdout + r.stderr);
      if (r.status !== 0 && r.status !== 1) {
        return formatRunFailure("re-init failed", r);
      }
      const combinedOutput = `${r.stdout}
${r.stderr}`.toLowerCase();
      if (!/(conflict|modified|skip)/.test(combinedOutput)) {
        return "re-init did not report a conflict signal in stdout/stderr";
      }
      return null;
    }));
    results.push(step("undo", () => {
      const r = runKdoc(["undo", "--yes", "--force"], tmpDir);
      if (opts.verbose) process.stderr.write(r.stdout + r.stderr);
      if (!r.ok) return formatRunFailure("undo failed", r);
      return null;
    }));
    results.push(step("identity", () => {
      const afterUndo = captureSnapshot(tmpDir);
      const diff = diffSnapshots(emptySnapshot, afterUndo);
      const leftover = [...diff.added, ...diff.changed].filter((f) => f !== ".kdoc.yaml");
      if (leftover.length > 0) {
        return `undo left ${leftover.length} file(s) behind: ${leftover.slice(0, 5).join(", ")}${leftover.length > 5 ? "..." : ""}`;
      }
      if (diff.removed.length > 0) {
        return `undo removed ${diff.removed.length} pre-existing file(s): ${diff.removed.join(", ")}`;
      }
      return null;
    }));
  } finally {
    try {
      rmSync2(tmpDir, { recursive: true, force: true });
    } catch {
    }
  }
  return results;
}
function registerSelftestCommand(program) {
  program.command("selftest").description("Verify kdoc works correctly: init \u2192 doctor \u2192 mutate \u2192 undo \u2192 assert clean").option("--pack <pack>", "Pack to test with (default: none)").option("--tools <tools>", "Tools to test with (default: none)").option("--verbose", "Show command output during test").action((opts) => {
    console.log("kdoc selftest \u2014 round-trip verification\n");
    const results = runSelftest(opts);
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    for (const r of results) {
      const icon = r.passed ? "\u2713" : "\u2717";
      const line = `  ${icon} ${r.name}: ${r.detail}`;
      console.log(line);
    }
    console.log(`
${passed} passed, ${failed} failed`);
    if (failed > 0) {
      console.log("\nSelftest FAILED. Please report this issue.");
      process.exit(1);
    } else {
      console.log("\nSelftest PASSED. kdoc is working correctly.");
    }
  });
}

// src/commands/brief.ts
import { Command as Command6 } from "commander";
import { execFileSync } from "child_process";
import { join as join13 } from "path";
function getProjectDir3() {
  return process.env.KDOC_PROJECT_DIR ?? process.cwd();
}
function resolveSeedDoc(docs, options, projectDir, knowledgeRoot) {
  if (options.subPhase) {
    return resolveReference(options.subPhase, docs);
  }
  if (options.tldr) {
    return docs.find(
      (doc) => doc.type === "tldr" && (doc.path.toLowerCase().includes(options.tldr.toLowerCase()) || String(doc.frontmatter.title ?? "").toLowerCase() === options.tldr.toLowerCase())
    ) ?? resolveReference(options.tldr, docs);
  }
  if (options.next) {
    const roadmapStatus = resolveRoadmapStatus(join13(projectDir, knowledgeRoot, "Roadmap"));
    if (roadmapStatus.next) return resolveReference(roadmapStatus.next.subPhase.id, docs);
  }
  return null;
}
function writeClipboard(content) {
  execFileSync("pbcopy", { input: content });
}
function registerBriefCommand(program) {
  const cmd = new Command6("brief");
  cmd.description("Compile an implementation-ready Knowledge brief").option("--sub-phase <id>", "Generate a brief for a roadmap sub-phase").option("--tldr <name>", "Generate a brief for a TLDR document").option("--next", "Generate a brief for the next unblocked roadmap sub-phase").option("--format <format>", "markdown|json|clipboard", "markdown").option("--output <path>", "Write the brief to a file").option("--depth <n>", "Graph resolution depth", "2").option("--yes", "Non-interactive mode").action((options) => {
    const projectDir = getProjectDir3();
    const config = loadConfig(projectDir);
    if (!config) {
      console.error("Error: .kdoc.yaml not found. Run `kdoc init` first.");
      process.exitCode = 1;
      return;
    }
    const targetCount = [options.subPhase, options.tldr, options.next].filter(Boolean).length;
    if (targetCount !== 1) {
      console.error("Error: choose exactly one of --sub-phase, --tldr, or --next.");
      process.exitCode = 1;
      return;
    }
    const knowledgeRoot = config.root ?? "Knowledge";
    const docs = parseKnowledgeDocs(projectDir, knowledgeRoot);
    writeKnowledgeJsonl(projectDir, docs, knowledgeRoot);
    const seed = resolveSeedDoc(docs, options, projectDir, knowledgeRoot);
    if (!seed) {
      console.error("Error: could not resolve the requested Knowledge target.");
      process.exitCode = 1;
      return;
    }
    const depth = Number.parseInt(String(options.depth ?? "2"), 10);
    const resolved = resolveDocumentTree(seed, docs, Number.isNaN(depth) ? 2 : depth);
    const brief = assembleBrief(seed, resolved, docs);
    let output = brief.markdown;
    if (options.format === "json") {
      output = JSON.stringify(
        {
          target: seed.path,
          coverage: brief.coverage,
          markdown: brief.markdown
        },
        null,
        2
      );
    } else if (options.format === "clipboard") {
      try {
        writeClipboard(brief.markdown);
        output = "Copied brief to clipboard.\n";
      } catch {
        output = brief.markdown;
      }
    }
    if (options.output) {
      safeWriteFile(options.output, brief.markdown);
    }
    if (!options.output || options.format !== "clipboard") {
      process.stdout.write(output.endsWith("\n") ? output : `${output}
`);
    }
  });
  program.addCommand(cmd);
}

// src/commands/roadmap.ts
import { Command as Command7 } from "commander";
import { join as join14 } from "path";
import { existsSync as existsSync12 } from "fs";

// src/roadmap/dashboard.ts
import { readFileSync as readFileSync11, existsSync as existsSync11 } from "fs";
var AUTOGEN_START = "<!-- ROADMAP_AUTOGEN:START -->";
var AUTOGEN_END = "<!-- ROADMAP_AUTOGEN:END -->";
function statusIcon(status) {
  switch (status) {
    case "completed":
    case "completed_with_notes":
      return "\u2705";
    case "in_progress":
      return "\u{1F504}";
    case "blocked":
      return "\u{1F6AB}";
    default:
      return "\u23F3";
  }
}
function formatProgress(phase) {
  const total = phase.subPhases.length || phase.workUnitsTotal;
  if (total === 0) return "\u2014";
  const done = phase.subPhases.filter((s) => s.status === "completed").length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  return `${done}/${total} (${pct}%)`;
}
function findNextUp(phase, graph) {
  return phase.subPhases.filter((s) => s.status === "pending" || s.status === "in_progress").filter((s) => {
    const deps = graph.edges.get(s.id) ?? [];
    return deps.every((d) => {
      const node = graph.nodes.get(d);
      if (!node) return true;
      return "status" in node && (node.status === "completed" || node.status === "completed_with_notes");
    });
  }).map((s) => `[[${s.id}]]`).slice(0, 3);
}
function generateDashboardContent(phases, graph) {
  const lines = [];
  lines.push("## Progress Dashboard");
  lines.push("");
  lines.push(`**Last generated**: ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push("| Phase | Name | Status | Progress | Blocked By | Next Up |");
  lines.push("|-------|------|--------|----------|-----------|---------|");
  for (const phase of phases) {
    const num = phase.id.replace("phase-", "");
    const status = `${statusIcon(phase.status)} ${phase.status}`;
    const progress = formatProgress(phase);
    const blockedBy = phase.dependsOn.length > 0 ? phase.dependsOn.join(", ") : "\u2014";
    const nextUp = findNextUp(phase, graph);
    const nextStr = nextUp.length > 0 ? nextUp.join(", ") : "\u2014";
    lines.push(`| ${num} | ${phase.name} | ${status} | ${progress} | ${blockedBy} | ${nextStr} |`);
  }
  const activePhase = phases.find((p) => p.status === "in_progress");
  if (activePhase && activePhase.subPhases.length > 0) {
    const waves = getExecutionWaves(graph);
    const phaseSubIds = new Set(activePhase.subPhases.map((s) => s.id));
    lines.push("");
    lines.push(`### Execution Waves (${activePhase.name})`);
    for (const wave of waves) {
      const phaseWaveItems = wave.items.filter((id) => phaseSubIds.has(id));
      if (phaseWaveItems.length === 0) continue;
      const itemNames = phaseWaveItems.map((id) => {
        const sub = activePhase.subPhases.find((s) => s.id === id);
        return sub ? `[[${sub.id}]]` : id;
      });
      lines.push(`- **Wave ${wave.number}**: ${itemNames.join(", ")}`);
    }
  }
  const criticalPath = getCriticalPath(graph);
  if (criticalPath.length > 1) {
    lines.push("");
    lines.push("### Critical Path");
    lines.push(criticalPath.join(" \u2192 "));
  }
  lines.push("");
  return lines.join("\n");
}
function writeDashboard(readmePath, dashboardContent) {
  let existing = "";
  if (existsSync11(readmePath)) {
    existing = readFileSync11(readmePath, "utf8");
  }
  const startIdx = existing.indexOf(AUTOGEN_START);
  const endIdx = existing.indexOf(AUTOGEN_END);
  let updated;
  if (startIdx !== -1 && endIdx !== -1) {
    updated = existing.slice(0, startIdx) + AUTOGEN_START + "\n" + dashboardContent + AUTOGEN_END + existing.slice(endIdx + AUTOGEN_END.length);
  } else {
    updated = existing.trimEnd() + "\n\n" + AUTOGEN_START + "\n" + dashboardContent + AUTOGEN_END + "\n";
  }
  safeWriteFile(readmePath, updated);
}

// src/commands/roadmap.ts
function getProjectDir4() {
  return process.env.KDOC_PROJECT_DIR ?? process.cwd();
}
function registerRoadmapCommand(program) {
  const roadmap = new Command7("roadmap");
  roadmap.description("Roadmap dependency graph, dashboard, and next-step queries");
  roadmap.command("dashboard").description("Generate or update the roadmap progress dashboard").option("--yes", "Non-interactive mode").action(async () => {
    const projectDir = getProjectDir4();
    const config = loadConfig(projectDir);
    if (!config) {
      console.error("Error: .kdoc.yaml not found. Run `kdoc init` first.");
      process.exitCode = 2;
      return;
    }
    const roadmapDir = join14(projectDir, config.root, "Roadmap");
    if (!existsSync12(roadmapDir)) {
      console.error(`Error: Roadmap directory not found at ${config.root}/Roadmap/`);
      process.exitCode = 1;
      return;
    }
    try {
      const phases = parseRoadmap(roadmapDir);
      if (phases.length === 0) {
        console.log("No phases found in Roadmap/phases/.");
        return;
      }
      const graph = buildDependencyGraph(phases);
      const content = generateDashboardContent(phases, graph);
      const readmePath = join14(roadmapDir, "README.md");
      writeDashboard(readmePath, content);
      console.log(`Dashboard updated: ${config.root}/Roadmap/README.md`);
      console.log(`  ${phases.length} phase(s), ${phases.reduce((n, p) => n + p.subPhases.length, 0)} sub-phase(s)`);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    }
  });
  roadmap.command("next").description("Show the next unblocked sub-phase with full context").option("--json", "Output as JSON").option("--all", "Show all unblocked items, not just the first").option("--yes", "Non-interactive mode").action(async (opts) => {
    const projectDir = getProjectDir4();
    const config = loadConfig(projectDir);
    if (!config) {
      console.error("Error: .kdoc.yaml not found. Run `kdoc init` first.");
      process.exitCode = 2;
      return;
    }
    const roadmapDir = join14(projectDir, config.root, "Roadmap");
    if (!existsSync12(roadmapDir)) {
      console.error(`Error: Roadmap directory not found at ${config.root}/Roadmap/`);
      process.exitCode = 1;
      return;
    }
    try {
      const phases = parseRoadmap(roadmapDir);
      if (phases.length === 0) {
        console.log("No phases found in Roadmap/phases/.");
        return;
      }
      const graph = buildDependencyGraph(phases);
      const results = getNextUnblocked(phases, graph);
      if (results.length === 0) {
        console.log("All sub-phases are completed or blocked. Nothing to do next.");
        return;
      }
      if (opts.json) {
        const items = opts.all ? results : [results[0]];
        console.log(formatNextAsJson(items));
      } else {
        const items = opts.all ? results : [results[0]];
        for (const item of items) {
          console.log(formatNextAsMarkdown(item));
        }
      }
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    }
  });
  program.addCommand(roadmap);
}

// src/commands/mcp.ts
import { Command as Command8 } from "commander";
function registerMcpCommand(program) {
  const cmd = new Command8("mcp");
  cmd.description("Start the kdoc MCP server (stdio transport)").option("--project <dir>", "Project directory (defaults to cwd)").action(async () => {
    const { startServer, parseProjectDir } = await import("./server-FJGIFZNG.js");
    const projectDir = parseProjectDir(process.argv, process.cwd());
    await startServer(projectDir);
  });
  program.addCommand(cmd);
}

// src/commands/reconcile.ts
import { Command as Command9 } from "commander";

// src/reconcile/report.ts
var TIER_ORDER = ["auto-fix", "needs-approval", "report-only"];
var STATUS_ORDER = ["applied", "skipped", "failed"];
function groupByTier(findings) {
  const grouped = /* @__PURE__ */ new Map();
  for (const tier of TIER_ORDER) {
    grouped.set(tier, findings.filter((finding) => finding.tier === tier));
  }
  return grouped;
}
function groupByFile(items) {
  const grouped = /* @__PURE__ */ new Map();
  for (const item of items) {
    const current = grouped.get(item.filePath) ?? [];
    current.push(item);
    grouped.set(item.filePath, current);
  }
  return new Map([...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
function renderFindingLine(finding) {
  const reason = finding.code === "BROKEN_WIKILINK" && finding.context.candidates.length !== 1 ? ` reason: ${finding.context.candidates.length === 0 ? "no deterministic target found" : `ambiguous candidates (${finding.context.candidates.join(", ")})`}` : "";
  return `  - [${finding.code}] ${finding.message}${reason}`;
}
function formatFindingReport(findings) {
  if (findings.length === 0) {
    return "No pending repairs.";
  }
  const lines = [`Pending repairs: ${findings.length}`];
  const byTier = groupByTier(findings);
  for (const tier of TIER_ORDER) {
    const tierFindings = byTier.get(tier) ?? [];
    if (tierFindings.length === 0) continue;
    lines.push("", `${tier} (${tierFindings.length})`);
    for (const [filePath, fileFindings] of groupByFile(tierFindings)) {
      lines.push(`- ${filePath}`);
      for (const finding of fileFindings) {
        lines.push(renderFindingLine(finding));
      }
    }
  }
  return lines.join("\n");
}
function renderResultLine(result) {
  const status = result.status.toUpperCase();
  const reason = result.reason ? ` reason: ${result.reason}` : "";
  return `  - ${status} [${result.finding.code}] ${result.finding.message}${reason}`;
}
function formatRepairResults(results) {
  if (results.length === 0) {
    return "No repairs executed.";
  }
  const lines = ["Repair results"];
  for (const status of STATUS_ORDER) {
    const statusResults = results.filter((result) => result.status === status);
    if (statusResults.length === 0) continue;
    lines.push("", `${status} (${statusResults.length})`);
    for (const [filePath, fileResults] of groupByFile(
      statusResults.map((result) => ({ ...result, filePath: result.finding.filePath }))
    )) {
      lines.push(`- ${filePath}`);
      for (const result of fileResults) {
        lines.push(renderResultLine(result));
      }
    }
  }
  return lines.join("\n");
}

// src/commands/reconcile.ts
function getProjectDir5() {
  return process.env.KDOC_PROJECT_DIR ?? process.cwd();
}
function resolveMode(options) {
  const requestedModes = [
    options.check ? "check" : null,
    options.plan ? "plan" : null,
    options.fix ? "fix" : null
  ].filter(Boolean);
  if (requestedModes.length === 0) {
    return "check";
  }
  if (requestedModes.length > 1) {
    return null;
  }
  return requestedModes[0];
}
function printJson(payload) {
  console.log(JSON.stringify(payload, null, 2));
}
function registerReconcileCommand(program) {
  const cmd = new Command9("reconcile");
  cmd.description("Report or repair deterministic Knowledge drift").option("--check", "Report pending repairs without modifying files").option("--plan", "Write a machine-readable repair plan to .kdoc-reconcile-plan.json").option("--fix", "Apply eligible repairs").option("--approve", "Include needs-approval repairs when used with --fix").option("--json", "Print machine-readable output").option("--area <name>", "Limit to a Knowledge area").option("--package <name>", "Limit to a package scope").option("--path <path>", "Limit to a path prefix").action(async (options, command) => {
    const mode = resolveMode(options);
    if (mode === null) {
      console.error("Error: choose at most one of --check, --plan, or --fix.");
      process.exitCode = 2;
      return;
    }
    if (options.approve && mode !== "fix") {
      console.error("Error: --approve requires --fix.");
      process.exitCode = 2;
      return;
    }
    const projectDir = getProjectDir5();
    const config = loadConfig(projectDir);
    if (!config) {
      console.error("Error: .kdoc.yaml not found. Run `kdoc init` first.");
      process.exitCode = 1;
      return;
    }
    const dryRun = (command.parent?.opts() ?? {}).dryRun ?? false;
    const scope = { area: options.area, package: options.package, path: options.path };
    if (mode === "plan") {
      const outputPath = dryRun ? void 0 : ".kdoc-reconcile-plan.json";
      const result = await runReconcilePlan(projectDir, config, scope, outputPath);
      if (options.json) {
        printJson(result.plan);
      } else {
        if (dryRun) {
          console.log("[DRY RUN] Would write plan to .kdoc-reconcile-plan.json");
        } else {
          console.log("Plan written to .kdoc-reconcile-plan.json");
        }
        console.log(`  auto-fix:       ${result.plan.summary.autoFix}`);
        console.log(`  needs-approval: ${result.plan.summary.needsApproval}`);
        console.log(`  report-only:    ${result.plan.summary.reportOnly}`);
        console.log(`  total findings: ${result.plan.findings.length}`);
      }
      process.exitCode = result.findings.length > 0 ? 1 : 0;
      return;
    }
    if (mode === "check") {
      const result = await runReconcileCheck(projectDir, config, scope);
      if (result.warnings.length > 0 && !options.json) {
        for (const w of result.warnings) {
          console.error(`Warning: ${w}`);
        }
      }
      if (options.json) {
        printJson({
          findings: result.findings,
          warnings: result.warnings,
          summary: {
            ...result.plan.summary,
            total: result.findings.length
          }
        });
      } else {
        console.log(formatFindingReport(result.findings));
      }
      process.exitCode = result.findings.length > 0 ? 1 : 0;
      return;
    }
    try {
      const result = await runReconcileFix(projectDir, config, scope, {
        approve: options.approve,
        dryRun
      });
      if (result.warnings.length > 0 && !options.json) {
        for (const w of result.warnings) {
          console.error(`Warning: ${w}`);
        }
      }
      if (options.json) {
        printJson({
          results: result.results,
          warnings: result.warnings,
          summary: {
            applied: result.results.filter((r) => r.status === "applied").length,
            skipped: result.results.filter((r) => r.status === "skipped").length,
            failed: result.results.filter((r) => r.status === "failed").length
          }
        });
      } else {
        console.log(formatRepairResults(result.results));
      }
      const hasFailures = result.results.some((r) => r.status === "failed");
      process.exitCode = hasFailures || result.deferredCount > 0 ? 1 : 0;
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  });
  program.addCommand(cmd);
}

// src/index.ts
var __dirname4 = dirname8(fileURLToPath6(import.meta.url));
function getVersion() {
  try {
    const pkgPath = join15(__dirname4, "..", "package.json");
    const pkg = JSON.parse(readFileSync12(pkgPath, "utf8"));
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}
function buildProgram() {
  const program = new Command10();
  program.name("kdoc").description("Knowledge documentation toolkit \u2014 scaffold, maintain, and govern project docs").version(getVersion(), "-v, --version", "Print the current version").enablePositionalOptions().option("--yes", "Non-interactive: skip all prompts and use detected defaults").option("--force", "Overwrite user-modified content without asking (implies --yes)").option("--dry-run", "Show what would be done without making changes").option("--verbose", "Log each file operation as it runs");
  program.addCommand(createInitCommand());
  program.addCommand(createAddCommand());
  program.addCommand(createAddPackCommand());
  program.addCommand(createAddToolCommand());
  registerUpdateCommand(program);
  registerDoctorCommand(program);
  registerCreateCommand(program);
  registerUndoCommand(program);
  registerSelftestCommand(program);
  registerBriefCommand(program);
  registerGenerateCommand(program);
  registerReconcileCommand(program);
  registerRoadmapCommand(program);
  registerMcpCommand(program);
  return program;
}
var isMainModule = process.argv[1] && fileURLToPath6(import.meta.url) === process.argv[1];
if (isMainModule) {
  buildProgram().parse();
}
export {
  buildProgram
};
//# sourceMappingURL=index.js.map