#!/usr/bin/env node

// src/index.ts
import { Command as Command11 } from "commander";
import { readFileSync as readFileSync22 } from "fs";
import { join as join26, dirname as dirname12 } from "path";
import { fileURLToPath as fileURLToPath9 } from "url";

// src/commands/init.ts
import { existsSync as existsSync10, readFileSync as readFileSync11 } from "fs";
import { join as join12 } from "path";
import { Command } from "commander";
import { checkbox, input, select } from "@inquirer/prompts";

// src/scaffold/detect.ts
import { existsSync as existsSync4, readdirSync as readdirSync3, readFileSync as readFileSync5 } from "fs";
import { join as join4, relative, basename as basename2 } from "path";
import fg from "fast-glob";

// src/packs/installer.ts
import { existsSync as existsSync3, readFileSync as readFileSync4, readdirSync as readdirSync2 } from "fs";
import { join as join3, dirname as dirname2, basename } from "path";
import { fileURLToPath } from "url";

// src/config/lock.ts
import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync } from "fs";
import { join } from "path";

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
  "intent-check": z.boolean().default(true),
  "enforced-paths": z.array(z.string().min(1)).default([])
}).default({});
var ScriptsSchema = z.object({
  prefix: ScriptPrefix.default("kdoc")
}).default({ prefix: "kdoc" });
var PackageConfigSchema = z.object({
  path: z.string().min(1),
  areas: z.record(z.string(), AreaConfigSchema).optional()
});
var CategoryConfigSchema = z.object({
  label: z.string().min(1),
  template: z.string().optional(),
  description: z.string().optional()
});
var ExtensionAreaSchema = z.object({
  name: z.string().min(1),
  directory: z.string().min(1),
  templates: z.array(z.string()).optional(),
  required_files: z.array(z.string()).optional(),
  scoped: z.boolean().default(false),
  pack: z.string().optional()
});
var TopologyEnum = z.enum(["single", "monorepo", "vault"]);
var KdocConfigSchema = z.object({
  version: z.number().int().positive(),
  root: z.string().min(1).default("Knowledge"),
  packs: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  areas: z.record(z.string(), AreaConfigSchema).default({}),
  governance: GovernanceSchema,
  scripts: ScriptsSchema,
  topology: TopologyEnum.default("single"),
  packages: z.record(z.string(), PackageConfigSchema).default({}),
  categories: z.record(z.string(), CategoryConfigSchema).optional(),
  extensionAreas: z.array(ExtensionAreaSchema).default([])
}).passthrough().superRefine((data, ctx) => {
  if (Object.keys(data.packages).length > 0 && data.topology !== "monorepo") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'packages can only be specified when topology is "monorepo"',
      path: ["packages"]
    });
  }
  if (data.categories && Object.keys(data.categories).length > 0 && data.topology !== "vault") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'categories can only be specified when topology is "vault"',
      path: ["categories"]
    });
  }
});
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
  tools: z.array(z.string()),
  topology: TopologyEnum.optional(),
  packages: z.record(z.string(), z.object({ path: z.string() })).optional()
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
  return join(projectDir, LOCK_FILENAME);
}
function lockTmpPath(projectDir) {
  return join(projectDir, LOCK_TMP_FILENAME);
}
function hasPendingLockTmp(projectDir) {
  return existsSync(lockTmpPath(projectDir));
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
  const path = existsSync(mainPath) ? mainPath : tmpPath;
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  const result = KdocLockSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Invalid lock file: ${result.error.issues.map((i) => i.message).join(", ")}`
    );
  }
  return result.data;
}
function writeLock(projectDir, lock) {
  lock.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const json = JSON.stringify(lock, null, 2) + "\n";
  writeFileSync(lockPath(projectDir), json, "utf8");
}
function appendFileEntry(projectDir, lock, filePath, entry) {
  lock.files[filePath] = entry;
  lock.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const json = JSON.stringify(lock, null, 2) + "\n";
  writeFileSync(lockTmpPath(projectDir), json, "utf8");
}
function finalizeLock(projectDir) {
  const tmp = lockTmpPath(projectDir);
  if (!existsSync(tmp)) return;
  renameSync(tmp, lockPath(projectDir));
}
function cleanupLockTmp(projectDir) {
  const tmp = lockTmpPath(projectDir);
  if (existsSync(tmp)) unlinkSync(tmp);
}

// src/utils/fs.ts
import { existsSync as existsSync2, mkdirSync, readFileSync as readFileSync2, writeFileSync as writeFileSync2, readdirSync, rmSync } from "fs";
import { dirname, join as join2 } from "path";
function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}
function safeWriteFile(filePath, content) {
  ensureDir(dirname(filePath));
  writeFileSync2(filePath, content, "utf8");
}
function readFileSafe(filePath) {
  try {
    return readFileSync2(filePath, "utf8");
  } catch {
    return null;
  }
}
function deleteIfEmpty(dirPath) {
  if (!existsSync2(dirPath)) return false;
  return deleteIfEmptyRecursive(dirPath);
}
function deleteIfEmptyRecursive(dirPath) {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) return false;
    if (entry.isDirectory()) {
      const subPath = join2(dirPath, entry.name);
      if (!deleteIfEmptyRecursive(subPath)) return false;
    }
  }
  rmSync(dirPath, { recursive: true });
  return true;
}

// src/utils/hash.ts
import { createHash } from "crypto";
import { readFileSync as readFileSync3 } from "fs";
var HASH_PREFIX = "sha256:";
function hashString(content) {
  const hex = createHash("sha256").update(content, "utf8").digest("hex");
  return `${HASH_PREFIX}${hex}`;
}
function hashFile(filePath) {
  const content = readFileSync3(filePath, "utf8");
  return hashString(content);
}

// src/utils/strings.ts
function slugify(text) {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
}
function humanizeKebab(slug) {
  return slug.split("-").filter(Boolean).map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1)).join(" ");
}

// src/templates/renderer.ts
function normalizeNumber(raw) {
  if (!raw) return "";
  const digits = raw.match(/\d+/g)?.join("") ?? "";
  return digits ? digits.padStart(4, "0").slice(-4) : "";
}
function humanizeTitle(raw) {
  if (!raw) return "";
  return raw.includes("-") ? humanizeKebab(raw) : raw;
}
function buildAliases(values, title, number) {
  const aliases = /* @__PURE__ */ new Set();
  if (title) aliases.add(title);
  if (values.NAME) aliases.add(values.NAME);
  if (values.ALIAS) aliases.add(values.ALIAS);
  if (number && (values.AREA === "adr" || values.TYPE === "adr" || values.ID?.startsWith("ADR-"))) {
    aliases.add(`ADR-${number}`);
  }
  return JSON.stringify([...aliases]);
}
function renderTemplate(template, values) {
  const warnings = [];
  const SENTINEL = "\0KDOC_ESCAPE\0";
  const number = normalizeNumber(values.NUMBER ?? values.ID);
  const title = humanizeTitle(values.TITLE?.trim() || values.NAME?.trim() || "");
  const resolvedValues = {
    ...values,
    DATE: values.DATE?.trim() || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
    SCOPE: values.SCOPE?.trim() || "root",
    TITLE: title,
    NUMBER: values.NUMBER?.trim() ? normalizeNumber(values.NUMBER) : number,
    ALIASES: values.ALIASES?.trim() || buildAliases(values, title, number)
  };
  let result = template.replace(/\\\{\{/g, SENTINEL);
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    if (key in resolvedValues) {
      return resolvedValues[key];
    }
    warnings.push(`Placeholder {{${key}}} has no value \u2014 left as literal`);
    return `{{${key}}}`;
  });
  result = result.replaceAll(SENTINEL, "{{");
  return { content: result, warnings };
}

// src/utils/git.ts
import { execFileSync } from "child_process";
function getGitOwner(cwd) {
  try {
    return execFileSync("git", ["config", "user.name"], {
      cwd: cwd ?? process.cwd(),
      encoding: "utf8"
    }).trim();
  } catch {
    return "";
  }
}

// src/packs/installer.ts
var __dirname = dirname2(fileURLToPath(import.meta.url));
var ASSET_MAPPINGS = [
  { sourceDir: "templates", targetPrefix: (kr, p) => join3(kr, "Templates", p) },
  { sourceDir: "guides", targetPrefix: (kr, p) => join3(kr, "Guides", p) },
  { sourceDir: "design", targetPrefix: (kr, p) => join3(kr, "Design", p) },
  { sourceDir: "scripts", targetPrefix: (_kr, p) => join3("scripts", "kdoc", p) }
];
function getPacksRoot() {
  const bundledPath = join3(__dirname, "..", "..", "packs");
  if (existsSync3(bundledPath)) return bundledPath;
  return join3(__dirname, "..", "..", "..", "packs");
}
function getPackRoot(packName) {
  return join3(getPacksRoot(), packName);
}
function walkRelative(root, base = "") {
  if (!existsSync3(root)) return [];
  const entries = readdirSync2(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const rel = base ? join3(base, entry.name) : entry.name;
    if (entry.isDirectory()) {
      files.push(...walkRelative(join3(root, entry.name), rel));
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
    WIKILINK_PREFIX: ""
  };
  const owner = getGitOwner(projectDir);
  if (owner) values.OWNER = owner;
  return values;
}
async function installPackAssets(packName, projectDir, config, options = {}) {
  const { dryRun = false, force = false } = options;
  const packRoot = getPackRoot(packName);
  const knowledgeRoot = config.root ?? "Knowledge";
  const result = { installed: [], skipped: [], errors: [] };
  if (!existsSync3(packRoot)) {
    result.errors.push(`Pack directory not found: ${packRoot}`);
    return result;
  }
  const renderValues = buildPackRenderValues(projectDir, packName);
  const existingLock = dryRun ? null : loadLock(projectDir);
  for (const mapping of ASSET_MAPPINGS) {
    const sourceDir = join3(packRoot, mapping.sourceDir);
    const targetPrefix = mapping.targetPrefix(knowledgeRoot, packName);
    const files = walkRelative(sourceDir);
    for (const relFile of files) {
      const sourcePath = join3(sourceDir, relFile);
      const targetRelPath = join3(targetPrefix, relFile);
      const targetAbsPath = join3(projectDir, targetRelPath);
      try {
        let content = readFileSync4(sourcePath, "utf8");
        if (relFile.endsWith(".md") && content.includes("{{")) {
          content = renderTemplate(content, renderValues).content;
        }
        const contentHash = hashString(content);
        if (existsSync3(targetAbsPath)) {
          const existingContent = readFileSync4(targetAbsPath, "utf8");
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
        ensureDir(dirname2(targetAbsPath));
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
  if (!existsSync4(packsRoot)) {
    return [
      { pattern: "next.config.ts", pack: "nextjs" },
      { pattern: "next.config.js", pack: "nextjs" },
      { pattern: "next.config.mjs", pack: "nextjs" },
      { pattern: "Package.swift", pack: "swift-ios" },
      { pattern: "*.xcodeproj", pack: "swift-ios" }
    ];
  }
  for (const entry of readdirSync3(packsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join4(packsRoot, entry.name, "pack.json");
    if (!existsSync4(manifestPath)) continue;
    try {
      const manifest = JSON.parse(readFileSync5(manifestPath, "utf8"));
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
  const entries = readdirSync3(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) count++;
    else if (entry.isDirectory()) count += countFilesRecursive(join4(dir, entry.name));
  }
  return count;
}
function detectKnowledgeState(projectDir) {
  const knowledgeDir = join4(projectDir, "Knowledge");
  const hasKnowledgeDir = existsSync4(knowledgeDir);
  let existingAreas = [];
  let fileCount = 0;
  if (hasKnowledgeDir) {
    const entries = readdirSync3(knowledgeDir, { withFileTypes: true });
    existingAreas = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    fileCount = countFilesRecursive(knowledgeDir);
  }
  return {
    hasKnowledgeDir,
    existingAreas,
    fileCount,
    hasConfig: existsSync4(join4(projectDir, ".kdoc.yaml")),
    hasLock: existsSync4(join4(projectDir, ".kdoc.lock")),
    hasPendingLockTmp: existsSync4(join4(projectDir, ".kdoc.lock.tmp"))
  };
}
function detectAITools(projectDir) {
  const tools = [];
  if (existsSync4(join4(projectDir, ".claude")) || existsSync4(join4(projectDir, ".claude-plugin"))) {
    tools.push("claude-code");
  }
  if (existsSync4(join4(projectDir, "AGENTS.md")) || existsSync4(join4(projectDir, ".codex"))) {
    tools.push("codex");
  }
  return { tools };
}
function detectTopology(projectDir) {
  const pkgJsonPath = join4(projectDir, "package.json");
  if (existsSync4(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync5(pkgJsonPath, "utf8"));
      if (pkg.workspaces && (Array.isArray(pkg.workspaces) || pkg.workspaces.packages)) {
        return { suggested: "monorepo", reason: "package.json workspaces detected" };
      }
    } catch {
    }
  }
  if (existsSync4(join4(projectDir, "pnpm-workspace.yaml"))) {
    return { suggested: "monorepo", reason: "pnpm-workspace.yaml detected" };
  }
  const hasPackageJson = existsSync4(pkgJsonPath);
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
  const pkgJsonPath = join4(projectDir, "package.json");
  if (existsSync4(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync5(pkgJsonPath, "utf8"));
      if (Array.isArray(pkg.workspaces)) {
        patterns = pkg.workspaces;
      } else if (pkg.workspaces?.packages) {
        patterns = pkg.workspaces.packages;
      }
    } catch {
    }
  }
  if (patterns.length === 0) {
    const pnpmPath = join4(projectDir, "pnpm-workspace.yaml");
    if (existsSync4(pnpmPath)) {
      try {
        const content = readFileSync5(pnpmPath, "utf8");
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
      const pkgPath = join4(projectDir, match, "package.json");
      if (existsSync4(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync5(pkgPath, "utf8"));
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
import { existsSync as existsSync5 } from "fs";
import { join as join6, relative as relative2 } from "path";

// src/topology/paths.ts
import { join as join5 } from "path";
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
    return filename ? join5(scope.knowledgeRoot, filename) : scope.knowledgeRoot;
  }
  const dirName = AREA_DIR_MAP[area] ?? area;
  const areaPath = dirName ? join5(scope.knowledgeRoot, dirName) : scope.knowledgeRoot;
  return filename ? join5(areaPath, filename) : areaPath;
}

// src/topology/scopes.ts
function resolveScopes(config, projectRoot) {
  const root = config.root ?? "Knowledge";
  const rootPath = `${projectRoot}/${root}`;
  const rootAreas = config.areas ?? {};
  const scopes = [];
  scopes.push({
    name: "root",
    type: "root",
    knowledgeRoot: rootPath,
    areas: rootAreas
  });
  if (config.topology === "monorepo" && config.packages) {
    for (const [pkgName, pkgConfig] of Object.entries(config.packages)) {
      const pkgKnowledgeRoot = `${rootPath}/packages/${pkgName}`;
      scopes.push({
        name: pkgName,
        type: "package",
        knowledgeRoot: pkgKnowledgeRoot,
        // Inherit root areas if package doesn't override
        areas: pkgConfig.areas ?? rootAreas
      });
    }
  }
  if (config.topology === "vault" && config.categories) {
    for (const [catName, catConfig] of Object.entries(config.categories)) {
      scopes.push({
        name: catName,
        type: "category",
        knowledgeRoot: `${rootPath}/${catName}`,
        areas: {}
        // Categories don't use standard areas
      });
    }
  }
  return scopes;
}
function resolveScopeForPackage(config, projectRoot, packageName) {
  if (config.topology !== "monorepo" || !config.packages?.[packageName]) {
    return null;
  }
  const root = config.root ?? "Knowledge";
  const rootPath = `${projectRoot}/${root}`;
  const rootAreas = config.areas ?? {};
  const pkgConfig = config.packages[packageName];
  return {
    name: packageName,
    type: "package",
    knowledgeRoot: `${rootPath}/packages/${packageName}`,
    areas: pkgConfig.areas ?? rootAreas
  };
}
function resolveRootScope(config, projectRoot) {
  const root = config.root ?? "Knowledge";
  return {
    name: "root",
    type: "root",
    knowledgeRoot: `${projectRoot}/${root}`,
    areas: config.areas ?? {}
  };
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
        path: relPath(join6(scope.knowledgeRoot, "README.md")),
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
          path: relPath(knowledgePath(scope, "tldr", join6(areaScope, ".gitkeep"))),
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
  const absPath = join6(projectDir, desiredPath);
  const fileName = desiredPath.split("/").pop() ?? desiredPath;
  const mergeConfig = MERGE_CANDIDATES[fileName];
  if (!existsSync5(absPath)) {
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
import { existsSync as existsSync6, readFileSync as readFileSync6, copyFileSync, readdirSync as readdirSync4 } from "fs";
import { join as join7, dirname as dirname3, basename as basename3 } from "path";

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
  const absSource = join7(projectDir, relativePath);
  const absDest = join7(projectDir, ".kdoc.backup", relativePath);
  if (!existsSync6(absSource)) return;
  if (existsSync6(absDest)) return;
  ensureDir(dirname3(absDest));
  copyFileSync(absSource, absDest);
}
async function applyMerge(op, projectDir, templateContent) {
  const absPath = join7(projectDir, op.path);
  const fileName = op.path.split("/").pop() ?? op.path;
  const existing = existsSync6(absPath) ? readFileSync6(absPath, "utf8") : "";
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
function resolveAdrNextSequence(projectDir, _config, scopePath) {
  const adrDir = join7(projectDir, scopePath, "ADR");
  if (!existsSync6(adrDir)) return "0001";
  const entries = readdirSync4(adrDir);
  const numbers = entries.map((f) => {
    const match = f.match(/^ADR-(\d{4})-/);
    return match ? parseInt(match[1], 10) : 0;
  }).filter((n) => n > 0);
  const max = numbers.length > 0 ? Math.max(...numbers) : 0;
  return String(max + 1).padStart(4, "0");
}
function buildRenderValues(op, config, projectDir) {
  const rootName = config.root ?? "Knowledge";
  const segments = op.path.replaceAll("\\", "/").split("/");
  const values = {};
  let scopePath = rootName;
  if (segments[0] === rootName && segments[1] === "packages" && segments[2]) {
    values.SCOPE = segments[2];
    scopePath = join7(rootName, "packages", segments[2]);
  } else if (config.topology === "vault" && segments[0] === rootName && segments[1]) {
    values.SCOPE = segments[1];
    values.CATEGORY_NAME = segments[1];
    values.CATEGORY_LABEL = config.categories?.[segments[1]]?.label ?? segments[1];
  } else {
    values.SCOPE = "root";
  }
  values.PROJECT_NAME = basename3(projectDir) || "project";
  values.KNOWLEDGE_ROOT = rootName;
  values.DATE = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const owner = getGitOwner(projectDir);
  if (owner) {
    values.OWNER = owner;
  }
  values.ADR_NEXT_SEQUENCE = resolveAdrNextSequence(projectDir, config, scopePath);
  if (values.SCOPE === "root") {
    values.WIKILINK_PREFIX = "";
  } else if (segments[0] === rootName && segments[1] === "packages" && segments[2]) {
    values.WIKILINK_PREFIX = `packages/${segments[2]}/`;
  } else {
    values.WIKILINK_PREFIX = "";
  }
  return values;
}
function renderScaffoldTemplate(op, templateContent, config, projectDir) {
  if (!templateContent.includes("{{")) return templateContent;
  const values = buildRenderValues(op, config, projectDir);
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
          safeWriteFile(join7(projectDir, op.path), renderedContent);
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
          safeWriteFile(join7(projectDir, op.path), templateContent);
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
          safeWriteFile(join7(projectDir, op.path), merged);
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
import { readFileSync as readFileSync7, writeFileSync as writeFileSync3, existsSync as existsSync7 } from "fs";
import { join as join8 } from "path";
import { parseDocument, stringify as stringifyYaml } from "yaml";
var CONFIG_FILENAME = ".kdoc.yaml";
function configPath(projectDir) {
  return join8(projectDir, CONFIG_FILENAME);
}
function configExists(projectDir) {
  return existsSync7(configPath(projectDir));
}
function loadConfig(projectDir) {
  const path = configPath(projectDir);
  if (!existsSync7(path)) return null;
  const raw = readFileSync7(path, "utf8");
  const doc = parseDocument(raw);
  const parsed = doc.toJSON();
  if (parsed["version"] === 1 || !parsed["version"]) {
    if (parsed["version"] === 1 && !parsed["topology"]) {
      console.warn("kdoc: Config version 1 detected. Run `kdoc doctor` for upgrade guidance.");
    }
  }
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
import { readFileSync as readFileSync8 } from "fs";
import { join as join9, dirname as dirname4 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
var __dirname2 = dirname4(fileURLToPath2(import.meta.url));
function getKdocVersion() {
  try {
    const pkgPath = join9(__dirname2, "..", "package.json");
    const pkg = JSON.parse(readFileSync8(pkgPath, "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

// src/templates/catalog.ts
import { existsSync as existsSync8, readFileSync as readFileSync9 } from "fs";
import { dirname as dirname5, join as join10 } from "path";
import { fileURLToPath as fileURLToPath3 } from "url";
var __filename = fileURLToPath3(import.meta.url);
var __dirname3 = dirname5(__filename);
var cliRoot = [join10(__dirname3, ".."), join10(__dirname3, "..", "..")].find(
  (candidate) => existsSync8(join10(candidate, "package.json"))
) ?? join10(__dirname3, "..", "..");
var kdocRoot = join10(cliRoot, "..");
var coreTemplatesDir = join10(kdocRoot, "core", "templates");
var packsDir = join10(kdocRoot, "packs");
var CREATE_TEMPLATE_MAP = {
  adr: "adr.md",
  tldr: "tldr.md",
  phase: "phase.md",
  "sub-phase": "sub-phase.md",
  guide: "guide.md",
  "threat-model": "threat-model.md",
  runbook: "runbook.md",
  "test-map": "test-map.md"
};
function resolveCoreTemplatePath(name) {
  const fileName = name.endsWith(".md") ? name : CREATE_TEMPLATE_MAP[name] ?? `${name}.md`;
  return join10(coreTemplatesDir, fileName);
}
function loadTemplate(type) {
  const filePath = resolveCoreTemplatePath(type);
  if (!existsSync8(filePath)) {
    throw new Error(`Template not found for type "${type}": ${filePath}`);
  }
  return readFileSync9(filePath, "utf8");
}
function resolveTemplateSource(templateName) {
  if (templateName.startsWith("core/templates/")) {
    const relFile2 = templateName.slice("core/templates/".length);
    const filePath2 = join10(coreTemplatesDir, relFile2);
    if (!existsSync8(filePath2)) return null;
    return { sourcePath: filePath2, content: readFileSync9(filePath2, "utf8") };
  }
  const packsMatch = templateName.match(/^packs\/([^/]+)\/templates\/(.+)$/);
  if (!packsMatch) return null;
  const [, packName, relFile] = packsMatch;
  const filePath = join10(packsDir, packName, "templates", relFile);
  if (!existsSync8(filePath)) return null;
  return { sourcePath: filePath, content: readFileSync9(filePath, "utf8") };
}
function createTemplateResolver(syntheticTemplates) {
  return (templateName) => {
    if (templateName in syntheticTemplates) {
      return { sourcePath: templateName, content: syntheticTemplates[templateName] };
    }
    return resolveTemplateSource(templateName);
  };
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
import { existsSync as existsSync9, readFileSync as readFileSync10 } from "fs";
import { dirname as dirname6, join as join11 } from "path";
import { fileURLToPath as fileURLToPath4 } from "url";
import { spawnSync } from "child_process";
var __dirname4 = dirname6(fileURLToPath4(import.meta.url));
function getKdocRoot() {
  const bundledPath = join11(__dirname4, "..", "..");
  if (existsSync9(join11(bundledPath, "integrations"))) return bundledPath;
  return join11(__dirname4, "..", "..", "..");
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
  return join11(getKdocRoot(), "integrations", tool, "install.js");
}
function readInstalledContent(projectDir, relativePath) {
  const absolutePath = join11(projectDir, relativePath);
  if (!existsSync9(absolutePath)) return null;
  try {
    return readFileSync10(absolutePath, "utf8");
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
  if (!existsSync9(installerPath)) {
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
              const absPath = join12(projectDir, op.path);
              if (existsSync10(absPath)) {
                const content = readFileSync11(absPath, "utf8");
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
        } else if (existsSync10(op.source)) {
          templateContents.set(op.source, readFileSync11(op.source, "utf8"));
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
          dryRun,
          kdocVersion: getKdocVersion()
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
import { existsSync as existsSync11, mkdirSync as mkdirSync2, readFileSync as readFileSync12 } from "fs";
import { join as join13 } from "path";
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
    } else if (existsSync11(op.source)) {
      templateContents.set(op.source, readFileSync12(op.source, "utf8"));
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
          const baseDir = options.package ? join13(projectDir, knowledgeRoot, "packages", options.package) : join13(projectDir, knowledgeRoot);
          mkdirSync2(join13(baseDir, dirName), { recursive: true });
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
import { existsSync as existsSync12, readFileSync as readFileSync13, renameSync as renameSync2, unlinkSync as unlinkSync2, copyFileSync as copyFileSync2 } from "fs";
import { join as join14, dirname as dirname7, basename as basename4 } from "path";
import { fileURLToPath as fileURLToPath5 } from "url";
import fg2 from "fast-glob";
var __filename2 = fileURLToPath5(import.meta.url);
var __dirname5 = dirname7(__filename2);
var SYNTHETIC_TEMPLATES2 = {
  "core/templates/gitkeep": "",
  "core/templates/claude-md-block.md": "kdoc Knowledge documentation toolkit is installed.\n\nRun `npx kdoc doctor` to check your setup.\n",
  "core/templates/agents-md-block.md": "kdoc Knowledge documentation toolkit is installed.\n\nRun `npx kdoc doctor` to check your setup.\n",
  "core/templates/gitignore-block": ".kdoc.backup/\n.kdoc.lock.tmp\n",
  "core/templates/package-json-scripts": JSON.stringify({ "kdoc:check": "npx kdoc doctor" })
};
function makeUpdateTemplateResolver() {
  const cliRoot2 = join14(__dirname5, "..", "..");
  const kdocRoot2 = join14(cliRoot2, "..");
  const coreTemplatesDir2 = join14(kdocRoot2, "core", "templates");
  const packsDir2 = join14(kdocRoot2, "packs");
  return (templateName) => {
    if (templateName in SYNTHETIC_TEMPLATES2) {
      return { sourcePath: templateName, content: SYNTHETIC_TEMPLATES2[templateName] };
    }
    if (templateName.startsWith("core/templates/")) {
      const relFile = templateName.slice("core/templates/".length);
      const filePath = join14(coreTemplatesDir2, relFile);
      if (existsSync12(filePath)) {
        return { sourcePath: templateName, content: readFileSync13(filePath, "utf8") };
      }
      return null;
    }
    const packsMatch = templateName.match(/^packs\/([^/]+)\/templates\/(.+)$/);
    if (packsMatch) {
      const [, packName, relFile] = packsMatch;
      const filePath = join14(packsDir2, packName, "templates", relFile);
      if (existsSync12(filePath)) {
        return { sourcePath: templateName, content: readFileSync13(filePath, "utf8") };
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
    const absPath = join14(projectDir, path);
    let currentFileHash;
    if (existsSync12(absPath)) {
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
  for (const [lockPath2, lockEntry] of Object.entries(lock.files)) {
    if (!matchedLockPaths.has(lockPath2)) {
      if (lockEntry.action === "merged") {
        ops.push({ type: "SKIP", path: lockPath2 });
      } else {
        ops.push({ type: "REMOVE", path: lockPath2, userModified: false });
      }
    }
  }
  return ops;
}
function backupFile2(projectDir, relativePath) {
  const absSource = join14(projectDir, relativePath);
  const absDest = join14(projectDir, ".kdoc.backup", relativePath);
  if (!existsSync12(absSource)) return;
  if (existsSync12(absDest)) return;
  ensureDir(dirname7(absDest));
  copyFileSync2(absSource, absDest);
}
function buildRenderValues2(config, projectDir) {
  const resolvedDir = projectDir ?? process.env.KDOC_PROJECT_DIR ?? process.cwd();
  return {
    PROJECT_NAME: basename4(resolvedDir) || "Project",
    KNOWLEDGE_ROOT: config.root ?? "Knowledge",
    SCOPE: "root",
    DATE: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
    WIKILINK_PREFIX: ""
  };
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
  const renderValues = buildRenderValues2(config, projectDir);
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
        const { content: rendered } = renderTemplate(resolved.content, renderValues);
        const absPath = join14(projectDir, op.path);
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
        const { content: rendered } = renderTemplate(resolved.content, renderValues);
        const absPath = join14(projectDir, op.path);
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
        const absPath = join14(projectDir, op.path);
        if (existsSync12(absPath)) {
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
          unlinkSync2(absPath);
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
        const absOld = join14(projectDir, op.oldPath);
        const absNew = join14(projectDir, op.newPath);
        if (op.userModified) {
          backupFile2(projectDir, op.oldPath);
        }
        ensureDir(dirname7(absNew));
        if (existsSync12(absOld)) {
          renameSync2(absOld, absNew);
        }
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
  const knowledgeDir = join14(projectDir, root);
  if (!existsSync12(knowledgeDir)) {
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
    const absPath = join14(knowledgeDir, relPath);
    const content = readFileSync13(absPath, "utf8");
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
    }) : { created: [], updated: [], skipped: [], merged: [], removed: [], renamed: [], errors: [] };
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

// src/commands/doctor.ts
import { Command as Command4 } from "commander";
import { existsSync as existsSync14, readdirSync as readdirSync6 } from "fs";
import { dirname as dirname8, join as join17 } from "path";
import { fileURLToPath as fileURLToPath6 } from "url";

// src/governance/scopes.ts
import { existsSync as existsSync13 } from "fs";
import { join as join15 } from "path";
function runScopedStructureChecks(config, projectDir) {
  const results = [];
  const scopes = resolveScopes(config, projectDir);
  for (const scope of scopes) {
    if (scope.type === "root") {
      const rootChecks = runStructureChecks(projectDir, config.root, scope.areas);
      for (const check of rootChecks) {
        results.push({
          ...check,
          name: `[root] ${check.name}`
        });
      }
    } else if (scope.type === "package") {
      if (!existsSync13(scope.knowledgeRoot)) {
        results.push({
          category: "structure",
          name: `[${scope.name}] Knowledge directory exists`,
          status: "warn",
          message: `Package Knowledge directory not found: ${scope.knowledgeRoot}`,
          fix: `npx kdoc init (re-run to scaffold package directories)`
        });
        continue;
      }
      for (const [areaName, areaConfig] of Object.entries(scope.areas)) {
        if (!areaConfig.enabled) continue;
        const areaDir = getAreaDir(areaName);
        if (!areaDir) continue;
        const fullPath = join15(scope.knowledgeRoot, areaDir);
        if (!existsSync13(fullPath)) {
          results.push({
            category: "structure",
            name: `[${scope.name}] ${areaDir} directory exists`,
            status: "warn",
            message: `Package ${scope.name}: ${areaDir}/ not found`
          });
          continue;
        }
        results.push({
          category: "structure",
          name: `[${scope.name}] ${areaDir} directory exists`,
          status: "pass",
          message: `Package ${scope.name}: ${areaDir}/ found`
        });
        const expectation = AREA_EXPECTATIONS[areaName];
        if (!expectation) continue;
        if (expectation.type === "readme-required") {
          const readmePath = join15(fullPath, "README.md");
          const readmeExists = existsSync13(readmePath);
          results.push({
            category: "structure",
            name: `[${scope.name}] ${areaDir}/README.md exists`,
            status: readmeExists ? "pass" : "warn",
            message: readmeExists ? `Package ${scope.name}: ${areaDir}/README.md found` : `Package ${scope.name}: ${areaDir}/README.md is missing`
          });
        }
        if (expectation.type === "seed-file-required" && expectation.file) {
          const seedPath = join15(fullPath, expectation.file);
          const seedExists = existsSync13(seedPath);
          results.push({
            category: "structure",
            name: `[${scope.name}] ${areaDir}/${expectation.file} exists`,
            status: seedExists ? "pass" : "warn",
            message: seedExists ? `Package ${scope.name}: ${expectation.file} found` : `Package ${scope.name}: ${expectation.file} is missing`
          });
        }
      }
    } else if (scope.type === "category") {
      if (!existsSync13(scope.knowledgeRoot)) {
        results.push({
          category: "structure",
          name: `[${scope.name}] category directory exists`,
          status: "warn",
          message: `Category directory not found: ${scope.name}/`,
          fix: `Create the directory manually or re-run kdoc init`
        });
      } else {
        results.push({
          category: "structure",
          name: `[${scope.name}] category directory exists`,
          status: "pass",
          message: `Category ${scope.name}/ found`
        });
        const readmePath = join15(scope.knowledgeRoot, "README.md");
        if (!existsSync13(readmePath)) {
          results.push({
            category: "structure",
            name: `[${scope.name}] README.md exists`,
            status: "warn",
            message: `Category ${scope.name}/ is missing README.md`
          });
        }
      }
    }
  }
  return results;
}
function runScopedStructureChecksForPackage(config, projectDir, packageName) {
  const scope = resolveScopeForPackage(config, projectDir, packageName);
  if (!scope) {
    return [{
      category: "structure",
      name: `[${packageName}] package configured`,
      status: "fail",
      message: `Package "${packageName}" is not configured in .kdoc.yaml`
    }];
  }
  const results = [];
  if (!existsSync13(scope.knowledgeRoot)) {
    results.push({
      category: "structure",
      name: `[${packageName}] Knowledge directory exists`,
      status: "warn",
      message: `Package Knowledge directory not found: ${scope.knowledgeRoot}`
    });
    return results;
  }
  for (const [areaName, areaConfig] of Object.entries(scope.areas)) {
    if (!areaConfig.enabled) continue;
    const areaDir = getAreaDir(areaName);
    if (!areaDir) continue;
    const fullPath = join15(scope.knowledgeRoot, areaDir);
    if (!existsSync13(fullPath)) {
      results.push({
        category: "structure",
        name: `[${packageName}] ${areaDir} directory exists`,
        status: "warn",
        message: `Package ${packageName}: ${areaDir}/ not found`
      });
      continue;
    }
    results.push({
      category: "structure",
      name: `[${packageName}] ${areaDir} directory exists`,
      status: "pass",
      message: `Package ${packageName}: ${areaDir}/ found`
    });
    const expectation = AREA_EXPECTATIONS[areaName];
    if (!expectation) continue;
    if (expectation.type === "readme-required") {
      const readmePath = join15(fullPath, "README.md");
      const readmeExists = existsSync13(readmePath);
      results.push({
        category: "structure",
        name: `[${packageName}] ${areaDir}/README.md exists`,
        status: readmeExists ? "pass" : "warn",
        message: readmeExists ? `Package ${packageName}: ${areaDir}/README.md found` : `Package ${packageName}: ${areaDir}/README.md is missing`
      });
    }
    if (expectation.type === "seed-file-required" && expectation.file) {
      const seedPath = join15(fullPath, expectation.file);
      const seedExists = existsSync13(seedPath);
      results.push({
        category: "structure",
        name: `[${packageName}] ${areaDir}/${expectation.file} exists`,
        status: seedExists ? "pass" : "warn",
        message: seedExists ? `Package ${packageName}: ${expectation.file} found` : `Package ${packageName}: ${expectation.file} is missing`
      });
    }
  }
  return results;
}
function getAreaDir(areaName) {
  const MAP = {
    "adr": "ADR",
    "tldr": "TLDR",
    "roadmap": "Roadmap",
    "design": "Design",
    "guides": "Guides",
    "agent-memory": "AgentMemory",
    "runbooks": "runbooks",
    "threat-models": "ThreatModels",
    "templates": "Templates",
    "governance": "governance"
  };
  return MAP[areaName] ?? null;
}

// src/governance/intent.ts
import { readFileSync as readFileSync14 } from "fs";
import { join as join16 } from "path";
import fg3 from "fast-glob";
var PLACEHOLDER_PATTERNS = [
  /^\s*$/,
  /^TODO\b/i,
  /^TBD\b/i,
  /^fill\s+in/i,
  /^placeholder/i,
  /^describe\s+/i,
  /^add\s+/i,
  /^write\s+/i
];
function isPlaceholderText(text) {
  const trimmed = text.trim();
  if (!trimmed) return true;
  return PLACEHOLDER_PATTERNS.some((p) => p.test(trimmed));
}
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: "", body: content, hasFrontmatter: false };
  return { frontmatter: match[1], body: match[2], hasFrontmatter: true };
}
function getIntentValue(frontmatter) {
  const match = frontmatter.match(/^intent\s*:\s*(.*)$/m);
  if (!match) return null;
  return match[1].replace(/^["']|["']$/g, "").trim();
}
function getWhySectionContent(body) {
  const whyMatch = body.match(/^##\s+(Why|Rationale)\b[^\n]*\n([\s\S]*?)(?=^##\s|\Z)/m);
  if (!whyMatch) return null;
  return whyMatch[2].trim();
}
function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}
function runIntentChecks(options) {
  const { knowledgeRoot, scope, minWhyWords = 20 } = options;
  const results = [];
  const mdFiles = fg3.sync("**/*.md", {
    cwd: knowledgeRoot,
    absolute: false,
    ignore: ["**/node_modules/**", "**/.obsidian/**", "**/.compiled/**", "**/packages/**"]
  });
  for (const relPath of mdFiles) {
    const absPath = join16(knowledgeRoot, relPath);
    let content;
    try {
      content = readFileSync14(absPath, "utf8");
    } catch {
      continue;
    }
    const { frontmatter, body, hasFrontmatter } = parseFrontmatter(content);
    if (!hasFrontmatter) continue;
    const intentValue = getIntentValue(frontmatter);
    if (intentValue === null) {
      results.push({
        category: "governance",
        name: `[${scope}] intent: ${relPath}`,
        status: "warn",
        message: `Missing intent field in frontmatter: ${relPath}`,
        fix: "kdoc update --retrofit-intent"
      });
    } else if (isPlaceholderText(intentValue)) {
      results.push({
        category: "governance",
        name: `[${scope}] intent: ${relPath}`,
        status: "warn",
        message: `Empty or placeholder intent in: ${relPath}`
      });
    }
    const whyContent = getWhySectionContent(body);
    if (whyContent === null) {
      results.push({
        category: "governance",
        name: `[${scope}] rationale: ${relPath}`,
        status: "warn",
        message: `Missing ## Why or ## Rationale section in: ${relPath}`,
        fix: "kdoc update --retrofit-intent"
      });
    } else if (countWords(whyContent) < minWhyWords) {
      const wordCount = countWords(whyContent);
      if (isPlaceholderText(whyContent) || wordCount < 5) {
        results.push({
          category: "governance",
          name: `[${scope}] rationale: ${relPath}`,
          status: "warn",
          message: `Placeholder ## Why section in: ${relPath} (${wordCount} words, min ${minWhyWords})`
        });
      }
    }
  }
  return results;
}

// src/commands/doctor.ts
var AREA_EXPECTATIONS = {
  adr: { path: "ADR", type: "readme-required" },
  tldr: { path: "TLDR", type: "readme-required" },
  roadmap: { path: "Roadmap", type: "readme-required" },
  design: { path: "Design", type: "readme-required" },
  guides: { path: "Guides", type: "empty-ok" },
  "agent-memory": { path: "AgentMemory", type: "seed-file-required", file: "MEMORY.md" },
  runbooks: { path: "runbooks", type: "empty-ok" },
  "threat-models": { path: "ThreatModels", type: "empty-ok" },
  templates: { path: "Templates", type: "empty-ok" },
  governance: { path: "", type: "empty-ok" },
  // scripts live in scripts/kdoc/
  "context-pack": { path: "", type: "seed-file-required", file: "ContextPack.md" },
  index: { path: "", type: "generated-required", file: "INDEX.md" }
};
function countMarkdownFilesRecursive(dir) {
  let count = 0;
  for (const entry of readdirSync6(dir, { withFileTypes: true })) {
    const fullPath = join17(dir, entry.name);
    if (entry.isDirectory()) {
      count += countMarkdownFilesRecursive(fullPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md") {
      count += 1;
    }
  }
  return count;
}
function runConfigChecks(projectDir) {
  const results = [];
  const configFilePath = join17(projectDir, ".kdoc.yaml");
  if (!existsSync14(configFilePath)) {
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
  const lockFilePath = join17(projectDir, ".kdoc.lock");
  if (!existsSync14(lockFilePath)) {
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
  const kRoot = join17(projectDir, knowledgeRoot);
  for (const [areaName, areaConfig] of Object.entries(areas)) {
    if (!areaConfig.enabled) continue;
    const expectation = AREA_EXPECTATIONS[areaName];
    if (!expectation) continue;
    const areaDir = expectation.path ? join17(kRoot, expectation.path) : kRoot;
    const displayPath = expectation.path || knowledgeRoot;
    if (expectation.path && !existsSync14(areaDir)) {
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
        const readmePath = join17(areaDir, "README.md");
        const readmeExists = existsSync14(readmePath);
        results.push({
          category: "structure",
          name: `${displayPath}/README.md exists`,
          status: readmeExists ? "pass" : "fail",
          message: readmeExists ? `${displayPath}/README.md found` : `${displayPath}/README.md is missing`,
          fix: readmeExists ? void 0 : `npx kdoc add ${areaName}`
        });
        if (readmeExists) {
          if (countMarkdownFilesRecursive(areaDir) === 0) {
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
        const targetPath = expectation.path ? join17(areaDir, expectation.file) : join17(kRoot, expectation.file);
        const targetExists = existsSync14(targetPath);
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
  const projectScriptsDir = join17(projectDir, "scripts", config.scripts.prefix);
  const thisFile = fileURLToPath6(import.meta.url);
  const cliDir = [dirname8(thisFile), join17(dirname8(thisFile), ".."), join17(dirname8(thisFile), "..", "..")].find(
    (c) => existsSync14(join17(c, "package.json"))
  ) ?? dirname8(thisFile);
  const coreScriptsDir = join17(cliDir, "..", "core", "scripts");
  const expectedScripts = [
    "check_sync.py",
    "check_wikilinks.py",
    "build_index.py",
    "check_adr_governance.py",
    "governance_health.py"
  ];
  for (const script of expectedScripts) {
    const projectPath = join17(projectScriptsDir, script);
    const corePath = join17(coreScriptsDir, script);
    const foundInProject = existsSync14(projectPath);
    const foundInCore = existsSync14(corePath);
    if (foundInProject) {
      checks.push({
        category: "scripts",
        name: `script-${script}`,
        status: "warn",
        message: `Python compatibility shim present at scripts/${config.scripts.prefix}/${script}. Doctor now uses the JS governance engine as the canonical backend.`
      });
    } else if (foundInCore) {
      checks.push({
        category: "scripts",
        name: `script-${script}`,
        status: "warn",
        message: `Python compatibility shim available in kdoc package (${script}); doctor now uses the JS governance engine as the canonical backend.`,
        fix: `Keep ${script} only for compatibility flows; prefer \`npx kdoc doctor\` for governance validation.`
      });
    } else {
      continue;
    }
  }
  return checks;
}
async function runGovernanceEngineChecks(projectDir) {
  try {
    const currentDir = dirname8(fileURLToPath6(import.meta.url));
    const enginePath = [
      join17(currentDir, "..", "..", "..", "core", "governance-engine.mjs"),
      join17(currentDir, "..", "..", "core", "governance-engine.mjs"),
      join17(currentDir, "..", "core", "governance-engine.mjs")
    ].find((candidate) => existsSync14(candidate));
    if (!enginePath) {
      throw new Error("Unable to resolve governance-engine.mjs");
    }
    const engine = await import(enginePath);
    const report = engine.runGovernance(projectDir, { knowledgeRoot: loadConfig(projectDir)?.root ?? "Knowledge" });
    if (!report.violations || report.violations.length === 0) {
      return [{
        category: "governance",
        name: "governance-engine",
        status: "pass",
        message: "JS governance engine checks passed"
      }];
    }
    return report.violations.map((violation) => ({
      category: "governance",
      name: violation.code,
      status: violation.severity === "error" ? "fail" : "warn",
      message: violation.path ? `${violation.path}: ${violation.message}` : violation.message,
      fix: violation.fix
    }));
  } catch (error) {
    return [{
      category: "governance",
      name: "governance-engine",
      status: "fail",
      message: `JS governance engine failed: ${error instanceof Error ? error.message : String(error)}`
    }];
  }
}
function runIntegrationChecks(projectDir, tools) {
  const results = [];
  if (tools.includes("claude-code")) {
    const claudePath = join17(projectDir, "CLAUDE.md");
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
    const agentsPath = join17(projectDir, "AGENTS.md");
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
  const pkgPath = join17(projectDir, "package.json");
  if (existsSync14(pkgPath)) {
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
  cmd.description("Check the health of your kdoc installation").option("--json", "Output results as JSON").option("--package <name>", "Validate only the specified package scope").action(async (opts) => {
    const cwd = process.env.KDOC_PROJECT_DIR ?? process.cwd();
    const configChecks = runConfigChecks(cwd);
    const configFailed = configChecks.some((c) => c.status === "fail");
    const allChecks = [...configChecks];
    if (!configFailed) {
      const config = loadConfig(cwd);
      if (config) {
        if (opts.package) {
          allChecks.push(...runScopedStructureChecksForPackage(config, cwd, opts.package));
        } else if (config.topology === "monorepo" || config.topology === "vault") {
          allChecks.push(...runScopedStructureChecks(config, cwd));
        } else {
          allChecks.push(...runStructureChecks(cwd, config.root, config.areas));
        }
        const extensionAreas = config.extensionAreas;
        if (extensionAreas && extensionAreas.length > 0) {
          const kRoot = join17(cwd, config.root);
          for (const ext of extensionAreas) {
            const extDir = join17(kRoot, ext.directory);
            const extExists = existsSync14(extDir);
            allChecks.push({
              category: "structure",
              name: `extension:${ext.name} directory exists`,
              status: extExists ? "pass" : "warn",
              message: extExists ? `Extension area "${ext.name}" at ${ext.directory}/ is present` : `Extension area "${ext.name}" at ${ext.directory}/ not found`
            });
            if (extExists && ext.required_files) {
              for (const req of ext.required_files) {
                const reqPath = join17(extDir, req);
                const reqExists = existsSync14(reqPath);
                allChecks.push({
                  category: "structure",
                  name: `extension:${ext.name}/${req} exists`,
                  status: reqExists ? "pass" : "fail",
                  message: reqExists ? `Required file ${req} found in extension area "${ext.name}"` : `Required file ${req} missing in extension area "${ext.name}"`
                });
              }
            }
          }
        }
        allChecks.push(...runIntegrationChecks(cwd, config.tools));
        allChecks.push(...runScriptChecks(cwd, config));
        allChecks.push(...await runGovernanceEngineChecks(cwd));
        const intentCheckEnabled = config.governance["intent-check"] !== false;
        if (intentCheckEnabled) {
          const scopes = resolveScopes(config, cwd);
          for (const scope of scopes) {
            if (scope.type === "category") continue;
            if (opts.package && scope.name !== opts.package && scope.type !== "root") continue;
            if (existsSync14(scope.knowledgeRoot)) {
              allChecks.push(...runIntentChecks({
                knowledgeRoot: scope.knowledgeRoot,
                scope: scope.name
              }));
            }
          }
        }
      }
    }
    const report = buildDoctorReport(getKdocVersion(), allChecks);
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
import { existsSync as existsSync15, readdirSync as readdirSync7 } from "fs";
import { basename as basename5, join as join18 } from "path";
import { readFileSync as readFileSync15 } from "fs";
import { dirname as dirname9 } from "path";
import { fileURLToPath as fileURLToPath7 } from "url";
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
  if (!existsSync15(adrDir)) return "0001";
  const entries = readdirSync7(adrDir);
  const numbers = entries.map((f) => {
    const match = f.match(/^ADR-(\d{4})-/);
    return match ? parseInt(match[1], 10) : 0;
  }).filter((n) => n > 0);
  const max = numbers.length > 0 ? Math.max(...numbers) : 0;
  return String(max + 1).padStart(4, "0");
}
function resolvePhaseNumber(phasesDir) {
  if (!existsSync15(phasesDir)) return 1;
  const entries = readdirSync7(phasesDir);
  const numbers = entries.map((f) => {
    const match = f.match(/^phase-(\d+)\.md$/);
    return match ? parseInt(match[1], 10) : 0;
  }).filter((n) => n > 0);
  return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
}
function resolveSubPhaseNumber(parentDir, parentNum) {
  if (!existsSync15(parentDir)) return 1;
  const entries = readdirSync7(parentDir);
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
  if (!existsSync15(adrDir)) return null;
  for (const entry of readdirSync7(adrDir)) {
    const match = entry.match(/^ADR-\d{4}-(.+)\.md$/);
    if (!match) continue;
    if (slugify(match[1]) === slug) {
      return join18(adrDir, entry);
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
    return join18(knowledgeScope.knowledgeRoot, `${slug}.md`);
  }
  switch (type) {
    case "adr":
      return knowledgePath(knowledgeScope, "adr", `ADR-${adrNumber}-${slug}.md`);
    case "tldr":
      return knowledgePath(knowledgeScope, "tldr", join18(tldrScope ?? "_noscope", `${slug}.md`));
    case "phase": {
      const phasesDir = knowledgePath(knowledgeScope, "roadmap", "phases");
      const phaseNum = resolvePhaseNumber(phasesDir);
      return join18(phasesDir, `phase-${phaseNum}.md`);
    }
    case "sub-phase": {
      const phasesDir = knowledgePath(knowledgeScope, "roadmap", "phases");
      const parentDir = join18(phasesDir, `phase-${parent}`);
      const subNum = resolveSubPhaseNumber(parentDir, parent);
      return join18(parentDir, `${parent}.${subNum}.md`);
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
  const cmd = new Command5("create");
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
        knowledgeRoot: join18(cwd, config.root, opts.category),
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
    if (existsSync15(outputPath)) {
      console.error(`Error: File already exists: ${outputPath}`);
      process.exitCode = 1;
      return;
    }
    const templateContent = loadTemplate(type);
    const projectName = basename5(cwd) || "project";
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
      const parentDir = join18(phasesDir, `phase-${opts.parent}`);
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
      const __create_dir = dirname9(fileURLToPath7(import.meta.url));
      const enginePath = join18(__create_dir, "..", "..", "..", "core", "governance-engine.mjs");
      const engine = await import(enginePath);
      engine.emitDaemonEvent("kdoc.artifact_created", {
        type,
        name: normalizedName,
        path: outputPath
      });
    } catch {
    }
    try {
      const __create_dirname = dirname9(fileURLToPath7(import.meta.url));
      const schemaPath = join18(__create_dirname, "..", "..", "..", "core", "schema", "frontmatter-schemas.json");
      const schemas = JSON.parse(readFileSync15(schemaPath, "utf8"));
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
import { Command as Command6 } from "commander";
import { existsSync as existsSync16, readFileSync as readFileSync16, writeFileSync as writeFileSync4, rmSync as rmSync2 } from "fs";
import { join as join19, dirname as dirname10, resolve } from "path";
function undoCreatedEntry(filePath, lockedHash, opts) {
  if (!existsSync16(filePath)) {
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
  if (!existsSync16(filePath)) {
    return { path: filePath, action: "skipped", reason: "File does not exist" };
  }
  const content = readFileSync16(filePath, "utf8");
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
  if (!existsSync16(filePath)) {
    return { path: filePath, action: "skipped", reason: "File does not exist" };
  }
  const content = readFileSync16(filePath, "utf8");
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
  let current = dirname10(resolve(filePath));
  const root = resolve(process.cwd());
  while (current !== root && current !== dirname10(current)) {
    const deleted = deleteIfEmpty(current);
    if (!deleted) break;
    current = dirname10(current);
  }
}
function registerUndoCommand(program) {
  const cmd = new Command6("undo");
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
      const absolutePath = join19(cwd, filePath);
      if (entry.action === "created") {
        results.push(undoCreatedEntry(absolutePath, entry.hash, undoOpts));
      } else if (entry.action === "merged" && entry.strategy === "markers") {
        const markerName = entry.markerName ?? "core";
        results.push(undoMergedMarkersEntry(absolutePath, markerName));
      } else if (entry.action === "merged" && entry.strategy === "prefix") {
        results.push(undoMergedPrefixEntry(absolutePath));
      }
    }
    const lockPath2 = join19(cwd, ".kdoc.lock");
    const lockTmpPath2 = join19(cwd, ".kdoc.lock.tmp");
    if (existsSync16(lockPath2)) rmSync2(lockPath2);
    if (existsSync16(lockTmpPath2)) rmSync2(lockTmpPath2);
    const backupDir = join19(cwd, ".kdoc.backup");
    if (existsSync16(backupDir)) rmSync2(backupDir, { recursive: true });
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
import { mkdtempSync, readdirSync as readdirSync8, readFileSync as readFileSync17, writeFileSync as writeFileSync5, rmSync as rmSync3 } from "fs";
import { join as join20, relative as relative3 } from "path";
import { tmpdir } from "os";
import { createHash as createHash2 } from "crypto";
import { fileURLToPath as fileURLToPath8 } from "url";
function hashBuffer(buf) {
  return "sha256:" + createHash2("sha256").update(buf).digest("hex");
}
function captureSnapshot(rootDir) {
  const snapshot = {};
  function walk(dir) {
    for (const entry of readdirSync8(dir, { withFileTypes: true })) {
      const fullPath = join20(dir, entry.name);
      const relPath = relative3(rootDir, fullPath);
      if (entry.isDirectory()) {
        snapshot[relPath] = { hash: "", size: 0, isDirectory: true };
        walk(fullPath);
      } else {
        const buf = readFileSync17(fullPath);
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
var __selftest_filename = fileURLToPath8(import.meta.url);
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
  const tmpDir = mkdtempSync(join20(tmpdir(), "kdoc-selftest-"));
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
        const fullPath = join20(tmpDir, readmeFile);
        const content = readFileSync17(fullPath, "utf8");
        writeFileSync5(fullPath, content + "\n\n## User addition\nThis was added by the user.\n");
        mutations.push(`appended: ${readmeFile}`);
      }
      const otherFile = files.find((f) => f !== readmeFile && f.endsWith(".md"));
      if (otherFile) {
        const fullPath = join20(tmpDir, otherFile);
        const content = readFileSync17(fullPath, "utf8");
        writeFileSync5(fullPath, content + "\nModified by selftest.\n");
        mutations.push(`modified: ${otherFile}`);
      }
      const configFile = files.find((f) => f === ".kdoc.yaml");
      if (configFile) {
        const fullPath = join20(tmpDir, configFile);
        const content = readFileSync17(fullPath, "utf8");
        writeFileSync5(fullPath, content + "\n# User comment\n");
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

// src/commands/brief.ts
import { Command as Command7 } from "commander";
import { execFileSync as execFileSync2 } from "child_process";
import { join as join23 } from "path";

// src/compiler/parser.ts
import { existsSync as existsSync17, readdirSync as readdirSync9, readFileSync as readFileSync18 } from "fs";
import { join as join21, relative as relative4 } from "path";
import { parseDocument as parseDocument2 } from "yaml";
function walkMarkdownFiles(rootDir) {
  if (!existsSync17(rootDir)) return [];
  const files = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = readdirSync9(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".compiled") continue;
      const absolutePath = join21(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(absolutePath);
      }
    }
  }
  return files.sort();
}
function parseFrontmatterAndBody(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  const frontmatterDoc = parseDocument2(match[1]);
  if (frontmatterDoc.errors.length > 0) {
    throw frontmatterDoc.errors[0];
  }
  const parsed = frontmatterDoc.toJSON() ?? {};
  return {
    frontmatter: parsed,
    body: content.slice(match[0].length)
  };
}
function parseHeadings(body) {
  const headings = [];
  const matches = body.matchAll(/^(#{1,6})\s+(.+)$/gm);
  for (const match of matches) {
    headings.push({ level: match[1].length, text: match[2].trim() });
  }
  return headings;
}
function extractTags(frontmatter, body) {
  const tags = /* @__PURE__ */ new Set();
  const fmTags = frontmatter.tags;
  if (Array.isArray(fmTags)) {
    for (const tag of fmTags) {
      if (typeof tag === "string" && tag.trim()) tags.add(tag.trim());
    }
  } else if (typeof fmTags === "string" && fmTags.trim()) {
    tags.add(fmTags.trim());
  }
  for (const match of body.matchAll(/(^|\s)#([A-Za-z0-9_-]+)/g)) {
    tags.add(match[2]);
  }
  return [...tags];
}
function extractWikilinks(content) {
  const links = /* @__PURE__ */ new Set();
  for (const match of content.matchAll(/\[\[([^\]]+)\]\]/g)) {
    links.add(match[1].split("|")[0].trim());
  }
  return [...links];
}
function countWords2(body) {
  return body.match(/[A-Za-z0-9_]+/g)?.length ?? 0;
}
function inferType(path, frontmatter) {
  if (typeof frontmatter.type === "string" && frontmatter.type.trim()) {
    return frontmatter.type;
  }
  const normalized = path.replace(/^packages\/[^/]+\//, "");
  if (normalized.startsWith("ADR/") || normalized.includes("/ADR/")) return "adr";
  if (normalized.startsWith("TLDR/") || normalized.includes("/TLDR/")) return "tldr";
  if (normalized.startsWith("Roadmap/") || normalized.includes("/Roadmap/")) {
    return normalized.includes("/phase-") ? "sub-phase" : "phase";
  }
  if (normalized.startsWith("Design/") || normalized.includes("/Design/")) return "design-spec";
  if (normalized.startsWith("Guides/") || normalized.includes("/Guides/")) return "guide";
  if (normalized.startsWith("runbooks/") || normalized.includes("/runbooks/")) return "runbook";
  if (normalized.startsWith("AgentMemory/") || normalized.includes("/AgentMemory/")) return "memory";
  if (normalized.endsWith("ContextPack.md")) return "context-pack";
  return "document";
}
function parseKnowledgeDocs(projectDir, knowledgeRoot = "Knowledge") {
  const knowledgeDir = join21(projectDir, knowledgeRoot);
  const files = walkMarkdownFiles(knowledgeDir);
  const docs = [];
  for (const absolutePath of files) {
    const content = readFileSync18(absolutePath, "utf8");
    const path = relative4(knowledgeDir, absolutePath).replaceAll("\\", "/");
    let frontmatter;
    let body;
    try {
      ({ frontmatter, body } = parseFrontmatterAndBody(content));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`kdoc: Skipping ${path} due to invalid YAML frontmatter: ${message}`);
      continue;
    }
    docs.push({
      path,
      absolutePath,
      type: inferType(path, frontmatter),
      frontmatter,
      headings: parseHeadings(body),
      wordCount: countWords2(body),
      tags: extractTags(frontmatter, body),
      wikilinks: extractWikilinks(content),
      content,
      body
    });
  }
  return docs;
}
function writeKnowledgeJsonl(projectDir, docs, knowledgeRoot = "Knowledge") {
  const compiledDir = join21(projectDir, knowledgeRoot, ".compiled");
  ensureDir(compiledDir);
  const outputPath = join21(compiledDir, "knowledge.jsonl");
  const lines = docs.map(
    (doc) => JSON.stringify({
      path: doc.path,
      type: doc.type,
      frontmatter: doc.frontmatter,
      headings: doc.headings,
      wordCount: doc.wordCount,
      tags: doc.tags,
      wikilinks: doc.wikilinks
    })
  );
  safeWriteFile(outputPath, lines.join("\n") + (lines.length > 0 ? "\n" : ""));
  return outputPath;
}

// src/compiler/resolver.ts
function normalizeReference(raw) {
  return raw.trim().replace(/^\[\[|\]\]$/g, "").split("|")[0].split("#")[0].replace(/^Knowledge\//, "").replace(/^\.?\//, "").replace(/\.md$/i, "").trim().toLowerCase();
}
function looksLikeReference(value) {
  const trimmed = value.trim();
  return trimmed.includes("/") || /^ADR-\d+/i.test(trimmed) || /^phase-[\w.-]+$/i.test(trimmed) || /^\d+(?:\.\d+)*$/.test(trimmed);
}
function collectFrontmatterReferences(frontmatter) {
  const refs = /* @__PURE__ */ new Set();
  const visit = (value) => {
    if (typeof value === "string") {
      if (looksLikeReference(value)) refs.add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
    }
  };
  for (const [key, value] of Object.entries(frontmatter)) {
    if (/(^|_)(tldr|design|adr|blocked|depends|related|supersed|phase|parallel|guide|runbook|context|used)(_|\b)/i.test(key)) {
      visit(value);
    }
  }
  return [...refs];
}
function docIndexKeys(doc) {
  const keys = /* @__PURE__ */ new Set();
  keys.add(normalizeReference(doc.path));
  keys.add(normalizeReference(doc.path.replace(/\.md$/i, "")));
  const basename8 = doc.path.split("/").pop() ?? doc.path;
  keys.add(normalizeReference(basename8));
  keys.add(normalizeReference(basename8.replace(/\.md$/i, "")));
  if (typeof doc.frontmatter.id === "string") keys.add(normalizeReference(doc.frontmatter.id));
  if (typeof doc.frontmatter.title === "string") keys.add(normalizeReference(doc.frontmatter.title));
  for (const alias of Array.isArray(doc.frontmatter.aliases) ? doc.frontmatter.aliases : []) {
    if (typeof alias === "string") keys.add(normalizeReference(alias));
  }
  return [...keys].filter(Boolean);
}
function buildResolverIndex(docs) {
  const index = /* @__PURE__ */ new Map();
  for (const doc of docs) {
    for (const key of docIndexKeys(doc)) {
      if (!index.has(key)) index.set(key, doc);
    }
  }
  return index;
}
function resolveReference(reference, docsOrIndex) {
  const index = docsOrIndex instanceof Map ? docsOrIndex : buildResolverIndex(docsOrIndex);
  return index.get(normalizeReference(reference)) ?? null;
}
function resolveDocumentTree(seed, docs, depth = 2) {
  const index = buildResolverIndex(docs);
  const visited = /* @__PURE__ */ new Set();
  const walk = (doc, remainingDepth) => {
    visited.add(doc.path);
    const references = [.../* @__PURE__ */ new Set([...doc.wikilinks, ...collectFrontmatterReferences(doc.frontmatter)])];
    const children = [];
    const missing = [];
    if (remainingDepth > 0) {
      for (const reference of references) {
        const resolved = resolveReference(reference, index);
        if (!resolved) {
          missing.push(reference);
          continue;
        }
        if (visited.has(resolved.path)) continue;
        children.push(walk(resolved, remainingDepth - 1));
      }
    } else {
      for (const reference of references) {
        if (!resolveReference(reference, index)) missing.push(reference);
      }
    }
    return { doc, references, children, missing };
  };
  return walk(seed, depth);
}
function collectResolvedDocs(root) {
  const docs = /* @__PURE__ */ new Map();
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    docs.set(node.doc.path, node.doc);
    for (const child of node.children) stack.push(child);
  }
  return [...docs.values()];
}

// src/compiler/extractor.ts
var KEYWORDS = ["MUST NOT", "SHOULD NOT", "MUST", "SHALL", "SHOULD"];
function normalizeConstraintLine(line) {
  return line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").trim();
}
function extractConstraints(docs) {
  const constraints = [];
  for (const doc of docs) {
    if (doc.type !== "adr") continue;
    const lines = doc.body.split("\n");
    for (const line of lines) {
      const normalized = normalizeConstraintLine(line);
      if (!normalized) continue;
      const keyword = KEYWORDS.find(
        (item) => new RegExp(`\\b${item.replace(/\s+/g, "\\s+")}\\b`, "i").test(normalized)
      );
      if (!keyword) continue;
      constraints.push({
        source: doc.path,
        keyword,
        ruleText: normalized
      });
    }
  }
  return constraints;
}

// src/compiler/filter.ts
function isMemoryEntry(doc) {
  return doc.type === "memory" || doc.path.startsWith("AgentMemory/");
}
function filterMemoryEntries(target, docs) {
  const memoryDocs = docs.filter(isMemoryEntry);
  if (target.tags.length === 0) return memoryDocs;
  const targetTags = new Set(target.tags.map((tag) => tag.toLowerCase()));
  return memoryDocs.filter(
    (doc) => doc.tags.some((tag) => targetTags.has(tag.toLowerCase()))
  );
}

// src/compiler/coverage.ts
function hasContent(value) {
  if (typeof value === "string") return value.trim().length > 0;
  return value.length > 0;
}
function scoreCoverage(sections, missingDocs = []) {
  const checks = [
    ["Mission", hasContent(sections.mission)],
    ["Why", hasContent(sections.why)],
    ["What Already Exists", hasContent(sections.whatAlreadyExists)],
    ["Constraints", hasContent(sections.constraints)],
    ["Design Spec", hasContent(sections.designSpec)],
    ["Gotchas", hasContent(sections.gotchas)],
    ["Acceptance Criteria", hasContent(sections.acceptanceCriteria)],
    ["Test Contract", hasContent(sections.testContract)],
    ["Parallel Work", hasContent(sections.parallelWork)],
    ["What Comes After", hasContent(sections.whatComesAfter)]
  ];
  const total = checks.length;
  const present = checks.filter(([, ok]) => ok).length;
  const score = Math.round(present / total * 100);
  const missingSections = checks.filter(([, ok]) => !ok).map(([name]) => name);
  return {
    score,
    missingDocs: [...new Set(missingDocs)].sort(),
    missingSections
  };
}

// src/compiler/assembler.ts
function stripPlaceholders(text) {
  return text.replace(/<!--[\s\S]*?-->/g, "").replace(/^>\s*.*$/gm, "").replace(/<[^>]+>/g, "").replace(/^\s*[-*]\s*$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}
function sectionBody(doc, headings) {
  const escaped = headings.map((heading) => heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(
    `^##\\s+(?:${escaped.join("|")})\\s*$([\\s\\S]*?)(?=^##\\s+|\\Z)`,
    "im"
  );
  const match = doc.body.match(pattern);
  return stripPlaceholders(match?.[1] ?? "");
}
function firstFrontmatterString(doc, key) {
  const value = doc.frontmatter[key];
  return typeof value === "string" ? value.trim() : "";
}
function frontmatterStringArray(doc, key) {
  const value = doc.frontmatter[key];
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}
function flattenMissing(root) {
  const missing = /* @__PURE__ */ new Set();
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    for (const item of node.missing) missing.add(item);
    for (const child of node.children) stack.push(child);
  }
  return [...missing];
}
function formatConstraint(constraint) {
  return `- ${constraint.ruleText} (${constraint.source})`;
}
function assembleBrief(seed, resolvedRoot, allDocs) {
  const resolvedDocs = collectResolvedDocs(resolvedRoot);
  const constraints = extractConstraints(resolvedDocs);
  const gotchaDocs = filterMemoryEntries(seed, allDocs);
  const predecessors = resolvedDocs.filter(
    (doc) => doc.path !== seed.path && doc.type === "sub-phase" && ["completed", "completed_with_notes"].includes(firstFrontmatterString(doc, "status"))
  );
  const designDoc = resolvedDocs.find((doc) => doc.path === firstFrontmatterString(seed, "design_spec")) ?? resolvedDocs.find((doc) => doc.type === "design-spec" || doc.path.startsWith("Design/"));
  const successors = allDocs.filter((doc) => {
    if (doc.path === seed.path) return false;
    const blockedBy = frontmatterStringArray(doc, "blocked_by");
    const dependsOn = frontmatterStringArray(doc, "depends_on");
    const seedId = firstFrontmatterString(seed, "id") || seed.path.replace(/\.md$/i, "");
    return blockedBy.includes(seedId) || dependsOn.includes(seedId);
  });
  const sections = {
    mission: firstFrontmatterString(seed, "summary") || firstFrontmatterString(seed, "title") || seed.path,
    why: sectionBody(seed, ["Why", "Rationale"]) || firstFrontmatterString(seed, "intent"),
    whatAlreadyExists: predecessors.map((doc) => {
      const summary = firstFrontmatterString(doc, "summary") || firstFrontmatterString(doc, "title") || doc.path;
      const modulePath = firstFrontmatterString(doc, "module_path");
      return modulePath ? `${summary} (${modulePath})` : summary;
    }),
    constraints,
    designSpec: designDoc ? designDoc.body.trim() : "",
    gotchas: gotchaDocs.map((doc) => {
      const title = firstFrontmatterString(doc, "title") || doc.path;
      const summary = sectionBody(doc, ["Why", "Gotchas", "Notes"]) || doc.body.trim().split("\n").slice(0, 3).join(" ").trim();
      return `${title}: ${summary}`.trim();
    }),
    acceptanceCriteria: frontmatterStringArray(seed, "acceptance_criteria"),
    testContract: sectionBody(seed, ["Test Contract", "Test Scenarios", "Verification"]) || frontmatterStringArray(seed, "test_contract").join("\n"),
    parallelWork: frontmatterStringArray(seed, "parallel_with"),
    whatComesAfter: successors.map(
      (doc) => firstFrontmatterString(doc, "summary") || firstFrontmatterString(doc, "title") || doc.path
    )
  };
  const coverage = scoreCoverage(sections, flattenMissing(resolvedRoot));
  const markdown = renderBriefMarkdown(seed, sections, coverage);
  return { markdown, coverage, seed };
}
function renderBriefMarkdown(seed, sections, coverage) {
  const title = firstFrontmatterString(seed, "title") || seed.path;
  const modulePath = firstFrontmatterString(seed, "module_path");
  const affectedRoutes = frontmatterStringArray(seed, "affected_routes");
  const lines = [
    `# Implementation Brief: ${title}`,
    "",
    `> Generated by \`kdoc brief\` on ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`,
    `> Coverage: ${coverage.score}%${coverage.missingDocs.length > 0 ? ` (missing docs: ${coverage.missingDocs.join(", ")})` : ""}`,
    "",
    "## Mission",
    sections.mission || "-",
    "",
    "## Why",
    sections.why || "-",
    "",
    "## Module Path",
    modulePath || "-",
    "",
    "## Affected Routes",
    affectedRoutes.length > 0 ? affectedRoutes.map((route) => `- ${route}`).join("\n") : "-",
    "",
    "## What Already Exists",
    sections.whatAlreadyExists.length > 0 ? sections.whatAlreadyExists.map((item) => `- ${item}`).join("\n") : "-",
    "",
    "## Constraints",
    sections.constraints.length > 0 ? sections.constraints.map(formatConstraint).join("\n") : "-",
    "",
    "## Design Spec",
    sections.designSpec || "-",
    "",
    "## Gotchas",
    sections.gotchas.length > 0 ? sections.gotchas.map((item) => `- ${item}`).join("\n") : "-",
    "",
    "## Acceptance Criteria",
    sections.acceptanceCriteria.length > 0 ? sections.acceptanceCriteria.map((item) => `- ${item}`).join("\n") : "-",
    "",
    "## Test Contract",
    sections.testContract || "-",
    "",
    "## Parallel Work",
    sections.parallelWork.length > 0 ? sections.parallelWork.map((item) => `- ${item}`).join("\n") : "-",
    "",
    "## What Comes After",
    sections.whatComesAfter.length > 0 ? sections.whatComesAfter.map((item) => `- ${item}`).join("\n") : "-"
  ];
  return lines.join("\n").trimEnd() + "\n";
}

// src/roadmap/graph.ts
function buildDependencyGraph(phases) {
  const nodes = /* @__PURE__ */ new Map();
  const edges = /* @__PURE__ */ new Map();
  const reverseEdges = /* @__PURE__ */ new Map();
  for (const phase of phases) {
    nodes.set(phase.id, phase);
    edges.set(phase.id, []);
    reverseEdges.set(phase.id, []);
    for (const sub of phase.subPhases) {
      nodes.set(sub.id, sub);
      edges.set(sub.id, []);
      reverseEdges.set(sub.id, []);
    }
  }
  for (const phase of phases) {
    for (const dep of phase.dependsOn) {
      if (nodes.has(dep)) {
        edges.get(phase.id).push(dep);
        reverseEdges.get(dep).push(phase.id);
      }
    }
  }
  for (const phase of phases) {
    for (const sub of phase.subPhases) {
      for (const blocker of sub.blockedBy) {
        const normalized = normalizeBlocker(blocker, nodes);
        if (normalized && nodes.has(normalized)) {
          edges.get(sub.id).push(normalized);
          reverseEdges.get(normalized).push(sub.id);
        }
      }
    }
  }
  const order = topologicalSort(nodes, edges);
  return { nodes, edges, reverseEdges, order };
}
function normalizeBlocker(blocker, nodes) {
  if (nodes.has(blocker)) return blocker;
  const phaseMatch = blocker.match(/^Phase\s+(.+)$/i);
  if (phaseMatch) {
    const normalized = `phase-${phaseMatch[1].toLowerCase()}`;
    if (nodes.has(normalized)) return normalized;
  }
  const trimmed = blocker.trim();
  if (nodes.has(trimmed)) return trimmed;
  return null;
}
function topologicalSort(nodes, edges) {
  const inDegree = /* @__PURE__ */ new Map();
  for (const [nodeId, deps] of edges) {
    inDegree.set(nodeId, deps.filter((d) => nodes.has(d)).length);
  }
  for (const id of nodes.keys()) {
    if (!inDegree.has(id)) inDegree.set(id, 0);
  }
  const queue = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }
  const order = [];
  const visited = /* @__PURE__ */ new Set();
  while (queue.length > 0) {
    queue.sort();
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    order.push(current);
    for (const [nodeId, deps] of edges) {
      if (visited.has(nodeId)) continue;
      if (deps.includes(current)) {
        const newDegree = (inDegree.get(nodeId) ?? 0) - 1;
        inDegree.set(nodeId, newDegree);
        if (newDegree <= 0 && !visited.has(nodeId)) {
          queue.push(nodeId);
        }
      }
    }
  }
  if (order.length < nodes.size) {
    const unvisited = [...nodes.keys()].filter((id) => !visited.has(id));
    throw new Error(`Cycle detected in dependency graph. Involved nodes: ${unvisited.join(", ")}`);
  }
  return order;
}
function getExecutionWaves(graph) {
  const waves = [];
  const assigned = /* @__PURE__ */ new Set();
  const { nodes, edges } = graph;
  let waveNum = 1;
  while (assigned.size < nodes.size) {
    const currentWave = [];
    for (const id of nodes.keys()) {
      if (assigned.has(id)) continue;
      const deps = edges.get(id) ?? [];
      const allDepsResolved = deps.every((d) => !nodes.has(d) || assigned.has(d));
      if (allDepsResolved) {
        currentWave.push(id);
      }
    }
    if (currentWave.length === 0) break;
    currentWave.sort();
    waves.push({ number: waveNum, items: currentWave });
    for (const id of currentWave) assigned.add(id);
    waveNum++;
  }
  return waves;
}
function getCriticalPath(graph) {
  const { nodes, edges, order } = graph;
  const dist = /* @__PURE__ */ new Map();
  const prev = /* @__PURE__ */ new Map();
  for (const id of nodes.keys()) {
    dist.set(id, 0);
    prev.set(id, null);
  }
  for (const id of order) {
    const currentDist = dist.get(id) ?? 0;
    for (const [nodeId, deps] of edges) {
      if (deps.includes(id)) {
        const newDist = currentDist + 1;
        if (newDist > (dist.get(nodeId) ?? 0)) {
          dist.set(nodeId, newDist);
          prev.set(nodeId, id);
        }
      }
    }
  }
  let maxDist = 0;
  let endNode = "";
  for (const [id, d] of dist) {
    if (d >= maxDist) {
      maxDist = d;
      endNode = id;
    }
  }
  if (!endNode) return [];
  const path = [];
  let current = endNode;
  while (current) {
    path.unshift(current);
    current = prev.get(current) ?? null;
  }
  return path;
}

// src/roadmap/next.ts
function getNextUnblocked(phases, graph) {
  const results = [];
  for (const phase of phases) {
    if (phase.status === "completed" || phase.status === "completed_with_notes") continue;
    for (const sub of phase.subPhases) {
      if (sub.status === "completed") continue;
      const deps = graph.edges.get(sub.id) ?? [];
      const isBlocked = deps.some((d) => {
        const node = graph.nodes.get(d);
        if (!node) return false;
        return node.status !== "completed" && node.status !== "completed_with_notes";
      });
      if (!isBlocked) {
        results.push({
          subPhase: sub,
          phase,
          blockedBy: sub.blockedBy,
          parallelWith: sub.parallelWith,
          isBlocked: false
        });
      }
    }
  }
  return results;
}
function formatNextAsMarkdown(result) {
  const { subPhase: sub, phase } = result;
  const lines = [];
  lines.push(`## Next: ${sub.id} \u2014 ${sub.name}`);
  lines.push("");
  lines.push(`**Phase**: ${phase.id} \u2014 ${phase.name}`);
  lines.push(`**Status**: ${sub.status} (unblocked)`);
  if (sub.size) lines.push(`**Size**: ${sub.size}`);
  if (sub.securityTier && sub.securityTier !== "standard") {
    lines.push(`**Security Tier**: ${sub.securityTier}`);
  }
  if (sub.app) lines.push(`**App**: ${sub.app}`);
  if (sub.intent) {
    lines.push("");
    lines.push("### Why");
    lines.push(`> ${sub.intent}`);
  }
  lines.push("");
  lines.push("### Context");
  if (sub.tldr) lines.push(`- **TLDR**: [[${sub.tldr}]]`);
  if (sub.designSpec) lines.push(`- **Design Spec**: [[${sub.designSpec}]]`);
  if (sub.acceptanceCriteria.length > 0) {
    lines.push("");
    lines.push("### Acceptance Criteria");
    for (const ac of sub.acceptanceCriteria) {
      lines.push(`- [ ] ${ac}`);
    }
  }
  if (sub.modulePath) {
    lines.push("");
    lines.push("### Module Path");
    lines.push(`\`${sub.modulePath}\``);
  }
  if (sub.affectedRoutes.length > 0) {
    lines.push("");
    lines.push("### Affected Routes");
    for (const route of sub.affectedRoutes) {
      lines.push(`- \`${route}\``);
    }
  }
  lines.push("");
  lines.push("### Blocked By");
  if (sub.blockedBy.length > 0) {
    lines.push(`All prerequisites completed: ${sub.blockedBy.map((b) => `[[${b}]]`).join(", ")}`);
  } else {
    lines.push("Nothing \u2014 ready to start.");
  }
  if (sub.parallelWith.length > 0) {
    lines.push("");
    lines.push("### Parallel With");
    lines.push(sub.parallelWith.map((p) => `[[${p}]]`).join(", "));
  }
  lines.push("");
  return lines.join("\n");
}
function formatNextAsJson(results) {
  return JSON.stringify(results.map((r) => ({
    id: r.subPhase.id,
    name: r.subPhase.name,
    phase: r.phase.id,
    phaseName: r.phase.name,
    status: r.subPhase.status,
    size: r.subPhase.size,
    securityTier: r.subPhase.securityTier,
    intent: r.subPhase.intent,
    tldr: r.subPhase.tldr,
    designSpec: r.subPhase.designSpec,
    modulePath: r.subPhase.modulePath,
    affectedRoutes: r.subPhase.affectedRoutes,
    acceptanceCriteria: r.subPhase.acceptanceCriteria,
    blockedBy: r.subPhase.blockedBy,
    parallelWith: r.subPhase.parallelWith
  })), null, 2);
}

// src/roadmap/parser.ts
import { readFileSync as readFileSync19, existsSync as existsSync18, readdirSync as readdirSync10 } from "fs";
import { join as join22, basename as basename6 } from "path";
function parseFrontmatter2(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  const lines = match[1].split("\n");
  let currentKey = "";
  let inArray = false;
  const arrayValues = [];
  for (const line of lines) {
    if (inArray && /^\s+-\s+/.test(line)) {
      arrayValues.push(line.replace(/^\s+-\s+/, "").replace(/^['"]|['"]$/g, "").trim());
      continue;
    }
    if (inArray) {
      fm[currentKey] = arrayValues.slice();
      inArray = false;
    }
    const kvMatch = line.match(/^(\w[\w_-]*)\s*:\s*(.*)/);
    if (!kvMatch) continue;
    const [, key, rawVal] = kvMatch;
    const val = rawVal.trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      const inner = val.slice(1, -1).trim();
      if (!inner) {
        fm[key] = [];
      } else {
        fm[key] = inner.split(",").map((s) => s.replace(/^['"\s]+|['"\s]+$/g, ""));
      }
      continue;
    }
    if (val === "" || val === "[]") {
      fm[key] = val === "[]" ? [] : "";
      currentKey = key;
      inArray = false;
      currentKey = key;
      continue;
    }
    if (val === "") {
      currentKey = key;
      inArray = true;
      arrayValues.length = 0;
      continue;
    }
    fm[key] = val.replace(/^['"]|['"]$/g, "");
  }
  if (inArray) {
    fm[currentKey] = arrayValues.slice();
  }
  return fm;
}
function toStringArray(val) {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string" && val) return [val];
  return [];
}
function toString(val) {
  if (typeof val === "string") return val;
  return "";
}
function toNumber(val, fallback) {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = parseInt(val, 10);
    return isNaN(n) ? fallback : n;
  }
  return fallback;
}
function toStatus(val, valid, fallback) {
  const s = toString(val);
  return valid.includes(s) ? s : fallback;
}
var PHASE_STATUSES = ["pending", "in_progress", "completed", "completed_with_notes", "blocked"];
var SUBPHASE_STATUSES = ["pending", "in_progress", "completed", "blocked"];
function parsePhaseFile(filePath) {
  if (!existsSync18(filePath)) return null;
  const content = readFileSync19(filePath, "utf8");
  const fm = parseFrontmatter2(content);
  if (fm["type"] !== "phase") return null;
  return {
    id: toString(fm["id"]) || basename6(filePath, ".md"),
    name: toString(fm["summary"]) || toString(fm["title"]) || basename6(filePath, ".md"),
    status: toStatus(fm["status"], PHASE_STATUSES, "pending"),
    dependsOn: toStringArray(fm["depends_on"]),
    intent: toString(fm["intent"]),
    path: filePath,
    summary: toString(fm["summary"]),
    workUnitsTotal: toNumber(fm["work_units_total"], 0),
    lastReviewed: toString(fm["last_reviewed"]) || void 0
  };
}
function parseSubPhaseFile(filePath) {
  if (!existsSync18(filePath)) return null;
  const content = readFileSync19(filePath, "utf8");
  const fm = parseFrontmatter2(content);
  if (fm["type"] !== "sub-phase") return null;
  return {
    id: toString(fm["id"]) || basename6(filePath, ".md"),
    parentPhase: toString(fm["parent_phase"]),
    name: toString(fm["summary"]) || toString(fm["title"]) || basename6(filePath, ".md"),
    status: toStatus(fm["status"], SUBPHASE_STATUSES, "pending"),
    blockedBy: toStringArray(fm["blocked_by"]),
    parallelWith: toStringArray(fm["parallel_with"]),
    tldr: toString(fm["tldr"]),
    designSpec: toString(fm["design_spec"]),
    size: toString(fm["size"]),
    securityTier: toString(fm["security_tier"]) || "standard",
    intent: toString(fm["intent"]),
    acceptanceCriteria: toStringArray(fm["acceptance_criteria"]),
    modulePath: toString(fm["module_path"]),
    affectedRoutes: toStringArray(fm["affected_routes"]),
    path: filePath,
    summary: toString(fm["summary"]),
    app: toString(fm["app"]) || void 0
  };
}
function parseRoadmap(roadmapDir) {
  const phasesDir = join22(roadmapDir, "phases");
  if (!existsSync18(phasesDir)) return [];
  const entries = readdirSync10(phasesDir, { withFileTypes: true });
  const phases = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    if (!entry.name.startsWith("phase-")) continue;
    const filePath = join22(phasesDir, entry.name);
    const parsed = parsePhaseFile(filePath);
    if (!parsed) continue;
    const phaseId = parsed.id;
    const phaseNum = phaseId.replace("phase-", "");
    const subPhaseDir = join22(phasesDir, `phase-${phaseNum}`);
    const subPhases = [];
    if (existsSync18(subPhaseDir)) {
      const subEntries = readdirSync10(subPhaseDir, { withFileTypes: true });
      for (const subEntry of subEntries) {
        if (!subEntry.isFile() || !subEntry.name.endsWith(".md")) continue;
        const subPath = join22(subPhaseDir, subEntry.name);
        const subParsed = parseSubPhaseFile(subPath);
        if (subParsed) subPhases.push(subParsed);
      }
    }
    subPhases.sort((a, b) => {
      const aParts = a.id.split(".").map(Number);
      const bParts = b.id.split(".").map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
        if (diff !== 0) return diff;
      }
      return 0;
    });
    phases.push({ ...parsed, subPhases });
  }
  phases.sort((a, b) => {
    const aNum = parseFloat(a.id.replace("phase-", "").replace(/[a-z]/g, ".5"));
    const bNum = parseFloat(b.id.replace("phase-", "").replace(/[a-z]/g, ".5"));
    return aNum - bNum;
  });
  return phases;
}

// src/roadmap/status.ts
function resolveRoadmapStatus(roadmapDir) {
  const phases = parseRoadmap(roadmapDir);
  if (phases.length === 0) {
    return {
      phases,
      currentPhase: null,
      next: null
    };
  }
  const graph = buildDependencyGraph(phases);
  return {
    phases,
    currentPhase: phases.find((phase) => !["completed", "completed_with_notes"].includes(phase.status)) ?? null,
    next: getNextUnblocked(phases, graph)[0] ?? null
  };
}

// src/commands/brief.ts
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
    const roadmapStatus = resolveRoadmapStatus(join23(projectDir, knowledgeRoot, "Roadmap"));
    if (roadmapStatus.next) return resolveReference(roadmapStatus.next.subPhase.id, docs);
  }
  return null;
}
function writeClipboard(content) {
  execFileSync2("pbcopy", { input: content });
}
function registerBriefCommand(program) {
  const cmd = new Command7("brief");
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

// src/commands/generate.ts
import { Command as Command8 } from "commander";
import { existsSync as existsSync19, readFileSync as readFileSync20 } from "fs";
import { basename as basename7, join as join24 } from "path";
var GENERATED_START = "<!-- kdoc:generated:start -->";
var GENERATED_END = "<!-- kdoc:generated:end -->";
function getProjectDir4() {
  return process.env.KDOC_PROJECT_DIR ?? process.cwd();
}
function replaceGeneratedBlock(content, generatedBody) {
  const pattern = new RegExp(
    `${GENERATED_START}[\\s\\S]*?${GENERATED_END}`,
    "m"
  );
  const replacement = `${GENERATED_START}
${generatedBody.trim()}
${GENERATED_END}`;
  return pattern.test(content) ? content.replace(pattern, replacement) : `${content.trimEnd()}

${replacement}
`;
}
function extractFrontmatter(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n?/);
  return match ? match[0] : null;
}
function preserveExistingFrontmatter(existingContent, renderedContent) {
  const existingFrontmatter = extractFrontmatter(existingContent);
  const renderedFrontmatter = extractFrontmatter(renderedContent);
  if (!renderedFrontmatter) {
    return existingFrontmatter ? existingFrontmatter + renderedContent : renderedContent;
  }
  if (!existingFrontmatter) {
    return renderedContent;
  }
  return existingFrontmatter + renderedContent.slice(renderedFrontmatter.length);
}
function loadRenderedTemplate(templateName, values) {
  const resolved = resolveTemplateSource(templateName);
  if (!resolved) {
    throw new Error(`Template not found: ${templateName}`);
  }
  return renderTemplate(resolved.content, values).content;
}
function renderContextPackSections(projectDir, knowledgeRoot, docs) {
  const areas = /* @__PURE__ */ new Map();
  for (const doc of docs) {
    const area = doc.path.split("/")[0] ?? "Knowledge";
    const current = areas.get(area) ?? [];
    current.push(doc.path);
    areas.set(area, current);
  }
  const adrDocs = docs.filter((doc) => doc.type === "adr" && !doc.path.endsWith("README.md")).sort((a, b) => String(b.frontmatter.date ?? "").localeCompare(String(a.frontmatter.date ?? ""))).slice(0, 5);
  const tldrDocs = docs.filter((doc) => {
    if (doc.path.endsWith("README.md")) return false;
    if (doc.type === "tldr") return true;
    if (String(doc.frontmatter.area ?? "") === "tldr") return true;
    if (doc.path.startsWith("TLDR/") || doc.path.includes("/TLDR/")) return true;
    return false;
  }).slice(0, 5);
  const roadmapStatus = resolveRoadmapStatus(join24(projectDir, knowledgeRoot, "Roadmap"));
  const currentPhase = roadmapStatus.currentPhase;
  const nextSubPhase = roadmapStatus.next?.subPhase ?? null;
  const knowledgeMapRows = [...areas.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([area, files]) => `| ${area} | ${files.length} | ${files.slice(0, 3).map((file) => `\`${file}\``).join(", ")} |`);
  const recentDecisionsRows = adrDocs.map((doc) => {
    const title = String(doc.frontmatter.title ?? doc.path);
    const status = String(doc.frontmatter.status ?? "draft");
    const why = String(doc.frontmatter.summary ?? "").trim().replace(/\|/g, "\\|");
    return `| ${title} | ${status} | ${why || "-"} |`;
  });
  const activeFeaturesRows = tldrDocs.map((doc) => {
    const title = String(doc.frontmatter.title ?? doc.path);
    const status = String(doc.frontmatter.status ?? "draft");
    const scope = String(doc.frontmatter.scope ?? "root");
    return `| ${title} | ${status} | ${scope} |`;
  });
  return [
    "## Knowledge Map",
    "",
    "| Area | Files | Key Documents |",
    "| ---- | ----- | ------------- |",
    ...knowledgeMapRows.length > 0 ? knowledgeMapRows : ["| (none) | 0 | |"],
    "",
    "## Recent Decisions",
    "",
    "| ADR | Status | Why It Matters |",
    "| --- | ------ | -------------- |",
    ...recentDecisionsRows.length > 0 ? recentDecisionsRows : ["| (none) | - | - |"],
    "",
    "## Active Features",
    "",
    "| TLDR | Status | Scope |",
    "| ---- | ------ | ----- |",
    ...activeFeaturesRows.length > 0 ? activeFeaturesRows : ["| (none) | - | - |"],
    "",
    "## Roadmap Status",
    "",
    "| Current Phase | Next Unblocked | Blocking Decision |",
    "| ------------- | -------------- | ----------------- |",
    `| ${currentPhase?.name ?? "-"} | ${nextSubPhase?.name ?? "-"} | - |`
  ].join("\n");
}
function renderLlmsTxt(projectDir, docs) {
  const projectName = basename7(projectDir);
  const grouped = /* @__PURE__ */ new Map();
  for (const doc of docs) {
    const area = doc.path.split("/")[0] ?? "Knowledge";
    const current = grouped.get(area) ?? [];
    current.push(doc.path);
    grouped.set(area, current);
  }
  const sections = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([area, files]) => [
    `## ${area}`,
    ...files.sort().map((file) => `- ${file}`),
    ""
  ]);
  return [
    `# ${projectName}`,
    "",
    "> Generated project knowledge index for LLM consumption.",
    "",
    ...sections
  ].join("\n").trimEnd() + "\n";
}
function renderIndexSections(docs) {
  const grouped = /* @__PURE__ */ new Map();
  for (const doc of docs) {
    if (doc.path === "INDEX.md" || doc.path === "ContextPack.md" || doc.path === "llms.txt") continue;
    const area = doc.path.split("/")[0] ?? "Knowledge";
    const current = grouped.get(area) ?? [];
    current.push(doc);
    grouped.set(area, current);
  }
  return [
    `**Total documents:** ${docs.length}`,
    "",
    ...[...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([area, areaDocs]) => {
      const lines = [`### ${area}`, ""];
      for (const doc of areaDocs.sort((a, b) => a.path.localeCompare(b.path))) {
        const title = String(doc.frontmatter.title ?? doc.path.split("/").pop()?.replace(/\.md$/, "") ?? doc.path);
        const wikilink = doc.path.replace(/\.md$/, "");
        lines.push(`- [[${wikilink}|${title}]]`);
      }
      lines.push("");
      return lines;
    })
  ].join("\n").trimEnd();
}
function resolveScopeOptions(projectDir, config, packageName) {
  if (packageName) {
    const packageConfig = config.packages?.[packageName];
    if (!packageConfig) {
      throw new Error(
        `Unknown package "${packageName}". Valid packages: ${Object.keys(config.packages ?? {}).join(", ")}`
      );
    }
    return {
      knowledgeRoot: join24(config.root ?? "Knowledge", "packages", packageName),
      outputPath: join24(projectDir, config.root ?? "Knowledge", "packages", packageName, "ContextPack.md"),
      scopeValue: packageName,
      projectName: packageName
    };
  }
  return {
    knowledgeRoot: config.root ?? "Knowledge",
    outputPath: join24(projectDir, config.root ?? "Knowledge", "ContextPack.md"),
    scopeValue: "root",
    projectName: basename7(projectDir)
  };
}
function generateFromTemplate(options) {
  const renderedTemplate = loadRenderedTemplate(options.templateName, options.values);
  const generatedTemplate = replaceGeneratedBlock(renderedTemplate, options.generatedBody);
  if (!existsSync19(options.outputPath)) {
    return generatedTemplate;
  }
  const existingContent = readFileSync20(options.outputPath, "utf8");
  if (existingContent.includes(GENERATED_START) && existingContent.includes(GENERATED_END)) {
    return replaceGeneratedBlock(existingContent, options.generatedBody);
  }
  return preserveExistingFrontmatter(existingContent, generatedTemplate);
}
function registerGenerateCommand(program) {
  const generate = new Command8("generate");
  generate.description("Generate derived Knowledge artifacts");
  generate.command("context-pack").description("Generate Knowledge/ContextPack.md").option("--package <name>", "Generate a package-scoped ContextPack in monorepos").action((options) => {
    const projectDir = getProjectDir4();
    const config = loadConfig(projectDir);
    if (!config) {
      console.error("Error: .kdoc.yaml not found. Run `kdoc init` first.");
      process.exitCode = 1;
      return;
    }
    try {
      const scope = resolveScopeOptions(projectDir, config, options.package);
      const docs = parseKnowledgeDocs(projectDir, scope.knowledgeRoot);
      writeKnowledgeJsonl(projectDir, docs, scope.knowledgeRoot);
      const content = generateFromTemplate({
        outputPath: scope.outputPath,
        templateName: "core/templates/context-pack.md",
        values: {
          PROJECT_NAME: scope.projectName || "project",
          KNOWLEDGE_ROOT: scope.knowledgeRoot,
          SCOPE: scope.scopeValue
        },
        generatedBody: renderContextPackSections(projectDir, scope.knowledgeRoot, docs)
      });
      safeWriteFile(scope.outputPath, content);
      console.log(`Generated: ${scope.outputPath}`);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  });
  generate.command("llms-txt").description("Generate Knowledge/llms.txt").action(() => {
    const projectDir = getProjectDir4();
    const config = loadConfig(projectDir);
    if (!config) {
      console.error("Error: .kdoc.yaml not found. Run `kdoc init` first.");
      process.exitCode = 1;
      return;
    }
    const knowledgeRoot = config.root ?? "Knowledge";
    const docs = parseKnowledgeDocs(projectDir, knowledgeRoot);
    writeKnowledgeJsonl(projectDir, docs, knowledgeRoot);
    const outputPath = join24(projectDir, knowledgeRoot, "llms.txt");
    safeWriteFile(outputPath, renderLlmsTxt(projectDir, docs));
    console.log(`Generated: ${outputPath}`);
  });
  generate.command("index").description("Generate Knowledge/INDEX.md with navigation links").action(() => {
    const projectDir = getProjectDir4();
    const config = loadConfig(projectDir);
    if (!config) {
      console.error("Error: .kdoc.yaml not found. Run `kdoc init` first.");
      process.exitCode = 1;
      return;
    }
    const knowledgeRoot = config.root ?? "Knowledge";
    const docs = parseKnowledgeDocs(projectDir, knowledgeRoot);
    const outputPath = join24(projectDir, knowledgeRoot, "INDEX.md");
    const content = generateFromTemplate({
      outputPath,
      templateName: "core/templates/index.md",
      values: {
        PROJECT_NAME: basename7(projectDir) || "project",
        KNOWLEDGE_ROOT: knowledgeRoot
      },
      generatedBody: renderIndexSections(docs)
    });
    safeWriteFile(outputPath, content);
    console.log(`Generated: ${outputPath}`);
  });
  program.addCommand(generate);
}

// src/commands/roadmap.ts
import { Command as Command9 } from "commander";
import { join as join25 } from "path";
import { existsSync as existsSync21 } from "fs";

// src/roadmap/dashboard.ts
import { readFileSync as readFileSync21, existsSync as existsSync20 } from "fs";
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
  if (existsSync20(readmePath)) {
    existing = readFileSync21(readmePath, "utf8");
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
function getProjectDir5() {
  return process.env.KDOC_PROJECT_DIR ?? process.cwd();
}
function registerRoadmapCommand(program) {
  const roadmap = new Command9("roadmap");
  roadmap.description("Roadmap dependency graph, dashboard, and next-step queries");
  roadmap.command("dashboard").description("Generate or update the roadmap progress dashboard").option("--yes", "Non-interactive mode").action(async () => {
    const projectDir = getProjectDir5();
    const config = loadConfig(projectDir);
    if (!config) {
      console.error("Error: .kdoc.yaml not found. Run `kdoc init` first.");
      process.exitCode = 2;
      return;
    }
    const roadmapDir = join25(projectDir, config.root, "Roadmap");
    if (!existsSync21(roadmapDir)) {
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
      const readmePath = join25(roadmapDir, "README.md");
      writeDashboard(readmePath, content);
      console.log(`Dashboard updated: ${config.root}/Roadmap/README.md`);
      console.log(`  ${phases.length} phase(s), ${phases.reduce((n, p) => n + p.subPhases.length, 0)} sub-phase(s)`);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    }
  });
  roadmap.command("next").description("Show the next unblocked sub-phase with full context").option("--json", "Output as JSON").option("--all", "Show all unblocked items, not just the first").option("--yes", "Non-interactive mode").action(async (opts) => {
    const projectDir = getProjectDir5();
    const config = loadConfig(projectDir);
    if (!config) {
      console.error("Error: .kdoc.yaml not found. Run `kdoc init` first.");
      process.exitCode = 2;
      return;
    }
    const roadmapDir = join25(projectDir, config.root, "Roadmap");
    if (!existsSync21(roadmapDir)) {
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
import { Command as Command10 } from "commander";
function registerMcpCommand(program) {
  const cmd = new Command10("mcp");
  cmd.description("Start the kdoc MCP server (stdio transport)").option("--project <dir>", "Project directory (defaults to cwd)").action(async () => {
    const { startServer, parseProjectDir } = await import("./server-LKREY57Y.js");
    const projectDir = parseProjectDir(process.argv, process.cwd());
    await startServer(projectDir);
  });
  program.addCommand(cmd);
}

// src/index.ts
var __dirname6 = dirname12(fileURLToPath9(import.meta.url));
function getVersion() {
  try {
    const pkgPath = join26(__dirname6, "..", "package.json");
    const pkg = JSON.parse(readFileSync22(pkgPath, "utf8"));
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}
function buildProgram() {
  const program = new Command11();
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
  registerRoadmapCommand(program);
  registerMcpCommand(program);
  return program;
}
var isMainModule = process.argv[1] && fileURLToPath9(import.meta.url) === process.argv[1];
if (isMainModule) {
  buildProgram().parse();
}
export {
  buildProgram
};
//# sourceMappingURL=index.js.map