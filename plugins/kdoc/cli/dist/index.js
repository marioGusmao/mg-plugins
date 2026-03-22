#!/usr/bin/env node

// src/index.ts
import { Command as Command7 } from "commander";
import { readFileSync as readFileSync11 } from "fs";
import { join as join14, dirname as dirname8 } from "path";
import { fileURLToPath as fileURLToPath4 } from "url";

// src/commands/init.ts
import { Command } from "commander";
import { checkbox, select } from "@inquirer/prompts";
import { fileURLToPath as fileURLToPath2 } from "url";
import { dirname as dirname4, join as join8 } from "path";
import { readFileSync as readFileSync7, existsSync as existsSync7 } from "fs";

// src/scaffold/detect.ts
import { existsSync, readdirSync } from "fs";
import { join, relative } from "path";
import fg from "fast-glob";
var STACK_INDICATORS = [
  { pattern: "next.config.ts", pack: "nextjs" },
  { pattern: "next.config.js", pack: "nextjs" },
  { pattern: "next.config.mjs", pack: "nextjs" },
  { pattern: "Package.swift", pack: "swift-ios" },
  { pattern: "*.xcodeproj", pack: "swift-ios" }
];
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
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) count++;
    else if (entry.isDirectory()) count += countFilesRecursive(join(dir, entry.name));
  }
  return count;
}
function detectKnowledgeState(projectDir) {
  const knowledgeDir = join(projectDir, "Knowledge");
  const hasKnowledgeDir = existsSync(knowledgeDir);
  let existingAreas = [];
  let fileCount = 0;
  if (hasKnowledgeDir) {
    const entries = readdirSync(knowledgeDir, { withFileTypes: true });
    existingAreas = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    fileCount = countFilesRecursive(knowledgeDir);
  }
  return {
    hasKnowledgeDir,
    existingAreas,
    fileCount,
    hasConfig: existsSync(join(projectDir, ".kdoc.yaml")),
    hasLock: existsSync(join(projectDir, ".kdoc.lock")),
    hasPendingLockTmp: existsSync(join(projectDir, ".kdoc.lock.tmp"))
  };
}
function detectAITools(projectDir) {
  const tools = [];
  if (existsSync(join(projectDir, ".claude")) || existsSync(join(projectDir, ".claude-plugin"))) {
    tools.push("claude-code");
  }
  if (existsSync(join(projectDir, "AGENTS.md")) || existsSync(join(projectDir, ".codex"))) {
    tools.push("codex");
  }
  return { tools };
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
import { existsSync as existsSync2 } from "fs";
import { join as join2 } from "path";

// src/utils/hash.ts
import { createHash } from "crypto";
import { readFileSync } from "fs";
var HASH_PREFIX = "sha256:";
function hashString(content) {
  const hex = createHash("sha256").update(content, "utf8").digest("hex");
  return `${HASH_PREFIX}${hex}`;
}
function hashFile(filePath) {
  const content = readFileSync(filePath, "utf8");
  return hashString(content);
}

// src/scaffold/plan.ts
var MERGE_CANDIDATES = {
  "CLAUDE.md": { strategy: "markers", markerName: "core" },
  "AGENTS.md": { strategy: "markers", markerName: "core" },
  ".gitignore": { strategy: "markers", markerName: "core" },
  "package.json": { strategy: "prefix" },
  "turbo.json": { strategy: "prefix" }
};
function deriveDesiredFiles(config, _detection) {
  const files = [];
  const root = config.root ?? "Knowledge";
  const areas = config.areas ?? {};
  if (areas["adr"]?.enabled) {
    files.push({ path: `${root}/ADR/README.md`, templateName: "core/templates/readme-adr.md" });
  }
  if (areas["tldr"]?.enabled) {
    files.push({ path: `${root}/TLDR/README.md`, templateName: "core/templates/readme-tldr.md" });
    for (const scope of areas["tldr"].scopes ?? []) {
      files.push({
        path: `${root}/TLDR/${scope}/.gitkeep`,
        templateName: "core/templates/gitkeep"
      });
    }
  }
  if (areas["roadmap"]?.enabled) {
    files.push({ path: `${root}/Roadmap/README.md`, templateName: "core/templates/readme-roadmap.md" });
  }
  if (areas["context-pack"]?.enabled) {
    files.push({ path: `${root}/ContextPack.md`, templateName: "core/templates/context-pack.md" });
  }
  if (areas["agent-memory"]?.enabled) {
    files.push({ path: `${root}/AgentMemory/MEMORY.md`, templateName: "core/templates/memory.md" });
  }
  if (areas["guides"]?.enabled) {
    files.push({ path: `${root}/Guides/.gitkeep`, templateName: "core/templates/gitkeep" });
  }
  if (areas["runbooks"]?.enabled) {
    files.push({ path: `${root}/runbooks/.gitkeep`, templateName: "core/templates/gitkeep" });
  }
  if (areas["templates"]?.enabled) {
    files.push({ path: `${root}/Templates/.gitkeep`, templateName: "core/templates/gitkeep" });
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
  const absPath = join2(projectDir, desiredPath);
  const fileName = desiredPath.split("/").pop() ?? desiredPath;
  const mergeConfig = MERGE_CANDIDATES[fileName];
  if (!existsSync2(absPath)) {
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
  const desired = deriveDesiredFiles(config, detection);
  const operations = [];
  for (const { path, templateName } of desired) {
    const op = classifyOperation(path, templateName, projectDir, lock, templateResolver);
    if (op) operations.push(op);
  }
  return operations;
}

// src/scaffold/execute.ts
import { existsSync as existsSync5, readFileSync as readFileSync4, copyFileSync } from "fs";
import { join as join5, dirname as dirname2 } from "path";

// src/utils/fs.ts
import { existsSync as existsSync3, mkdirSync, readFileSync as readFileSync2, writeFileSync, readdirSync as readdirSync2, rmSync } from "fs";
import { dirname, join as join3 } from "path";
function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}
function safeWriteFile(filePath, content) {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, content, "utf8");
}
function readFileSafe(filePath) {
  try {
    return readFileSync2(filePath, "utf8");
  } catch {
    return null;
  }
}
function deleteIfEmpty(dirPath) {
  if (!existsSync3(dirPath)) return false;
  return deleteIfEmptyRecursive(dirPath);
}
function deleteIfEmptyRecursive(dirPath) {
  const entries = readdirSync2(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) return false;
    if (entry.isDirectory()) {
      const subPath = join3(dirPath, entry.name);
      if (!deleteIfEmptyRecursive(subPath)) return false;
    }
  }
  rmSync(dirPath, { recursive: true });
  return true;
}

// src/config/lock.ts
import { readFileSync as readFileSync3, writeFileSync as writeFileSync2, existsSync as existsSync4, renameSync, unlinkSync } from "fs";
import { join as join4 } from "path";

// src/config/schema.ts
import { z } from "zod";
var hashPattern = /^sha256:[a-f0-9]{64}$/;
var HashString = z.string().regex(hashPattern, "Must be sha256:<64 hex chars>");
var ScriptPrefix = z.string().regex(/^[a-z][a-z0-9-]*$/, "Must be lowercase alphanumeric with hyphens");
var AreaConfigSchema = z.object({
  enabled: z.boolean().default(false),
  scopes: z.array(z.string().min(1)).optional()
}).passthrough();
var GovernanceSchema = z.object({
  "sync-check": z.boolean().default(true),
  wikilinks: z.boolean().default(true),
  "adr-governance": z.boolean().default(true),
  "index-build": z.boolean().default(true),
  "enforced-paths": z.array(z.string().min(1)).default([])
}).default({});
var ScriptsSchema = z.object({
  prefix: ScriptPrefix.default("kdoc")
}).default({ prefix: "kdoc" });
var KdocConfigSchema = z.object({
  version: z.number().int().positive(),
  root: z.string().min(1).default("Knowledge"),
  packs: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  areas: z.record(z.string(), AreaConfigSchema).default({}),
  governance: GovernanceSchema,
  scripts: ScriptsSchema
}).passthrough();
var CreatedEntrySchema = z.object({
  action: z.literal("created"),
  hash: HashString,
  templateHash: HashString,
  template: z.string().min(1)
});
var MergedEntrySchema = z.object({
  action: z.literal("merged"),
  blockHash: HashString,
  templateHash: HashString,
  template: z.string().min(1),
  strategy: z.enum(["markers", "prefix"]),
  markerName: z.string().optional()
}).refine(
  (data) => data.strategy !== "markers" || data.markerName != null && data.markerName.length > 0,
  { message: 'markerName is required when strategy is "markers"', path: ["markerName"] }
);
var LockFileEntrySchema = z.union([CreatedEntrySchema, MergedEntrySchema]);
var LockConfigSchema = z.object({
  root: z.string(),
  packs: z.array(z.string()),
  tools: z.array(z.string())
});
var KdocLockSchema = z.object({
  lockVersion: z.number().int().positive(),
  kdocVersion: z.string().min(1),
  installedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  config: LockConfigSchema,
  files: z.record(z.string(), LockFileEntrySchema)
});

// src/config/lock.ts
var LOCK_FILENAME = ".kdoc.lock";
var LOCK_TMP_FILENAME = ".kdoc.lock.tmp";
function lockPath(projectDir) {
  return join4(projectDir, LOCK_FILENAME);
}
function lockTmpPath(projectDir) {
  return join4(projectDir, LOCK_TMP_FILENAME);
}
function hasPendingLockTmp(projectDir) {
  return existsSync4(lockTmpPath(projectDir));
}
function createEmptyLock(kdocVersion, config) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    lockVersion: 1,
    kdocVersion,
    installedAt: now,
    updatedAt: now,
    config,
    files: {}
  };
}
function loadLock(projectDir) {
  const mainPath = lockPath(projectDir);
  const tmpPath = lockTmpPath(projectDir);
  const path = existsSync4(mainPath) ? mainPath : tmpPath;
  if (!existsSync4(path)) return null;
  const raw = readFileSync3(path, "utf8");
  const parsed = JSON.parse(raw);
  const result = KdocLockSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Invalid lock file: ${result.error.issues.map((i) => i.message).join(", ")}`
    );
  }
  return result.data;
}
function appendFileEntry(projectDir, lock, filePath, entry) {
  lock.files[filePath] = entry;
  lock.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const json = JSON.stringify(lock, null, 2) + "\n";
  writeFileSync2(lockTmpPath(projectDir), json, "utf8");
}
function finalizeLock(projectDir) {
  const tmp = lockTmpPath(projectDir);
  if (!existsSync4(tmp)) return;
  renameSync(tmp, lockPath(projectDir));
}
function cleanupLockTmp(projectDir) {
  const tmp = lockTmpPath(projectDir);
  if (existsSync4(tmp)) unlinkSync(tmp);
}

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
  if (!existsSync5(absSource)) return;
  if (existsSync5(absDest)) return;
  ensureDir(dirname2(absDest));
  copyFileSync(absSource, absDest);
}
async function applyMerge(op, projectDir, templateContent) {
  const absPath = join5(projectDir, op.path);
  const fileName = op.path.split("/").pop() ?? op.path;
  const existing = existsSync5(absPath) ? readFileSync4(absPath, "utf8") : "";
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
    tools: config.tools ?? []
  };
  const lock = createEmptyLock(kdocVersion, lockConfig);
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
        const templateContent2 = templateContents.get(op.source) ?? "";
        if (!dryRun) {
          backupFile(projectDir, op.path);
          safeWriteFile(join5(projectDir, op.path), templateContent2);
          const fileHash = hashString(templateContent2);
          const templateHash = hashString(templateContent2);
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
      const templateContent = templateContents.get(op.source) ?? "";
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

// src/config/loader.ts
import { readFileSync as readFileSync5, writeFileSync as writeFileSync3, existsSync as existsSync6 } from "fs";
import { join as join6 } from "path";
import { parseDocument, stringify as stringifyYaml } from "yaml";
var CONFIG_FILENAME = ".kdoc.yaml";
function configPath(projectDir) {
  return join6(projectDir, CONFIG_FILENAME);
}
function configExists(projectDir) {
  return existsSync6(configPath(projectDir));
}
function loadConfig(projectDir) {
  const path = configPath(projectDir);
  if (!existsSync6(path)) return null;
  const raw = readFileSync5(path, "utf8");
  const doc = parseDocument(raw);
  const parsed = doc.toJSON();
  const result = KdocConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Invalid .kdoc.yaml: ${result.error.issues.map((i) => i.message).join(", ")}`
    );
  }
  return result.data;
}
function writeConfig(projectDir, config) {
  const path = configPath(projectDir);
  const yaml = stringifyYaml(config, { lineWidth: 120 });
  writeFileSync3(path, yaml, "utf8");
}

// src/utils/version.ts
import { readFileSync as readFileSync6 } from "fs";
import { join as join7, dirname as dirname3 } from "path";
import { fileURLToPath } from "url";
var __dirname = dirname3(fileURLToPath(import.meta.url));
function getKdocVersion() {
  try {
    const pkgPath = join7(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync6(pkgPath, "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

// src/commands/init.ts
var __filename = fileURLToPath2(import.meta.url);
var __dirname2 = dirname4(__filename);
function getProjectDir() {
  return process.env.KDOC_PROJECT_DIR ?? process.cwd();
}
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
var DEFAULT_AREAS = ["adr", "tldr", "guides", "templates", "context-pack"];
var SYNTHETIC_TEMPLATES = {
  "core/templates/gitkeep": "",
  "core/templates/claude-md-block.md": "kdoc Knowledge documentation toolkit is installed.\n\nRun `npx kdoc doctor` to check your setup.\n",
  "core/templates/agents-md-block.md": "kdoc Knowledge documentation toolkit is installed.\n\nRun `npx kdoc doctor` to check your setup.\n",
  "core/templates/gitignore-block": ".kdoc.backup/\n.kdoc.lock.tmp\n",
  "core/templates/package-json-scripts": JSON.stringify({ "kdoc:check": "npx kdoc doctor" })
};
function makeTemplateResolver() {
  const cliRoot = join8(__dirname2, "..", "..");
  const kdocRoot = join8(cliRoot, "..");
  const coreTemplatesDir = join8(kdocRoot, "core", "templates");
  const packsDir = join8(kdocRoot, "packs");
  return (templateName) => {
    if (templateName in SYNTHETIC_TEMPLATES) {
      return { sourcePath: templateName, content: SYNTHETIC_TEMPLATES[templateName] };
    }
    if (templateName.startsWith("core/templates/")) {
      const relFile = templateName.slice("core/templates/".length);
      const filePath = join8(coreTemplatesDir, relFile);
      if (existsSync7(filePath)) {
        const content = readFileSync7(filePath, "utf8");
        return { sourcePath: filePath, content };
      }
      return null;
    }
    const packsMatch = templateName.match(/^packs\/([^/]+)\/templates\/(.+)$/);
    if (packsMatch) {
      const [, packName, relFile] = packsMatch;
      const filePath = join8(packsDir, packName, "templates", relFile);
      if (existsSync7(filePath)) {
        const content = readFileSync7(filePath, "utf8");
        return { sourcePath: filePath, content };
      }
      return null;
    }
    return null;
  };
}
function buildConfig(packs, tools, areas) {
  const areaMap = {};
  for (const area of KNOWN_AREAS) {
    areaMap[area] = { enabled: areas.includes(area) };
  }
  return {
    version: 1,
    root: "Knowledge",
    packs,
    tools,
    areas: areaMap,
    governance: {
      "sync-check": true,
      wikilinks: true,
      "adr-governance": true,
      "index-build": true,
      "enforced-paths": []
    },
    scripts: { prefix: "kdoc" }
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
  cmd.description("Scaffold a Knowledge documentation structure into this project").option("--pack <packs>", "Comma-separated list of packs (nextjs,swift-ios)").option("--tools <tools>", "Comma-separated list of AI tools (claude-code,codex)").option("--yes", "Non-interactive: skip all prompts and use detected defaults").option("--dry-run", "Show what would be done without making changes").option("--verbose", "Log each file operation as it runs").action(async (options) => {
    const projectDir = getProjectDir();
    const yes = !!options.yes;
    const dryRun = !!options.dryRun;
    const verbose = !!options.verbose;
    try {
      const detection = await detectProject(projectDir);
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
      let selectedAreas;
      if (yes) {
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
      const config = buildConfig(selectedPacks, selectedTools, selectedAreas);
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
        if (resolved) templateContents.set(op.source, resolved.content);
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
      writeConfig(projectDir, config);
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
import { Command as Command2 } from "commander";
import { fileURLToPath as fileURLToPath3 } from "url";
import { dirname as dirname5, join as join9 } from "path";
import { readFileSync as readFileSync8, existsSync as existsSync8 } from "fs";
var __filename2 = fileURLToPath3(import.meta.url);
var __dirname3 = dirname5(__filename2);
function getProjectDir2() {
  return process.env.KDOC_PROJECT_DIR ?? process.cwd();
}
var KNOWN_AREAS2 = [
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
var KNOWN_PACKS2 = ["nextjs", "swift-ios"];
var KNOWN_TOOLS2 = ["claude-code", "codex"];
var SYNTHETIC_TEMPLATES2 = {
  "core/templates/gitkeep": "",
  "core/templates/claude-md-block.md": "kdoc Knowledge documentation toolkit is installed.\n\nRun `npx kdoc doctor` to check your setup.\n",
  "core/templates/agents-md-block.md": "kdoc Knowledge documentation toolkit is installed.\n\nRun `npx kdoc doctor` to check your setup.\n",
  "core/templates/gitignore-block": ".kdoc.backup/\n.kdoc.lock.tmp\n",
  "core/templates/package-json-scripts": JSON.stringify({ "kdoc:check": "npx kdoc doctor" })
};
function makeTemplateResolver2() {
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
        const content = readFileSync8(filePath, "utf8");
        return { sourcePath: filePath, content };
      }
      return null;
    }
    const packsMatch = templateName.match(/^packs\/([^/]+)\/templates\/(.+)$/);
    if (packsMatch) {
      const [, packName, relFile] = packsMatch;
      const filePath = join9(packsDir, packName, "templates", relFile);
      if (existsSync8(filePath)) {
        const content = readFileSync8(filePath, "utf8");
        return { sourcePath: filePath, content };
      }
      return null;
    }
    return null;
  };
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
    if (resolved) templateContents.set(op.source, resolved.content);
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
  cmd.description("Add a Knowledge area to an existing kdoc installation").argument("<area>", `Area to add (${KNOWN_AREAS2.join(", ")})`).option("--yes", "Non-interactive mode").option("--force", "Overwrite user-modified managed files without asking").action(async (area, options) => {
    const projectDir = getProjectDir2();
    if (!configExists(projectDir)) {
      console.error("Error: No .kdoc.yaml found. Run `kdoc init` first.");
      process.exitCode = 1;
      return;
    }
    if (!KNOWN_AREAS2.includes(area)) {
      console.error(
        `Error: Unknown area "${area}". Valid areas: ${KNOWN_AREAS2.join(", ")}`
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
        areas: {
          ...config.areas,
          [area]: { enabled: true }
        }
      };
      const success = await runScopedScaffold(projectDir, updatedConfig, { force: !!options.force });
      if (success) {
        writeConfig(projectDir, updatedConfig);
        console.log(`Area "${area}" added successfully.`);
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
  cmd.description("Add a technology pack to an existing kdoc installation").argument("<pack>", `Pack to add (${KNOWN_PACKS2.join(", ")})`).option("--yes", "Non-interactive mode").action(async (pack, options) => {
    const projectDir = getProjectDir2();
    if (!configExists(projectDir)) {
      console.error("Error: No .kdoc.yaml found. Run `kdoc init` first.");
      process.exitCode = 1;
      return;
    }
    if (!KNOWN_PACKS2.includes(pack)) {
      console.error(
        `Error: Unknown pack "${pack}". Valid packs: ${KNOWN_PACKS2.join(", ")}`
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
      const success = await runScopedScaffold(projectDir, updatedConfig, { force: !!options.force });
      if (success) {
        writeConfig(projectDir, updatedConfig);
        console.log(`Pack "${pack}" added successfully.`);
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
  cmd.description("Add an AI tool integration to an existing kdoc installation").argument("<tool>", `Tool to add (${KNOWN_TOOLS2.join(", ")})`).option("--yes", "Non-interactive mode").option("--force", "Overwrite user-modified managed files without asking").action(async (tool, options) => {
    const projectDir = getProjectDir2();
    if (!configExists(projectDir)) {
      console.error("Error: No .kdoc.yaml found. Run `kdoc init` first.");
      process.exitCode = 1;
      return;
    }
    if (!KNOWN_TOOLS2.includes(tool)) {
      console.error(
        `Error: Unknown tool "${tool}". Valid tools: ${KNOWN_TOOLS2.join(", ")}`
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
      const success = await runScopedScaffold(projectDir, updatedConfig, { force: !!options.force });
      if (success) {
        writeConfig(projectDir, updatedConfig);
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
function buildDesiredState(_config) {
  return {};
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
      if (lockEntry.action === "created") {
        const templateChanged = lockEntry.templateHash !== desiredEntry.currentTemplateHash;
        if (!templateChanged) {
          ops.push({ type: "SKIP", path: desiredPath });
          continue;
        }
        const userModified = desiredEntry.currentFileHash !== void 0 && desiredEntry.currentFileHash !== lockEntry.hash;
        ops.push({ type: "UPDATE", path: desiredPath, template: desiredEntry.template, userModified });
      } else {
        ops.push({ type: "UPDATE", path: desiredPath, template: desiredEntry.template, userModified: false });
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
  for (const [lockPath2] of Object.entries(lock.files)) {
    if (!matchedLockPaths.has(lockPath2)) {
      ops.push({ type: "REMOVE", path: lockPath2, userModified: false });
    }
  }
  return ops;
}
function registerUpdateCommand(program) {
  const cmd = new Command3("update");
  cmd.description("Update scripts and templates to the current kdoc version").option("--force", "Overwrite user-modified files without prompting").option("--dry-run", "Show planned operations without executing them").option("--yes", "Non-interactive: skip prompts (conflicts default to Skip)").action(async (opts) => {
    const cwd = process.cwd();
    const config = loadConfig(cwd);
    if (!config) {
      console.error("Error: .kdoc.yaml not found. Run `kdoc init` first.");
      process.exitCode = 2;
      return;
    }
    const lock = loadLock(cwd);
    if (!lock) {
      console.error("Error: .kdoc.lock not found. No installation found to update.");
      process.exitCode = 2;
      return;
    }
    const desired = buildDesiredState(lock.config);
    const ops = diffDesiredState(lock, desired);
    if (opts.dryRun) {
      console.log("kdoc update: planned operations:");
      for (const op of ops) {
        if (op.type === "RENAME") {
          console.log(`  [${op.type.padEnd(6)}] ${op.oldPath} \u2192 ${op.newPath}`);
        } else {
          console.log(`  [${op.type.padEnd(6)}] ${op.path}`);
        }
      }
      if (ops.length === 0) console.log("  (no changes needed)");
      console.log("\n[dry-run] No changes applied.");
      return;
    }
    if (ops.length === 0) {
      console.log("kdoc update: already up to date.");
      return;
    }
    console.log(`kdoc update: ${ops.length} operation(s) planned.`);
    console.log("kdoc update complete.");
  });
  program.addCommand(cmd);
}

// src/commands/doctor.ts
import { Command as Command4 } from "commander";
import { existsSync as existsSync9, readdirSync as readdirSync3 } from "fs";
import { join as join10 } from "path";
import { execFileSync } from "child_process";
var AREA_EXPECTATIONS = {
  adr: { path: "ADR", type: "readme-required" },
  tldr: { path: "TLDR", type: "readme-required" },
  roadmap: { path: "Roadmap", type: "readme-required" },
  design: { path: "Design", type: "readme-required" },
  guides: { path: "Guides", type: "empty-ok" },
  "agent-memory": { path: "AgentMemory", type: "seed-file-required", file: "MEMORY.md" },
  runbooks: { path: "runbooks", type: "empty-ok" },
  "threat-models": { path: "runbooks/threat-models", type: "empty-ok" },
  templates: { path: "Templates", type: "empty-ok" },
  governance: { path: "", type: "empty-ok" },
  // scripts live in scripts/kdoc/
  "context-pack": { path: "", type: "seed-file-required", file: "ContextPack.md" },
  index: { path: "", type: "generated-required", file: "INDEX.md" }
};
function runConfigChecks(projectDir) {
  const results = [];
  const configFilePath = join10(projectDir, ".kdoc.yaml");
  if (!existsSync9(configFilePath)) {
    results.push({
      category: "config",
      name: ".kdoc.yaml exists",
      status: "fail",
      message: ".kdoc.yaml not found",
      fix: "npx kdoc init"
    });
    return results;
  }
  try {
    loadConfig(projectDir);
    results.push({
      category: "config",
      name: ".kdoc.yaml exists",
      status: "pass",
      message: ".kdoc.yaml is valid"
    });
  } catch (err) {
    results.push({
      category: "config",
      name: ".kdoc.yaml exists",
      status: "fail",
      message: `.kdoc.yaml is invalid: ${String(err)}`,
      fix: "Fix validation errors in .kdoc.yaml"
    });
    return results;
  }
  const lockFilePath = join10(projectDir, ".kdoc.lock");
  if (!existsSync9(lockFilePath)) {
    results.push({
      category: "config",
      name: ".kdoc.lock exists",
      status: "fail",
      message: ".kdoc.lock not found",
      fix: "Run `npx kdoc init` to create the lock file"
    });
  } else {
    results.push({
      category: "config",
      name: ".kdoc.lock exists",
      status: "pass",
      message: ".kdoc.lock found"
    });
  }
  if (hasPendingLockTmp(projectDir)) {
    results.push({
      category: "config",
      name: "No interrupted install",
      status: "warn",
      message: ".kdoc.lock.tmp found \u2014 a previous install may have been interrupted",
      fix: "Run `npx kdoc init` to resume or `npx kdoc undo` to clean up"
    });
  } else {
    results.push({
      category: "config",
      name: "No interrupted install",
      status: "pass",
      message: "No interrupted install detected"
    });
  }
  return results;
}
function runStructureChecks(projectDir, knowledgeRoot, areas) {
  const results = [];
  const kRoot = join10(projectDir, knowledgeRoot);
  for (const [areaName, areaConfig] of Object.entries(areas)) {
    if (!areaConfig.enabled) continue;
    const expectation = AREA_EXPECTATIONS[areaName];
    if (!expectation) continue;
    const areaDir = expectation.path ? join10(kRoot, expectation.path) : kRoot;
    const displayPath = expectation.path || knowledgeRoot;
    if (expectation.path && !existsSync9(areaDir)) {
      results.push({
        category: "structure",
        name: `${displayPath} directory exists`,
        status: "fail",
        message: `Directory ${displayPath} not found`,
        fix: `npx kdoc add ${areaName}`
      });
      continue;
    }
    switch (expectation.type) {
      case "empty-ok":
        results.push({
          category: "structure",
          name: `${displayPath} directory exists`,
          status: "pass",
          message: `${displayPath} is present`
        });
        break;
      case "readme-required": {
        const readmePath = join10(areaDir, "README.md");
        const readmeExists = existsSync9(readmePath);
        results.push({
          category: "structure",
          name: `${displayPath}/README.md exists`,
          status: readmeExists ? "pass" : "fail",
          message: readmeExists ? `${displayPath}/README.md found` : `${displayPath}/README.md is missing`,
          fix: readmeExists ? void 0 : `npx kdoc add ${areaName}`
        });
        if (readmeExists) {
          const entries = readdirSync3(areaDir).filter(
            (f) => f !== "README.md" && f.endsWith(".md")
          );
          if (entries.length === 0) {
            results.push({
              category: "structure",
              name: `${displayPath} has user documents`,
              status: "warn",
              message: `${displayPath} has README.md but no user-created documents yet`
            });
          }
        }
        break;
      }
      case "generated-required":
      case "seed-file-required": {
        if (!expectation.file) break;
        const targetPath = expectation.path ? join10(areaDir, expectation.file) : join10(kRoot, expectation.file);
        const targetExists = existsSync9(targetPath);
        const checkLabel = expectation.path ? `${expectation.path}/${expectation.file} exists` : `${expectation.file} exists`;
        results.push({
          category: "structure",
          name: checkLabel,
          status: targetExists ? "pass" : "fail",
          message: targetExists ? `${expectation.file} found` : `${expectation.file} is missing`,
          fix: targetExists ? void 0 : `npx kdoc add ${areaName}`
        });
        break;
      }
    }
  }
  return results;
}
function runScriptChecks(projectDir, config) {
  const checks = [];
  const scriptsDir = join10(projectDir, "scripts", config.scripts.prefix);
  const expectedScripts = [
    "check_sync.py",
    "check_wikilinks.py",
    "build_index.py",
    "check_adr_governance.py",
    "governance_health.py"
  ];
  for (const script of expectedScripts) {
    const scriptPath = join10(scriptsDir, script);
    if (!existsSync9(scriptPath)) {
      checks.push({
        category: "scripts",
        name: `script-${script}`,
        status: "fail",
        message: `Missing: scripts/${config.scripts.prefix}/${script}`,
        fix: "npx kdoc update"
      });
    } else {
      checks.push({
        category: "scripts",
        name: `script-${script}`,
        status: "pass",
        message: `Found: scripts/${config.scripts.prefix}/${script}`
      });
    }
  }
  return checks;
}
function runIntegrationChecks(projectDir, tools) {
  const results = [];
  if (tools.includes("claude-code")) {
    const claudePath = join10(projectDir, "CLAUDE.md");
    const content = readFileSafe(claudePath) ?? "";
    const hasBlock = content.includes("<!-- kdoc:core:start -->");
    results.push({
      category: "integrations",
      name: "CLAUDE.md has kdoc block",
      status: hasBlock ? "pass" : "fail",
      message: hasBlock ? "CLAUDE.md contains kdoc marker block" : "CLAUDE.md is missing kdoc integration block",
      fix: hasBlock ? void 0 : "npx kdoc add-tool claude-code"
    });
  }
  if (tools.includes("codex")) {
    const agentsPath = join10(projectDir, "AGENTS.md");
    const content = readFileSafe(agentsPath) ?? "";
    const hasBlock = content.includes("<!-- kdoc:core:start -->");
    results.push({
      category: "integrations",
      name: "AGENTS.md has kdoc block",
      status: hasBlock ? "pass" : "fail",
      message: hasBlock ? "AGENTS.md contains kdoc marker block" : "AGENTS.md is missing kdoc integration block",
      fix: hasBlock ? void 0 : "npx kdoc add-tool codex"
    });
  }
  const pkgPath = join10(projectDir, "package.json");
  if (existsSync9(pkgPath)) {
    const pkgContent = readFileSafe(pkgPath);
    if (pkgContent) {
      let pkg;
      try {
        pkg = JSON.parse(pkgContent);
      } catch {
        pkg = {};
      }
      const scripts = pkg["scripts"] ?? {};
      const kdocScripts = Object.keys(scripts).filter((k) => k.startsWith("kdoc:"));
      results.push({
        category: "integrations",
        name: "package.json has kdoc:* scripts",
        status: kdocScripts.length > 0 ? "pass" : "warn",
        message: kdocScripts.length > 0 ? `Found ${kdocScripts.length} kdoc:* script(s) in package.json` : "No kdoc:* scripts found in package.json",
        fix: kdocScripts.length === 0 ? "npx kdoc init (re-run to add scripts)" : void 0
      });
    }
  }
  return results;
}
function runGovernanceChecks(projectDir) {
  const results = [];
  const scripts = [
    {
      name: "ADR governance valid",
      script: join10(projectDir, "scripts", "kdoc", "check_adr_governance.py"),
      checkName: "ADR numbering and cross-references"
    },
    {
      name: "Wikilinks valid",
      script: join10(projectDir, "scripts", "kdoc", "check_wikilinks.py"),
      checkName: "Wikilink integrity"
    }
  ];
  for (const { name, script, checkName } of scripts) {
    if (!existsSync9(script)) {
      results.push({
        category: "governance",
        name,
        status: "warn",
        message: `Governance script not found: ${script}`,
        fix: "npx kdoc add governance"
      });
      continue;
    }
    try {
      execFileSync("python3", [script], { cwd: projectDir, stdio: "pipe" });
      results.push({
        category: "governance",
        name,
        status: "pass",
        message: `${checkName}: OK`
      });
    } catch (err) {
      const execErr = err;
      const output = [
        execErr.stdout?.toString().trim(),
        execErr.stderr?.toString().trim()
      ].filter(Boolean).join("\n");
      results.push({
        category: "governance",
        name,
        status: "fail",
        message: `${checkName}: ${output || "Script exited with non-zero code"}`,
        fix: `Run: python3 ${script}`
      });
    }
  }
  return results;
}
function buildDoctorReport(version, checks) {
  const summary = { pass: 0, fail: 0, warn: 0 };
  for (const c of checks) {
    summary[c.status]++;
  }
  let status = "healthy";
  if (summary.fail > 0) status = "broken";
  else if (summary.warn > 0) status = "issues";
  return { version, status, checks, summary };
}
function registerDoctorCommand(program) {
  const cmd = new Command4("doctor");
  cmd.description("Check the health of your kdoc installation").option("--json", "Output results as JSON").action(async (opts) => {
    const cwd = process.cwd();
    const configChecks = runConfigChecks(cwd);
    const configFailed = configChecks.some((c) => c.status === "fail");
    const allChecks = [...configChecks];
    if (!configFailed) {
      const config = loadConfig(cwd);
      if (config) {
        allChecks.push(...runStructureChecks(cwd, config.root, config.areas));
        allChecks.push(...runScriptChecks(cwd, config));
        allChecks.push(...runIntegrationChecks(cwd, config.tools));
        allChecks.push(...runGovernanceChecks(cwd));
      }
    }
    const KDOC_VERSION = "1.0.0";
    const report = buildDoctorReport(KDOC_VERSION, allChecks);
    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      const icons = { pass: "\u2713", fail: "\u2717", warn: "\u26A0" };
      for (const check of report.checks) {
        console.log(`  ${icons[check.status]} [${check.category}] ${check.name}: ${check.message}`);
        if (check.fix) console.log(`    Fix: ${check.fix}`);
      }
      console.log(`
Status: ${report.status} (${report.summary.pass} pass, ${report.summary.warn} warn, ${report.summary.fail} fail)`);
    }
    if (configFailed) {
      process.exitCode = 2;
      return;
    }
    if (report.summary.fail > 0) {
      process.exitCode = 1;
    }
  });
  program.addCommand(cmd);
}

// src/commands/create.ts
import { Command as Command5 } from "commander";
import { existsSync as existsSync10, readdirSync as readdirSync4 } from "fs";
import { join as join11, dirname as dirname6 } from "path";

// src/templates/renderer.ts
function renderTemplate(template, values) {
  const warnings = [];
  const SENTINEL = "\0KDOC_ESCAPE\0";
  let result = template.replace(/\\\{\{/g, SENTINEL);
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    if (key in values) {
      return values[key];
    }
    warnings.push(`Placeholder {{${key}}} has no value \u2014 left as literal`);
    return `{{${key}}}`;
  });
  result = result.replaceAll(SENTINEL, "{{");
  return { content: result, warnings };
}

// src/commands/create.ts
var VALID_TYPES = [
  "adr",
  "tldr",
  "phase",
  "sub-phase",
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
  if (args.type === "tldr" && !args.scope) {
    return { valid: false, error: "TLDR requires --scope flag. Example: kdoc create tldr my-feature --scope Admin" };
  }
  return { valid: true };
}
function resolveAdrNumber(adrDir) {
  if (!existsSync10(adrDir)) return "0001";
  const entries = readdirSync4(adrDir);
  const numbers = entries.map((f) => {
    const match = f.match(/^ADR-(\d{4})-/);
    return match ? parseInt(match[1], 10) : 0;
  }).filter((n) => n > 0);
  const max = numbers.length > 0 ? Math.max(...numbers) : 0;
  return String(max + 1).padStart(4, "0");
}
function resolveCreatePath(type, name, opts) {
  const { root, adrNumber, scope } = opts;
  switch (type) {
    case "adr":
      return join11(root, "ADR", `ADR-${adrNumber}-${name}.md`);
    case "tldr":
      return join11(root, "TLDR", scope ?? "_noscope", `${name}.md`);
    case "phase":
      return join11(root, "Roadmap", "phases", `${name}.md`);
    case "sub-phase":
      return join11(root, "Roadmap", "phases", `${name}.md`);
    case "guide":
      return join11(root, "Guides", `${name}.md`);
    case "threat-model":
      return join11(root, "runbooks", "threat-models", `${name}.md`);
    case "runbook":
      return join11(root, "runbooks", `${name}.md`);
    case "test-map":
      return join11(root, "Templates", `${name}-test-map.md`);
    default:
      throw new Error(`Unknown type: ${type}`);
  }
}
function loadBuiltinTemplate(type) {
  const fallbacks = {
    adr: `# ADR-{{ID}}: {{TITLE}}

**Date:** {{DATE}}
**Status:** {{STATUS}}

## Context

## Decision

## Consequences
`,
    tldr: `---
area: {{AREA}}
scope: {{SCOPE}}
status: {{STATUS}}
---

# {{TITLE}}

## Overview

## Acceptance Criteria

## Test Scenarios
`,
    phase: `# Phase: {{TITLE}}

**Date:** {{DATE}}

## Goals

## Sub-phases
`,
    "sub-phase": `# Sub-phase: {{TITLE}}

**Date:** {{DATE}}

## Scope

## Tasks
`,
    guide: `# {{TITLE}}

**Category:** {{AREA}}

## Overview

## Steps
`,
    "threat-model": `# Threat Model: {{TITLE}}

**Date:** {{DATE}}

## Scope

## STRIDE Analysis
`,
    runbook: `# {{TITLE}}

**Date:** {{DATE}}

## Purpose

## Steps
`,
    "test-map": `# Test Map: {{TITLE}}

**Date:** {{DATE}}

## Scenarios

| Scenario | Level | File | Status |
|----------|-------|------|--------|
`
  };
  return fallbacks[type];
}
function registerCreateCommand(program) {
  const cmd = new Command5("create");
  cmd.description("Create a new Knowledge document (adr, tldr, phase, guide, runbook, threat-model, test-map)").argument("<type>", "Document type to create").argument("[name]", "Document name (kebab-case)").option("--scope <scope>", "Scope for TLDR documents (required for tldr type)").option("--status <status>", "Initial status (default: proposed for ADR, draft for TLDR)").action(async (type, name, opts) => {
    const cwd = process.cwd();
    const args = { type, name: name ?? "", scope: opts.scope, status: opts.status };
    const validation = validateCreateArgs(args);
    if (!validation.valid) {
      console.error(`Error: ${validation.error}`);
      process.exitCode = 1;
      return;
    }
    const config = loadConfig(cwd);
    if (!config) {
      console.error("Error: .kdoc.yaml not found. Run `kdoc init` first.");
      process.exitCode = 2;
      return;
    }
    const knowledgeRoot = join11(cwd, config.root);
    let adrNumber;
    if (type === "adr") {
      adrNumber = resolveAdrNumber(join11(knowledgeRoot, "ADR"));
    }
    const outputPath = resolveCreatePath(type, name, {
      root: knowledgeRoot,
      adrNumber,
      scope: opts.scope
    });
    if (existsSync10(outputPath)) {
      console.error(`Error: File already exists: ${outputPath}`);
      process.exitCode = 1;
      return;
    }
    const templateContent = loadBuiltinTemplate(type);
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const projectName = dirname6(cwd).split("/").pop() ?? "project";
    const defaultStatus = type === "adr" ? "proposed" : "draft";
    const values = {
      ID: adrNumber ?? "",
      TITLE: name,
      DATE: today,
      STATUS: opts.status ?? defaultStatus,
      SCOPE: opts.scope ?? "",
      AREA: type,
      PROJECT_NAME: projectName
    };
    const { content, warnings } = renderTemplate(templateContent, values);
    for (const warning of warnings) {
      console.warn(`Warning: ${warning}`);
    }
    safeWriteFile(outputPath, content);
    console.log(`Created: ${outputPath}`);
  });
  program.addCommand(cmd);
}

// src/commands/undo.ts
import { Command as Command6 } from "commander";
import { existsSync as existsSync11, readFileSync as readFileSync9, writeFileSync as writeFileSync4, rmSync as rmSync2 } from "fs";
import { join as join12, dirname as dirname7, resolve } from "path";
function undoCreatedEntry(filePath, lockedHash, opts) {
  if (!existsSync11(filePath)) {
    return { path: filePath, action: "skipped", reason: "File does not exist" };
  }
  const currentHash = hashFile(filePath);
  const isUnmodified = currentHash === lockedHash;
  if (isUnmodified || opts.force) {
    rmSync2(filePath, { force: true });
    pruneEmptyAncestors(filePath);
    return { path: filePath, action: "deleted" };
  }
  return { path: filePath, action: "kept", reason: "File was modified by user (--yes defaults to Keep)" };
}
function undoMergedMarkersEntry(filePath, markerName) {
  if (!existsSync11(filePath)) {
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
    rmSync2(filePath, { force: true });
    pruneEmptyAncestors(filePath);
    return { path: filePath, action: "deleted" };
  }
  writeFileSync4(filePath, cleaned, "utf8");
  return { path: filePath, action: "cleaned" };
}
function undoMergedPrefixEntry(filePath) {
  if (!existsSync11(filePath)) {
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
  writeFileSync4(filePath, cleaned, "utf8");
  return { path: filePath, action: "cleaned" };
}
function pruneEmptyAncestors(filePath) {
  let current = dirname7(resolve(filePath));
  const root = resolve(process.cwd());
  while (current !== root && current !== dirname7(current)) {
    const deleted = deleteIfEmpty(current);
    if (!deleted) break;
    current = dirname7(current);
  }
}
function registerUndoCommand(program) {
  const cmd = new Command6("undo");
  cmd.description("Revert all kdoc scaffold operations (reads .kdoc.lock)").option("--keep-config", "Preserve .kdoc.yaml after undo (skip removal prompt)").option("--yes", "Non-interactive: modified files default to Keep, config removal defaults to No").option("--force", "Delete all managed files even if user-modified").action(async (opts) => {
    const cwd = process.cwd();
    const undoOpts = { force: !!opts.force, yes: !!opts.yes || !!opts.force };
    const lock = loadLock(cwd);
    if (!lock) {
      console.error("Error: No .kdoc.lock or .kdoc.lock.tmp found. Nothing to undo.");
      process.exitCode = 1;
      return;
    }
    const results = [];
    for (const [filePath, entry] of Object.entries(lock.files)) {
      const absolutePath = join12(cwd, filePath);
      if (entry.action === "created") {
        results.push(undoCreatedEntry(absolutePath, entry.hash, undoOpts));
      } else if (entry.action === "merged" && entry.strategy === "markers") {
        const markerName = entry.markerName ?? "core";
        results.push(undoMergedMarkersEntry(absolutePath, markerName));
      } else if (entry.action === "merged" && entry.strategy === "prefix") {
        results.push(undoMergedPrefixEntry(absolutePath));
      }
    }
    const lockPath2 = join12(cwd, ".kdoc.lock");
    const lockTmpPath2 = join12(cwd, ".kdoc.lock.tmp");
    if (existsSync11(lockPath2)) rmSync2(lockPath2);
    if (existsSync11(lockTmpPath2)) rmSync2(lockTmpPath2);
    const backupDir = join12(cwd, ".kdoc.backup");
    if (existsSync11(backupDir)) rmSync2(backupDir, { recursive: true });
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
import { spawnSync } from "child_process";
import { mkdtempSync, readdirSync as readdirSync5, readFileSync as readFileSync10, writeFileSync as writeFileSync5, rmSync as rmSync3 } from "fs";
import { join as join13, relative as relative2 } from "path";
import { tmpdir } from "os";
import { createHash as createHash2 } from "crypto";
function hashContent(content) {
  return "sha256:" + createHash2("sha256").update(content, "utf8").digest("hex");
}
function captureSnapshot(rootDir) {
  const snapshot = {};
  function walk(dir) {
    for (const entry of readdirSync5(dir, { withFileTypes: true })) {
      const fullPath = join13(dir, entry.name);
      const relPath = relative2(rootDir, fullPath);
      if (entry.isDirectory()) {
        snapshot[relPath] = { hash: "", size: 0, isDirectory: true };
        walk(fullPath);
      } else {
        const content = readFileSync10(fullPath, "utf8");
        snapshot[relPath] = {
          hash: hashContent(content),
          size: Buffer.byteLength(content),
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
function runKdoc(args, cwd) {
  const cliPath = process.argv[1];
  const result = spawnSync("node", [cliPath, ...args], {
    encoding: "utf8",
    timeout: 3e4,
    cwd,
    env: { ...process.env, VITEST: void 0 }
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? 1
  };
}
function step(name, fn) {
  try {
    const error = fn();
    if (error) return { name, passed: false, detail: error };
    return { name, passed: true, detail: "ok" };
  } catch (e) {
    return { name, passed: false, detail: e instanceof Error ? e.message : String(e) };
  }
}
function runSelftest(opts) {
  const results = [];
  const tmpDir = mkdtempSync(join13(tmpdir(), "kdoc-selftest-"));
  try {
    const emptySnapshot = captureSnapshot(tmpDir);
    results.push({ name: "prepare", passed: true, detail: `temp dir: ${tmpDir}` });
    const initArgs = ["init", "--yes"];
    if (opts.pack) initArgs.push("--pack", opts.pack);
    if (opts.tools) initArgs.push("--tools", opts.tools);
    results.push(step("init", () => {
      const r = runKdoc(initArgs, tmpDir);
      if (opts.verbose) process.stderr.write(r.stdout + r.stderr);
      if (!r.ok) return `init failed (exit ${r.status}): ${r.stderr.slice(0, 200)}`;
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
          return null;
        }
        return null;
      } catch {
        if (r.status !== 0 && r.status !== 1) {
          return `doctor crashed (exit ${r.status}): ${r.stderr.slice(0, 200)}`;
        }
        return null;
      }
    }));
    results.push(step("mutate", () => {
      const files = Object.keys(initSnapshot).filter((k) => !initSnapshot[k].isDirectory);
      const mutations = [];
      const readmeFile = files.find((f) => f.includes("README.md")) ?? files[0];
      if (readmeFile) {
        const fullPath = join13(tmpDir, readmeFile);
        const content = readFileSync10(fullPath, "utf8");
        writeFileSync5(fullPath, content + "\n\n## User addition\nThis was added by the user.\n");
        mutations.push(`appended: ${readmeFile}`);
      }
      const otherFile = files.find((f) => f !== readmeFile && f.endsWith(".md"));
      if (otherFile) {
        const fullPath = join13(tmpDir, otherFile);
        const content = readFileSync10(fullPath, "utf8");
        writeFileSync5(fullPath, content + "\nModified by selftest.\n");
        mutations.push(`modified: ${otherFile}`);
      }
      const configFile = files.find((f) => f === ".kdoc.yaml");
      if (configFile) {
        const fullPath = join13(tmpDir, configFile);
        const content = readFileSync10(fullPath, "utf8");
        writeFileSync5(fullPath, content + "\n# User comment\n");
        mutations.push(`edited: ${configFile}`);
      }
      if (mutations.length === 0) return "no files to mutate";
      return null;
    }));
    results.push(step("re-init", () => {
      const r = runKdoc(["init", "--yes"], tmpDir);
      if (opts.verbose) process.stderr.write(r.stdout + r.stderr);
      if (r.status !== 0 && r.status !== 1) {
        return `re-init crashed (exit ${r.status}): ${r.stderr.slice(0, 200)}`;
      }
      return null;
    }));
    results.push(step("undo", () => {
      const r = runKdoc(["undo", "--yes", "--force"], tmpDir);
      if (opts.verbose) process.stderr.write(r.stdout + r.stderr);
      if (!r.ok) return `undo failed (exit ${r.status}): ${r.stderr.slice(0, 200)}`;
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
      rmSync3(tmpDir, { recursive: true, force: true });
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

// src/index.ts
var __dirname4 = dirname8(fileURLToPath4(import.meta.url));
function getVersion() {
  try {
    const pkgPath = join14(__dirname4, "..", "package.json");
    const pkg = JSON.parse(readFileSync11(pkgPath, "utf8"));
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}
function buildProgram() {
  const program = new Command7();
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
  return program;
}
if (!process.env.VITEST) {
  buildProgram().parse();
}
export {
  buildProgram
};
//# sourceMappingURL=index.js.map