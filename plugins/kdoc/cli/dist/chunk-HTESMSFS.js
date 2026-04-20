#!/usr/bin/env node

// src/config/loader.ts
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { parseDocument, stringify as stringifyYaml } from "yaml";

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

// src/config/loader.ts
var CONFIG_FILENAME = ".kdoc.yaml";
function configPath(projectDir) {
  return join(projectDir, CONFIG_FILENAME);
}
function configExists(projectDir) {
  return existsSync(configPath(projectDir));
}
function loadConfig(projectDir) {
  const path = configPath(projectDir);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
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
  writeFileSync(path, yaml, "utf8");
}

// src/commands/doctor.ts
import { Command } from "commander";
import { existsSync as existsSync5, readdirSync as readdirSync3 } from "fs";
import { dirname as dirname3, join as join7 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";

// src/config/lock.ts
import { readFileSync as readFileSync2, writeFileSync as writeFileSync2, existsSync as existsSync2, renameSync, unlinkSync } from "fs";
import { join as join2 } from "path";
var LOCK_FILENAME = ".kdoc.lock";
var LOCK_TMP_FILENAME = ".kdoc.lock.tmp";
function lockPath(projectDir) {
  return join2(projectDir, LOCK_FILENAME);
}
function lockTmpPath(projectDir) {
  return join2(projectDir, LOCK_TMP_FILENAME);
}
function hasPendingLockTmp(projectDir) {
  return existsSync2(lockTmpPath(projectDir));
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
  const path = existsSync2(mainPath) ? mainPath : tmpPath;
  if (!existsSync2(path)) return null;
  const raw = readFileSync2(path, "utf8");
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
  writeFileSync2(lockPath(projectDir), json, "utf8");
}
function appendFileEntry(projectDir, lock, filePath, entry) {
  lock.files[filePath] = entry;
  lock.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const json = JSON.stringify(lock, null, 2) + "\n";
  writeFileSync2(lockTmpPath(projectDir), json, "utf8");
}
function finalizeLock(projectDir) {
  const tmp = lockTmpPath(projectDir);
  if (!existsSync2(tmp)) return;
  renameSync(tmp, lockPath(projectDir));
}
function cleanupLockTmp(projectDir) {
  const tmp = lockTmpPath(projectDir);
  if (existsSync2(tmp)) unlinkSync(tmp);
}

// src/utils/fs.ts
import { existsSync as existsSync3, mkdirSync, readFileSync as readFileSync3, writeFileSync as writeFileSync3, readdirSync, rmSync } from "fs";
import { dirname, join as join3 } from "path";
function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}
function safeWriteFile(filePath, content) {
  ensureDir(dirname(filePath));
  writeFileSync3(filePath, content, "utf8");
}
function readFileSafe(filePath) {
  try {
    return readFileSync3(filePath, "utf8");
  } catch {
    return null;
  }
}
function deleteIfEmpty(dirPath) {
  if (!existsSync3(dirPath)) return false;
  return deleteIfEmptyRecursive(dirPath);
}
function deleteIfEmptyRecursive(dirPath) {
  const entries = readdirSync(dirPath, { withFileTypes: true });
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

// src/governance/scopes.ts
import { existsSync as existsSync4 } from "fs";
import { join as join4 } from "path";
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
      if (!existsSync4(scope.knowledgeRoot)) {
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
        const fullPath = join4(scope.knowledgeRoot, areaDir);
        if (!existsSync4(fullPath)) {
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
          const readmePath = join4(fullPath, "README.md");
          const readmeExists = existsSync4(readmePath);
          results.push({
            category: "structure",
            name: `[${scope.name}] ${areaDir}/README.md exists`,
            status: readmeExists ? "pass" : "warn",
            message: readmeExists ? `Package ${scope.name}: ${areaDir}/README.md found` : `Package ${scope.name}: ${areaDir}/README.md is missing`
          });
        }
        if (expectation.type === "seed-file-required" && expectation.file) {
          const seedPath = join4(fullPath, expectation.file);
          const seedExists = existsSync4(seedPath);
          results.push({
            category: "structure",
            name: `[${scope.name}] ${areaDir}/${expectation.file} exists`,
            status: seedExists ? "pass" : "warn",
            message: seedExists ? `Package ${scope.name}: ${expectation.file} found` : `Package ${scope.name}: ${expectation.file} is missing`
          });
        }
      }
    } else if (scope.type === "category") {
      if (!existsSync4(scope.knowledgeRoot)) {
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
        const readmePath = join4(scope.knowledgeRoot, "README.md");
        if (!existsSync4(readmePath)) {
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
  if (!existsSync4(scope.knowledgeRoot)) {
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
    const fullPath = join4(scope.knowledgeRoot, areaDir);
    if (!existsSync4(fullPath)) {
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
      const readmePath = join4(fullPath, "README.md");
      const readmeExists = existsSync4(readmePath);
      results.push({
        category: "structure",
        name: `[${packageName}] ${areaDir}/README.md exists`,
        status: readmeExists ? "pass" : "warn",
        message: readmeExists ? `Package ${packageName}: ${areaDir}/README.md found` : `Package ${packageName}: ${areaDir}/README.md is missing`
      });
    }
    if (expectation.type === "seed-file-required" && expectation.file) {
      const seedPath = join4(fullPath, expectation.file);
      const seedExists = existsSync4(seedPath);
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
import { readFileSync as readFileSync4 } from "fs";
import { join as join5 } from "path";
import fg from "fast-glob";
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
  const mdFiles = fg.sync("**/*.md", {
    cwd: knowledgeRoot,
    absolute: false,
    ignore: ["**/node_modules/**", "**/.obsidian/**", "**/.compiled/**", "**/packages/**"]
  });
  for (const relPath of mdFiles) {
    const absPath = join5(knowledgeRoot, relPath);
    let content;
    try {
      content = readFileSync4(absPath, "utf8");
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

// src/utils/version.ts
import { readFileSync as readFileSync5 } from "fs";
import { join as join6, dirname as dirname2 } from "path";
import { fileURLToPath } from "url";
var __dirname = dirname2(fileURLToPath(import.meta.url));
function getKdocVersion() {
  try {
    const pkgPath = join6(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync5(pkgPath, "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
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
  for (const entry of readdirSync3(dir, { withFileTypes: true })) {
    const fullPath = join7(dir, entry.name);
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
  const configFilePath = join7(projectDir, ".kdoc.yaml");
  if (!existsSync5(configFilePath)) {
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
  const lockFilePath = join7(projectDir, ".kdoc.lock");
  if (!existsSync5(lockFilePath)) {
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
  const kRoot = join7(projectDir, knowledgeRoot);
  for (const [areaName, areaConfig] of Object.entries(areas)) {
    if (!areaConfig.enabled) continue;
    const expectation = AREA_EXPECTATIONS[areaName];
    if (!expectation) continue;
    const areaDir = expectation.path ? join7(kRoot, expectation.path) : kRoot;
    const displayPath = expectation.path || knowledgeRoot;
    if (expectation.path && !existsSync5(areaDir)) {
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
        const readmePath = join7(areaDir, "README.md");
        const readmeExists = existsSync5(readmePath);
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
        const targetPath = expectation.path ? join7(areaDir, expectation.file) : join7(kRoot, expectation.file);
        const targetExists = existsSync5(targetPath);
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
  const projectScriptsDir = join7(projectDir, "scripts", config.scripts.prefix);
  const thisFile = fileURLToPath2(import.meta.url);
  const cliDir = [dirname3(thisFile), join7(dirname3(thisFile), ".."), join7(dirname3(thisFile), "..", "..")].find(
    (c) => existsSync5(join7(c, "package.json"))
  ) ?? dirname3(thisFile);
  const coreScriptsDir = join7(cliDir, "..", "core", "scripts");
  const expectedScripts = [
    "check_sync.py",
    "check_wikilinks.py",
    "build_index.py",
    "check_adr_governance.py",
    "governance_health.py"
  ];
  for (const script of expectedScripts) {
    const projectPath = join7(projectScriptsDir, script);
    const corePath = join7(coreScriptsDir, script);
    const foundInProject = existsSync5(projectPath);
    const foundInCore = existsSync5(corePath);
    if (foundInProject) {
      checks.push({
        category: "scripts",
        name: `script-${script}`,
        status: "pass",
        message: `Python compatibility shim present at scripts/${config.scripts.prefix}/${script}. Doctor now uses the JS governance engine as the canonical backend.`
      });
    } else if (foundInCore) {
      checks.push({
        category: "scripts",
        name: `script-${script}`,
        status: "pass",
        message: `Python compatibility shim available in kdoc package (${script}); doctor now uses the JS governance engine as the canonical backend.`
      });
    } else {
      continue;
    }
  }
  return checks;
}
async function runGovernanceEngineChecks(projectDir) {
  try {
    const currentDir = dirname3(fileURLToPath2(import.meta.url));
    const enginePath = [
      join7(currentDir, "..", "..", "..", "core", "governance-engine.mjs"),
      join7(currentDir, "..", "..", "core", "governance-engine.mjs"),
      join7(currentDir, "..", "core", "governance-engine.mjs")
    ].find((candidate) => existsSync5(candidate));
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
    const claudePath = join7(projectDir, "CLAUDE.md");
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
    const agentsPath = join7(projectDir, "AGENTS.md");
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
  const pkgPath = join7(projectDir, "package.json");
  if (existsSync5(pkgPath)) {
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
  const cmd = new Command("doctor");
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
          const kRoot = join7(cwd, config.root);
          for (const ext of extensionAreas) {
            const extDir = join7(kRoot, ext.directory);
            const extExists = existsSync5(extDir);
            allChecks.push({
              category: "structure",
              name: `extension:${ext.name} directory exists`,
              status: extExists ? "pass" : "warn",
              message: extExists ? `Extension area "${ext.name}" at ${ext.directory}/ is present` : `Extension area "${ext.name}" at ${ext.directory}/ not found`
            });
            if (extExists && ext.required_files) {
              for (const req of ext.required_files) {
                const reqPath = join7(extDir, req);
                const reqExists = existsSync5(reqPath);
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
            if (existsSync5(scope.knowledgeRoot)) {
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

// src/commands/generate.ts
import { Command as Command2 } from "commander";
import { basename as basename3, join as join12 } from "path";

// src/compiler/parser.ts
import { existsSync as existsSync6, readdirSync as readdirSync4, readFileSync as readFileSync6 } from "fs";
import { join as join8, relative } from "path";
import { parseDocument as parseDocument2 } from "yaml";
function walkMarkdownFiles(rootDir) {
  if (!existsSync6(rootDir)) return [];
  const files = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = readdirSync4(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".compiled") continue;
      const absolutePath = join8(current, entry.name);
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
  const knowledgeDir = join8(projectDir, knowledgeRoot);
  const files = walkMarkdownFiles(knowledgeDir);
  const docs = [];
  for (const absolutePath of files) {
    const content = readFileSync6(absolutePath, "utf8");
    const path = relative(knowledgeDir, absolutePath).replaceAll("\\", "/");
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
  const compiledDir = join8(projectDir, knowledgeRoot, ".compiled");
  ensureDir(compiledDir);
  const outputPath = join8(compiledDir, "knowledge.jsonl");
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
  const basename5 = doc.path.split("/").pop() ?? doc.path;
  keys.add(normalizeReference(basename5));
  keys.add(normalizeReference(basename5.replace(/\.md$/i, "")));
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

// src/reconcile/artifact-builders.ts
import { existsSync as existsSync9, readFileSync as readFileSync9 } from "fs";
import { basename as basename2, join as join11 } from "path";

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
    const phaseBlocked = phase.dependsOn.some((dependencyId) => {
      const node = graph.nodes.get(dependencyId);
      if (!node) return false;
      return node.status !== "completed" && node.status !== "completed_with_notes";
    });
    if (phaseBlocked) continue;
    for (const sub of phase.subPhases) {
      if (sub.status === "completed" || sub.status === "completed_with_notes") continue;
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
import { readFileSync as readFileSync7, existsSync as existsSync7, readdirSync as readdirSync5 } from "fs";
import { join as join9, basename } from "path";
import { parseDocument as parseDocument3 } from "yaml";
function parseFrontmatter2(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const doc = parseDocument3(match[1]);
  if (doc.errors.length > 0) return {};
  const parsed = doc.toJSON();
  return parsed && typeof parsed === "object" ? parsed : {};
}
function toStringArray(val) {
  if (Array.isArray(val)) return val.map((item) => toString(item)).filter(Boolean);
  if (typeof val === "string" && val) return [val];
  return [];
}
function toString(val) {
  if (typeof val === "string") return val;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === "number" || typeof val === "boolean" || typeof val === "bigint") {
    return String(val);
  }
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
function toOptionalEnum(val, valid) {
  const parsed = toStatus(val, valid, "");
  return parsed ? parsed : void 0;
}
var PHASE_STATUSES = ["pending", "in_progress", "completed", "completed_with_notes", "blocked"];
var SUBPHASE_STATUSES = ["pending", "in_progress", "completed", "completed_with_notes", "blocked"];
var PHASE_HORIZONS = ["now", "next", "later", "backlog"];
var PHASE_EFFORTS = ["S", "M", "L", "XL"];
var PHASE_SOURCES = ["manual", "workshop", "discovery", "imported"];
function parsePhaseFile(filePath) {
  if (!existsSync7(filePath)) return null;
  const content = readFileSync7(filePath, "utf8");
  const fm = parseFrontmatter2(content);
  if (fm["type"] !== "phase") return null;
  return {
    id: toString(fm["id"]) || basename(filePath, ".md"),
    name: toString(fm["summary"]) || toString(fm["title"]) || basename(filePath, ".md"),
    status: toStatus(fm["status"], PHASE_STATUSES, "pending"),
    dependsOn: toStringArray(fm["depends_on"]),
    intent: toString(fm["intent"]),
    path: filePath,
    summary: toString(fm["summary"]),
    workUnitsTotal: toNumber(fm["work_units_total"], 0),
    lastReviewed: toString(fm["last_reviewed"]) || void 0,
    acceptanceCriteria: toStringArray(fm["acceptance_criteria"]),
    horizon: toOptionalEnum(fm["horizon"], PHASE_HORIZONS),
    outcome: toString(fm["outcome"]) || void 0,
    successMetrics: toStringArray(fm["success_metrics"]),
    estimatedEffort: toOptionalEnum(fm["estimated_effort"], PHASE_EFFORTS),
    source: toOptionalEnum(fm["source"], PHASE_SOURCES),
    sourceRef: toString(fm["source_ref"]) || void 0,
    startedAt: toString(fm["started_at"]) || void 0,
    completedAt: toString(fm["completed_at"]) || void 0,
    workshopRefs: toStringArray(fm["workshop_refs"]),
    prRefs: toStringArray(fm["pr_refs"])
  };
}
function parseSubPhaseFile(filePath) {
  if (!existsSync7(filePath)) return null;
  const content = readFileSync7(filePath, "utf8");
  const fm = parseFrontmatter2(content);
  if (fm["type"] !== "sub-phase") return null;
  return {
    id: toString(fm["id"]) || basename(filePath, ".md"),
    parentPhase: toString(fm["parent_phase"]),
    name: toString(fm["summary"]) || toString(fm["title"]) || basename(filePath, ".md"),
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
  const phasesDir = join9(roadmapDir, "phases");
  if (!existsSync7(phasesDir)) return [];
  const entries = readdirSync5(phasesDir, { withFileTypes: true });
  const phases = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    if (!entry.name.startsWith("phase-")) continue;
    const filePath = join9(phasesDir, entry.name);
    const parsed = parsePhaseFile(filePath);
    if (!parsed) continue;
    const phaseId = parsed.id;
    const phaseNum = phaseId.replace("phase-", "");
    const subPhaseDir = join9(phasesDir, `phase-${phaseNum}`);
    const subPhases = [];
    if (existsSync7(subPhaseDir)) {
      const subEntries = readdirSync5(subPhaseDir, { withFileTypes: true });
      for (const subEntry of subEntries) {
        if (!subEntry.isFile() || !subEntry.name.endsWith(".md")) continue;
        const subPath = join9(subPhaseDir, subEntry.name);
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
  return {
    phases,
    currentPhase: phases.find((phase) => !["completed", "completed_with_notes"].includes(phase.status)) ?? null,
    next: resolveNextUnblocked(roadmapDir)[0] ?? null
  };
}
function resolveNextUnblocked(roadmapDir) {
  const phases = parseRoadmap(roadmapDir);
  if (phases.length === 0) return [];
  const graph = buildDependencyGraph(phases);
  return getNextUnblocked(phases, graph);
}

// src/templates/catalog.ts
import { existsSync as existsSync8, readFileSync as readFileSync8 } from "fs";
import { dirname as dirname4, join as join10 } from "path";
import { fileURLToPath as fileURLToPath3 } from "url";
var __filename = fileURLToPath3(import.meta.url);
var __dirname2 = dirname4(__filename);
var cliRoot = [join10(__dirname2, ".."), join10(__dirname2, "..", "..")].find(
  (candidate) => existsSync8(join10(candidate, "package.json"))
) ?? join10(__dirname2, "..", "..");
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
  return readFileSync8(filePath, "utf8");
}
function resolveTemplateSource(templateName) {
  if (templateName.startsWith("core/templates/")) {
    const relFile2 = templateName.slice("core/templates/".length);
    const filePath2 = join10(coreTemplatesDir, relFile2);
    if (!existsSync8(filePath2)) return null;
    return { sourcePath: filePath2, content: readFileSync8(filePath2, "utf8") };
  }
  const packsMatch = templateName.match(/^packs\/([^/]+)\/templates\/(.+)$/);
  if (!packsMatch) return null;
  const [, packName, relFile] = packsMatch;
  const filePath = join10(packsDir, packName, "templates", relFile);
  if (!existsSync8(filePath)) return null;
  return { sourcePath: filePath, content: readFileSync8(filePath, "utf8") };
}
function createTemplateResolver(syntheticTemplates) {
  return (templateName) => {
    if (templateName in syntheticTemplates) {
      return { sourcePath: templateName, content: syntheticTemplates[templateName] };
    }
    return resolveTemplateSource(templateName);
  };
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

// src/reconcile/artifact-builders.ts
var GENERATED_START = "<!-- kdoc:generated:start -->";
var GENERATED_END = "<!-- kdoc:generated:end -->";
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
function loadRenderedTemplate(templateName, values) {
  const resolved = resolveTemplateSource(templateName);
  if (!resolved) {
    throw new Error(`Template not found: ${templateName}`);
  }
  return renderTemplate(resolved.content, values).content;
}
function isDerivedArtifactPath(path) {
  return path === "INDEX.md" || path === "ContextPack.md" || path === "llms.txt";
}
function renderContextPackSections(projectDir, knowledgeRoot, docs) {
  const scopedDocs = docs.filter((doc) => !isDerivedArtifactPath(doc.path));
  const areas = /* @__PURE__ */ new Map();
  for (const doc of scopedDocs) {
    const area = doc.path.split("/")[0] ?? "Knowledge";
    const current = areas.get(area) ?? [];
    current.push(doc.path);
    areas.set(area, current);
  }
  const adrDocs = scopedDocs.filter((doc) => doc.type === "adr" && !doc.path.endsWith("README.md")).sort((a, b) => String(b.frontmatter.date ?? "").localeCompare(String(a.frontmatter.date ?? ""))).slice(0, 5);
  const tldrDocs = scopedDocs.filter((doc) => {
    if (doc.path.endsWith("README.md")) return false;
    if (doc.type === "tldr") return true;
    if (String(doc.frontmatter.area ?? "") === "tldr") return true;
    if (doc.path.startsWith("TLDR/") || doc.path.includes("/TLDR/")) return true;
    return false;
  }).slice(0, 5);
  const roadmapStatus = resolveRoadmapStatus(join11(projectDir, knowledgeRoot, "Roadmap"));
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
function renderIndexSections(docs) {
  const scopedDocs = docs.filter((doc) => !isDerivedArtifactPath(doc.path));
  const grouped = /* @__PURE__ */ new Map();
  for (const doc of scopedDocs) {
    const area = doc.path.split("/")[0] ?? "Knowledge";
    const current = grouped.get(area) ?? [];
    current.push(doc);
    grouped.set(area, current);
  }
  return [
    `**Total documents:** ${scopedDocs.length}`,
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
      knowledgeRoot: join11(config.root ?? "Knowledge", "packages", packageName),
      outputPath: join11(projectDir, config.root ?? "Knowledge", "packages", packageName, "ContextPack.md"),
      scopeValue: packageName,
      projectName: packageName
    };
  }
  return {
    knowledgeRoot: config.root ?? "Knowledge",
    outputPath: join11(projectDir, config.root ?? "Knowledge", "ContextPack.md"),
    scopeValue: "root",
    projectName: basename2(projectDir)
  };
}
function generateFromTemplate(options) {
  const renderedTemplate = loadRenderedTemplate(options.templateName, options.values);
  const generatedTemplate = replaceGeneratedBlock(renderedTemplate, options.generatedBody);
  if (!existsSync9(options.outputPath)) {
    return generatedTemplate;
  }
  const existingContent = readFileSync9(options.outputPath, "utf8");
  if (existingContent.includes(GENERATED_START) && existingContent.includes(GENERATED_END)) {
    return replaceGeneratedBlock(existingContent, options.generatedBody);
  }
  return preserveExistingFrontmatter(existingContent, generatedTemplate);
}
function buildContextPackArtifact(projectDir, config, packageName) {
  const scope = resolveScopeOptions(projectDir, config, packageName);
  const docs = parseKnowledgeDocs(projectDir, scope.knowledgeRoot);
  return {
    outputPath: scope.outputPath,
    content: generateFromTemplate({
      outputPath: scope.outputPath,
      templateName: "core/templates/context-pack.md",
      values: {
        PROJECT_NAME: scope.projectName || "project",
        KNOWLEDGE_ROOT: scope.knowledgeRoot,
        SCOPE: scope.scopeValue
      },
      generatedBody: renderContextPackSections(projectDir, scope.knowledgeRoot, docs)
    })
  };
}
function buildIndexArtifact(projectDir, config) {
  const knowledgeRoot = config.root ?? "Knowledge";
  const docs = parseKnowledgeDocs(projectDir, knowledgeRoot);
  const outputPath = join11(projectDir, knowledgeRoot, "INDEX.md");
  return {
    outputPath,
    content: generateFromTemplate({
      outputPath,
      templateName: "core/templates/index.md",
      values: {
        PROJECT_NAME: basename2(projectDir) || "project",
        KNOWLEDGE_ROOT: knowledgeRoot
      },
      generatedBody: renderIndexSections(docs)
    })
  };
}

// src/commands/generate.ts
function getProjectDir() {
  return process.env.KDOC_PROJECT_DIR ?? process.cwd();
}
function renderLlmsTxt(projectDir, docs) {
  const projectName = basename3(projectDir);
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
function resolveContextPackKnowledgeRoot(config, packageName) {
  if (!packageName) {
    return config.root ?? "Knowledge";
  }
  const packageConfig = config.packages?.[packageName];
  if (!packageConfig) {
    throw new Error(
      `Unknown package "${packageName}". Valid packages: ${Object.keys(config.packages ?? {}).join(", ")}`
    );
  }
  return join12(config.root ?? "Knowledge", "packages", packageName);
}
function generateContextPack(projectDir, config, packageName) {
  const knowledgeRoot = resolveContextPackKnowledgeRoot(config, packageName);
  writeKnowledgeJsonl(projectDir, parseKnowledgeDocs(projectDir, knowledgeRoot), knowledgeRoot);
  const artifact = buildContextPackArtifact(projectDir, config, packageName);
  safeWriteFile(artifact.outputPath, artifact.content);
  return artifact.outputPath;
}
function registerGenerateCommand(program) {
  const generate = new Command2("generate");
  generate.description("Generate derived Knowledge artifacts");
  generate.command("context-pack").description("Generate Knowledge/ContextPack.md").option("--package <name>", "Generate a package-scoped ContextPack in monorepos").action((options) => {
    const projectDir = getProjectDir();
    const config = loadConfig(projectDir);
    if (!config) {
      console.error("Error: .kdoc.yaml not found. Run `kdoc init` first.");
      process.exitCode = 1;
      return;
    }
    try {
      if (options.package === "all") {
        const packageNames = Object.keys(config.packages ?? {});
        if (packageNames.length === 0) {
          throw new Error(
            "Cannot use --package all without configured packages. This command requires a monorepo config with at least one entry in config.packages."
          );
        }
        for (const packageName of packageNames) {
          console.log(`Generated: ${generateContextPack(projectDir, config, packageName)}`);
        }
        console.log(`Generated: ${generateContextPack(projectDir, config)}`);
        console.log(`Processed packages: ${packageNames.join(", ")}`);
        return;
      }
      console.log(`Generated: ${generateContextPack(projectDir, config, options.package)}`);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  });
  generate.command("llms-txt").description("Generate Knowledge/llms.txt").action(() => {
    const projectDir = getProjectDir();
    const config = loadConfig(projectDir);
    if (!config) {
      console.error("Error: .kdoc.yaml not found. Run `kdoc init` first.");
      process.exitCode = 1;
      return;
    }
    const knowledgeRoot = config.root ?? "Knowledge";
    const docs = parseKnowledgeDocs(projectDir, knowledgeRoot);
    writeKnowledgeJsonl(projectDir, docs, knowledgeRoot);
    const outputPath = join12(projectDir, knowledgeRoot, "llms.txt");
    safeWriteFile(outputPath, renderLlmsTxt(projectDir, docs));
    console.log(`Generated: ${outputPath}`);
  });
  generate.command("index").description("Generate Knowledge/INDEX.md with navigation links").action(() => {
    const projectDir = getProjectDir();
    const config = loadConfig(projectDir);
    if (!config) {
      console.error("Error: .kdoc.yaml not found. Run `kdoc init` first.");
      process.exitCode = 1;
      return;
    }
    const artifact = buildIndexArtifact(projectDir, config);
    safeWriteFile(artifact.outputPath, artifact.content);
    console.log(`Generated: ${artifact.outputPath}`);
  });
  program.addCommand(generate);
}

// src/reconcile/collector.ts
import { existsSync as existsSync10, readdirSync as readdirSync6, readFileSync as readFileSync11 } from "fs";
import { dirname as dirname5, join as join13, relative as relative2 } from "path";
import { fileURLToPath as fileURLToPath4 } from "url";

// src/utils/hash.ts
import { createHash } from "crypto";
import { readFileSync as readFileSync10 } from "fs";
var HASH_PREFIX = "sha256:";
function hashString(content) {
  const hex = createHash("sha256").update(content, "utf8").digest("hex");
  return `${HASH_PREFIX}${hex}`;
}
function hashFile(filePath) {
  const content = readFileSync10(filePath, "utf8");
  return hashString(content);
}

// src/reconcile/types.ts
var FINDING_TIER_ASSIGNMENTS = {
  LEGACY_FRONTMATTER_FIELD: "auto-fix",
  INVALID_FRONTMATTER: "report-only",
  BROKEN_WIKILINK: "report-only",
  FORBIDDEN_WIKILINK: "report-only",
  MISSING_REQUIRED: "needs-approval",
  ADR_NUMBERING_GAP: "report-only",
  ADR_NUMBERING_DUPLICATE: "report-only",
  ADR_MISSING_SECTION: "report-only",
  ADR_SUPERSESSION_STATUS: "auto-fix",
  ADR_SUPERSESSION_MISSING_SUCCESSOR: "report-only",
  ADR_SUPERSESSION_ASYMMETRIC: "report-only",
  ADR_SUPERSEDES_MISSING: "report-only",
  ADR_SUPERSEDES_ASYMMETRIC: "report-only",
  STALE_CONTEXT_PACK: "needs-approval",
  STALE_INDEX: "needs-approval",
  FRONTMATTER_STATUS_CASE: "auto-fix"
};
function resolveRepairTier(context) {
  switch (context.code) {
    case "BROKEN_WIKILINK":
      return context.candidates.length === 1 ? "auto-fix" : "report-only";
    case "MISSING_REQUIRED":
      return context.ownership === "generated" || context.ownership === "templated-user" ? "needs-approval" : "report-only";
    default:
      return FINDING_TIER_ASSIGNMENTS[context.code];
  }
}

// src/reconcile/normalization.ts
var STATUS_NORMALIZATION = {
  Draft: "draft",
  DRAFT: "draft",
  Accepted: "accepted",
  ACCEPTED: "accepted",
  Superseded: "superseded",
  SUPERSEDED: "superseded",
  Deprecated: "deprecated",
  DEPRECATED: "deprecated",
  Proposed: "proposed",
  PROPOSED: "proposed",
  Rejected: "rejected",
  REJECTED: "rejected"
};
function normalizeStatus(raw) {
  return STATUS_NORMALIZATION[raw] ?? null;
}

// src/reconcile/scope.ts
function sanitizePath(raw) {
  const normalized = raw.replace(/\\/g, "/").replace(/^\.\//, "");
  if (normalized.split("/").some((seg) => seg === "..")) {
    return null;
  }
  return normalized;
}
function matchesAreaFilter(filePath, area, knowledgeRoot) {
  const normalizedArea = area.toLowerCase();
  const expectation = AREA_EXPECTATIONS[normalizedArea];
  if (!expectation) return false;
  if (expectation.file && !expectation.path) {
    return filePath === `${knowledgeRoot}/${expectation.file}` || filePath.endsWith(`/${expectation.file}`);
  }
  if (expectation.path) {
    const prefix = `${knowledgeRoot}/${expectation.path}/`;
    return filePath.startsWith(prefix) || filePath.includes(`/${expectation.path}/`);
  }
  return false;
}
function matchesPackageFilter(filePath, packageName) {
  return filePath.includes(`packages/${packageName}/`);
}
function matchesPathFilter(filePath, pathPrefix) {
  const normalized = pathPrefix.endsWith("/") ? pathPrefix : `${pathPrefix}/`;
  return filePath.startsWith(pathPrefix) || filePath.startsWith(normalized);
}
function applyFilters(findings, options, knowledgeRoot = "Knowledge") {
  if (!options) return findings;
  const { area, package: packageName, path: rawPath } = options;
  let path;
  if (rawPath) {
    const sanitized = sanitizePath(rawPath);
    if (sanitized === null) {
      return [];
    }
    path = sanitized;
  }
  const hasAnyFilter = area || packageName || path;
  if (!hasAnyFilter) return findings;
  return findings.filter((f) => {
    if (area && !matchesAreaFilter(f.filePath, area, knowledgeRoot)) return false;
    if (packageName && !matchesPackageFilter(f.filePath, packageName)) return false;
    if (path && !matchesPathFilter(f.filePath, path)) return false;
    return true;
  });
}

// src/reconcile/file-metadata.ts
function classifyFile(filePath, knowledgeRoot, areaExpectations = AREA_EXPECTATIONS) {
  if (filePath.endsWith("/ContextPack.md") || filePath === `${knowledgeRoot}/ContextPack.md`) {
    return {
      templateName: "core/templates/contextpack.md",
      areaName: "context-pack",
      ownership: "generated"
    };
  }
  if (filePath === `${knowledgeRoot}/INDEX.md`) {
    return {
      templateName: "core/templates/index.md",
      areaName: "index",
      ownership: "generated"
    };
  }
  for (const [areaName, expectation] of Object.entries(areaExpectations)) {
    if (expectation.file) {
      const expectedPath = expectation.path ? `${knowledgeRoot}/${expectation.path}/${expectation.file}` : `${knowledgeRoot}/${expectation.file}`;
      if (filePath === expectedPath || filePath.endsWith(expectation.file)) {
        if (expectation.type === "generated-required") {
          return {
            templateName: `core/templates/${expectation.file.toLowerCase()}`,
            areaName,
            ownership: "generated"
          };
        }
        if (expectation.type === "seed-file-required") {
          return {
            templateName: `core/templates/${expectation.file.toLowerCase()}`,
            areaName,
            ownership: "seeded"
          };
        }
      }
    }
    if (expectation.type === "readme-required" && expectation.path) {
      const readmePath = `${knowledgeRoot}/${expectation.path}/README.md`;
      if (filePath === readmePath || filePath.endsWith(`${expectation.path}/README.md`)) {
        return {
          templateName: `core/templates/readme-${areaName}.md`,
          areaName,
          ownership: "templated-user"
        };
      }
    }
  }
  return { templateName: "", areaName: "", ownership: "report-only" };
}

// src/reconcile/collector.ts
async function resolveGovernanceEngine() {
  const currentDir = dirname5(fileURLToPath4(import.meta.url));
  const candidates = [
    join13(currentDir, "..", "..", "..", "core", "governance-engine.mjs"),
    join13(currentDir, "..", "..", "core", "governance-engine.mjs"),
    join13(currentDir, "..", "core", "governance-engine.mjs")
  ];
  const enginePath = candidates.find((p) => existsSync10(p));
  if (!enginePath) {
    throw new Error(
      "Unable to resolve governance-engine.mjs. Searched:\n" + candidates.join("\n")
    );
  }
  return enginePath;
}
function listMarkdownFiles(dir) {
  if (!existsSync10(dir)) return [];
  const files = [];
  for (const entry of readdirSync6(dir, { withFileTypes: true })) {
    const fullPath = join13(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}
function extractFrontmatterStatus(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return null;
  const statusMatch = match[1].match(/^status:\s*(.+)$/m);
  if (!statusMatch) return null;
  return statusMatch[1].trim().replace(/^["']|["']$/g, "");
}
function inferContextFromViolation(v) {
  const code = v.code;
  switch (code) {
    case "LEGACY_FRONTMATTER_FIELD": {
      if (v.actual && v.expected) {
        return {
          code: "LEGACY_FRONTMATTER_FIELD",
          legacyField: v.actual,
          canonicalField: v.expected
        };
      }
      const legacyMatch = v.message.match(/legacy "([^"]+)"/);
      const canonicalMatch = v.message.match(/Prefer "([^"]+)"/);
      return {
        code: "LEGACY_FRONTMATTER_FIELD",
        legacyField: legacyMatch?.[1] ?? "",
        canonicalField: canonicalMatch?.[1] ?? ""
      };
    }
    case "INVALID_FRONTMATTER":
      return {
        code: "INVALID_FRONTMATTER",
        field: v.expected ?? "",
        expected: v.expected ?? "",
        actual: v.actual ?? ""
      };
    case "BROKEN_WIKILINK": {
      const target = v.expected ?? v.message.match(/\[\[([^\]]+)\]\]/)?.[1] ?? "";
      return {
        code: "BROKEN_WIKILINK",
        target,
        candidates: []
        // populated later by findWikilinkCandidates
      };
    }
    case "FORBIDDEN_WIKILINK":
      return { code: "FORBIDDEN_WIKILINK" };
    case "MISSING_REQUIRED":
      return {
        code: "MISSING_REQUIRED",
        templateName: "",
        areaName: "",
        ownership: "report-only"
      };
    case "ADR_NUMBERING_GAP":
      return { code: "ADR_NUMBERING_GAP" };
    case "ADR_NUMBERING_DUPLICATE":
      return { code: "ADR_NUMBERING_DUPLICATE" };
    case "ADR_MISSING_SECTION": {
      if (v.expected) {
        return { code: "ADR_MISSING_SECTION", section: v.expected };
      }
      const sectionMatch = v.message.match(/missing required section "## ([^"]+)"/);
      return { code: "ADR_MISSING_SECTION", section: sectionMatch?.[1] ?? "" };
    }
    case "ADR_SUPERSESSION_STATUS": {
      if (v.actual) {
        return {
          code: "ADR_SUPERSESSION_STATUS",
          expectedStatus: v.expected ?? "superseded",
          actualStatus: v.actual
        };
      }
      const statusMatch = v.message.match(/status is "([^"]*)"/);
      return {
        code: "ADR_SUPERSESSION_STATUS",
        expectedStatus: "superseded",
        actualStatus: statusMatch?.[1] ?? ""
      };
    }
    case "ADR_SUPERSESSION_MISSING_SUCCESSOR":
      return { code: "ADR_SUPERSESSION_MISSING_SUCCESSOR" };
    case "ADR_SUPERSESSION_ASYMMETRIC":
      return { code: "ADR_SUPERSESSION_ASYMMETRIC" };
    case "ADR_SUPERSEDES_MISSING":
      return { code: "ADR_SUPERSEDES_MISSING" };
    case "ADR_SUPERSEDES_ASYMMETRIC":
      return { code: "ADR_SUPERSEDES_ASYMMETRIC" };
    default:
      return { code: "ADR_NUMBERING_GAP" };
  }
}
function mapViolationToFinding(v) {
  const code = v.code;
  if (!(code in FINDING_TIER_ASSIGNMENTS)) return null;
  const context = inferContextFromViolation(v);
  return {
    code,
    filePath: v.path,
    tier: resolveRepairTier(context),
    severity: v.severity,
    message: v.message,
    context
  };
}
function findWikilinkCandidates(target, projectDir, knowledgeRoot) {
  const kDir = join13(projectDir, knowledgeRoot);
  if (!existsSync10(kDir)) return [];
  const allFiles = listMarkdownFiles(kDir);
  const normalizedTarget = target.toLowerCase().replace(/\.md$/, "");
  const candidates = [];
  for (const absPath of allFiles) {
    const relToKnowledge = relative2(kDir, absPath);
    const relNoExt = relToKnowledge.replace(/\.md$/, "").toLowerCase();
    const filename = relToKnowledge.split("/").pop()?.replace(/\.md$/, "").toLowerCase() ?? "";
    if (relNoExt === normalizedTarget || filename === normalizedTarget) {
      candidates.push(join13(knowledgeRoot, relToKnowledge));
    }
  }
  return candidates.sort();
}
function detectStatusCaseViolations(projectDir, knowledgeRoot) {
  const findings = [];
  const kDir = join13(projectDir, knowledgeRoot);
  for (const absPath of listMarkdownFiles(kDir)) {
    const content = readFileSync11(absPath, "utf8");
    const status = extractFrontmatterStatus(content);
    if (!status) continue;
    const normalized = normalizeStatus(status);
    if (normalized === null) continue;
    const relPath = relative2(projectDir, absPath);
    findings.push({
      code: "FRONTMATTER_STATUS_CASE",
      filePath: relPath,
      tier: "auto-fix",
      severity: "warning",
      message: `Status "${status}" should be "${normalized}" in ${relPath}`,
      context: { code: "FRONTMATTER_STATUS_CASE", actual: status, normalized }
    });
  }
  return findings;
}
async function detectStaleness(projectDir, config, warnings) {
  const findings = [];
  const knowledgeRoot = config.root ?? "Knowledge";
  try {
    const desired = buildIndexArtifact(projectDir, config);
    const indexPath = join13(projectDir, knowledgeRoot, "INDEX.md");
    if (existsSync10(indexPath)) {
      const current = readFileSync11(indexPath, "utf8");
      if (hashString(current) !== hashString(desired.content)) {
        findings.push({
          code: "STALE_INDEX",
          filePath: join13(knowledgeRoot, "INDEX.md"),
          tier: "needs-approval",
          severity: "warning",
          message: `INDEX.md content differs from what generate would produce`,
          context: { code: "STALE_INDEX" }
        });
      }
    }
  } catch (err) {
    warnings.push(`Staleness check for INDEX.md failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  try {
    const desired = buildContextPackArtifact(projectDir, config);
    const cpPath = join13(projectDir, knowledgeRoot, "ContextPack.md");
    if (existsSync10(cpPath)) {
      const current = readFileSync11(cpPath, "utf8");
      if (hashString(current) !== hashString(desired.content)) {
        findings.push({
          code: "STALE_CONTEXT_PACK",
          filePath: join13(knowledgeRoot, "ContextPack.md"),
          tier: "needs-approval",
          severity: "warning",
          message: `ContextPack.md content differs from what generate would produce`,
          context: { code: "STALE_CONTEXT_PACK" }
        });
      }
    }
  } catch (err) {
    warnings.push(`Staleness check for ContextPack.md failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (config.topology === "monorepo" && config.packages) {
    for (const pkgName of Object.keys(config.packages)) {
      try {
        const desired = buildContextPackArtifact(projectDir, config, pkgName);
        const cpPath = join13(projectDir, knowledgeRoot, "packages", pkgName, "ContextPack.md");
        if (existsSync10(cpPath)) {
          const current = readFileSync11(cpPath, "utf8");
          if (hashString(current) !== hashString(desired.content)) {
            findings.push({
              code: "STALE_CONTEXT_PACK",
              filePath: join13(knowledgeRoot, "packages", pkgName, "ContextPack.md"),
              tier: "needs-approval",
              severity: "warning",
              message: `ContextPack.md for ${pkgName} content differs from what generate would produce`,
              context: { code: "STALE_CONTEXT_PACK", packageScope: pkgName }
            });
          }
        }
      } catch (err) {
        warnings.push(`Staleness check for ${pkgName}/ContextPack.md failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return findings;
}
function normalizeMissingRequiredFilePath(filePath, knowledgeRoot) {
  if (filePath.startsWith(`${knowledgeRoot}/`)) {
    return filePath;
  }
  const [areaName, ...rest] = filePath.split("/");
  const expectation = AREA_EXPECTATIONS[areaName];
  if (!expectation) {
    return filePath;
  }
  const missingFile = rest.join("/");
  if (expectation.path) {
    return `${knowledgeRoot}/${expectation.path}/${missingFile}`;
  }
  return `${knowledgeRoot}/${missingFile}`;
}
async function collectFindings(projectDir, config, options) {
  const findings = [];
  const warnings = [];
  const knowledgeRoot = config.root ?? "Knowledge";
  const enginePath = await resolveGovernanceEngine();
  const engine = await import(enginePath);
  const report = engine.runGovernance(projectDir, {
    knowledgeRoot,
    extensionAreas: config.extensionAreas
  });
  for (const v of report.violations ?? []) {
    const finding = mapViolationToFinding(v);
    if (!finding) continue;
    if (finding.code === "BROKEN_WIKILINK") {
      const ctx = finding.context;
      ctx.candidates = findWikilinkCandidates(ctx.target, projectDir, knowledgeRoot);
      finding.tier = resolveRepairTier(finding.context);
    }
    if (finding.code === "MISSING_REQUIRED") {
      finding.filePath = normalizeMissingRequiredFilePath(finding.filePath, knowledgeRoot);
      const classification = classifyFile(finding.filePath, knowledgeRoot);
      const ctx = finding.context;
      ctx.templateName = classification.templateName;
      ctx.areaName = classification.areaName;
      ctx.ownership = classification.ownership;
      finding.tier = resolveRepairTier(finding.context);
    }
    findings.push(finding);
  }
  findings.push(...detectStatusCaseViolations(projectDir, knowledgeRoot));
  findings.push(...await detectStaleness(projectDir, config, warnings));
  return { findings: applyFilters(findings, options, knowledgeRoot), warnings };
}

// src/reconcile/executor.ts
import { readFileSync as readFileSync16 } from "fs";
import { join as join19 } from "path";

// src/reconcile/repairs/frontmatter.ts
import { readFileSync as readFileSync12, writeFileSync as writeFileSync4 } from "fs";
import { join as join14 } from "path";
function replaceFrontmatterField(content, field, oldValue, newValue) {
  const fmMatch = content.match(/^(---\n)([\s\S]*?\n)(---\n?)/);
  if (!fmMatch) return null;
  const [fullMatch, opening, body, closing] = fmMatch;
  const escapedField = escapeForRegex(field);
  const escapedOld = escapeForRegex(oldValue);
  const fieldPattern = new RegExp(
    `^(${escapedField}:\\s*)(?:${escapedOld}|"${escapedOld}"|'${escapedOld}')(\\s*)$`,
    "m"
  );
  const match = body.match(fieldPattern);
  if (!match) return null;
  const matchedValue = match[0].slice(match[1].length).trimEnd();
  let replacement;
  if (matchedValue.startsWith('"') && matchedValue.endsWith('"')) {
    replacement = `"${newValue}"`;
  } else if (matchedValue.startsWith("'") && matchedValue.endsWith("'")) {
    replacement = `'${newValue}'`;
  } else {
    replacement = newValue;
  }
  const newBody = body.replace(fieldPattern, `$1${replacement}$2`);
  return content.replace(fullMatch, `${opening}${newBody}${closing}`);
}
function renameFrontmatterField(content, oldField, newField) {
  const fmMatch = content.match(/^(---\n)([\s\S]*?\n)(---\n?)/);
  if (!fmMatch) return null;
  const [fullMatch, opening, body, closing] = fmMatch;
  const fieldPattern = new RegExp(
    `^${escapeForRegex(oldField)}(:\\s*)`,
    "m"
  );
  if (!fieldPattern.test(body)) return null;
  const newBody = body.replace(fieldPattern, `${newField}$1`);
  return content.replace(fullMatch, `${opening}${newBody}${closing}`);
}
function escapeForRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function repairLegacyFrontmatterField(finding, projectDir, _config) {
  const ctx = finding.context;
  if (ctx.code !== "LEGACY_FRONTMATTER_FIELD") {
    return { finding, status: "skipped", reason: "Wrong context type", filesModified: [] };
  }
  const absPath = join14(projectDir, finding.filePath);
  let content;
  try {
    content = readFileSync12(absPath, "utf8");
  } catch {
    return { finding, status: "failed", reason: `Cannot read ${finding.filePath}`, filesModified: [] };
  }
  const result = renameFrontmatterField(content, ctx.legacyField, ctx.canonicalField);
  if (result === null) {
    return { finding, status: "skipped", reason: `Field "${ctx.legacyField}" not found in frontmatter`, filesModified: [] };
  }
  writeFileSync4(absPath, result, "utf8");
  return { finding, status: "applied", filesModified: [finding.filePath] };
}
function repairStatusCase(finding, projectDir, _config) {
  const ctx = finding.context;
  if (ctx.code !== "FRONTMATTER_STATUS_CASE") {
    return { finding, status: "skipped", reason: "Wrong context type", filesModified: [] };
  }
  const absPath = join14(projectDir, finding.filePath);
  let content;
  try {
    content = readFileSync12(absPath, "utf8");
  } catch {
    return { finding, status: "failed", reason: `Cannot read ${finding.filePath}`, filesModified: [] };
  }
  const result = replaceFrontmatterField(content, "status", ctx.actual, ctx.normalized);
  if (result === null) {
    return { finding, status: "skipped", reason: `status: "${ctx.actual}" not found in frontmatter`, filesModified: [] };
  }
  writeFileSync4(absPath, result, "utf8");
  return { finding, status: "applied", filesModified: [finding.filePath] };
}
function repairSupersessionStatus(finding, projectDir, _config) {
  const ctx = finding.context;
  if (ctx.code !== "ADR_SUPERSESSION_STATUS") {
    return { finding, status: "skipped", reason: "Wrong context type", filesModified: [] };
  }
  const absPath = join14(projectDir, finding.filePath);
  let content;
  try {
    content = readFileSync12(absPath, "utf8");
  } catch {
    return { finding, status: "failed", reason: `Cannot read ${finding.filePath}`, filesModified: [] };
  }
  if (ctx.actualStatus) {
    const result = replaceFrontmatterField(content, "status", ctx.actualStatus, ctx.expectedStatus);
    if (result === null) {
      return { finding, status: "skipped", reason: `status: "${ctx.actualStatus}" not found in frontmatter`, filesModified: [] };
    }
    writeFileSync4(absPath, result, "utf8");
  } else {
    const fmMatch = content.match(/^(---\n)/);
    if (!fmMatch) {
      return { finding, status: "skipped", reason: "No frontmatter found", filesModified: [] };
    }
    const updated = content.replace(/^(---\n)/, `$1status: ${ctx.expectedStatus}
`);
    writeFileSync4(absPath, updated, "utf8");
  }
  return { finding, status: "applied", filesModified: [finding.filePath] };
}

// src/reconcile/repairs/missing-file.ts
import { existsSync as existsSync12, readFileSync as readFileSync13 } from "fs";
import { dirname as dirname6, join as join16 } from "path";

// src/templates/render-values.ts
import { existsSync as existsSync11, readdirSync as readdirSync7 } from "fs";
import { basename as basename4, join as join15 } from "path";

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

// src/templates/render-values.ts
var DEFAULT_TLDR_SCOPES = ["Frontend", "Backend", "Shared"];
function normalizePath(value) {
  return value.replaceAll("\\", "/").replace(/\/+$/, "");
}
function buildTldrStructureComment(scopes) {
  if (scopes.length === 0) {
    return "|- Frontend/\n|- Backend/\n\\- Shared/";
  }
  return scopes.map((scope, index) => {
    const prefix = index === scopes.length - 1 ? "\\- " : "|- ";
    return `${prefix}${scope}/`;
  }).join("\n");
}
function resolveAdrNextSequence(projectDir, scopePath) {
  const adrDir = join15(projectDir, scopePath, "ADR");
  if (!existsSync11(adrDir)) return "0001";
  const numbers = readdirSync7(adrDir).map((entry) => {
    const match = entry.match(/^ADR-(\d{4})-/);
    return match ? Number.parseInt(match[1], 10) : 0;
  }).filter((value) => value > 0);
  const max = numbers.length > 0 ? Math.max(...numbers) : 0;
  return String(max + 1).padStart(4, "0");
}
function resolveScopeMetadata(config, rawScopePath) {
  const knowledgeRoot = normalizePath(config.root ?? "Knowledge");
  const scopePath = normalizePath(rawScopePath ?? knowledgeRoot);
  const rootTldrScopes = config.areas?.tldr?.scopes ?? [];
  const packagePrefix = `${knowledgeRoot}/packages/`;
  if (scopePath === knowledgeRoot) {
    return {
      scopePath: knowledgeRoot,
      scopeName: "root",
      tldrScopes: rootTldrScopes,
      wikilinkPrefix: ""
    };
  }
  if (scopePath.startsWith(packagePrefix)) {
    const packageName = scopePath.slice(packagePrefix.length).split("/")[0];
    const packageConfig = packageName ? config.packages?.[packageName] : void 0;
    const packageTldrScopes = packageConfig?.areas?.tldr?.scopes ?? rootTldrScopes;
    return {
      scopePath: packageName ? `${packagePrefix}${packageName}` : knowledgeRoot,
      scopeName: packageName || "root",
      tldrScopes: packageTldrScopes,
      wikilinkPrefix: packageName ? `packages/${packageName}/` : ""
    };
  }
  const categoryName = scopePath.slice(`${knowledgeRoot}/`.length).split("/")[0];
  if (config.topology === "vault" && categoryName && config.categories?.[categoryName]) {
    return {
      scopePath: `${knowledgeRoot}/${categoryName}`,
      scopeName: categoryName,
      tldrScopes: rootTldrScopes,
      wikilinkPrefix: "",
      categoryName,
      categoryLabel: config.categories[categoryName].label ?? categoryName
    };
  }
  return {
    scopePath: knowledgeRoot,
    scopeName: "root",
    tldrScopes: rootTldrScopes,
    wikilinkPrefix: ""
  };
}
function resolveRenderScopePath(config, targetPath) {
  const knowledgeRoot = (config.root ?? "Knowledge").replaceAll("\\", "/");
  const normalizedTargetPath = targetPath.replaceAll("\\", "/");
  const packagePrefix = `${knowledgeRoot}/packages/`;
  if (normalizedTargetPath.startsWith(packagePrefix)) {
    const packageName = normalizedTargetPath.slice(packagePrefix.length).split("/")[0];
    return packageName ? `${knowledgeRoot}/packages/${packageName}` : knowledgeRoot;
  }
  if (config.topology === "vault" && normalizedTargetPath.startsWith(`${knowledgeRoot}/`)) {
    const categoryName = normalizedTargetPath.slice(`${knowledgeRoot}/`.length).split("/")[0];
    if (categoryName && config.categories?.[categoryName]) {
      return `${knowledgeRoot}/${categoryName}`;
    }
  }
  return void 0;
}
function buildScopedRenderValues(config, projectDir, scopePath) {
  const knowledgeRoot = config.root ?? "Knowledge";
  const metadata = resolveScopeMetadata(config, scopePath);
  const tldrScopes = metadata.tldrScopes.length > 0 ? metadata.tldrScopes : DEFAULT_TLDR_SCOPES;
  const values = {
    PROJECT_NAME: basename4(projectDir) || "project",
    KNOWLEDGE_ROOT: knowledgeRoot,
    SCOPE: metadata.scopeName,
    DATE: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
    OWNER: getGitOwner(projectDir) || "repository owner",
    ADR_NEXT_SEQUENCE: resolveAdrNextSequence(projectDir, metadata.scopePath),
    TLDR_SCOPES: tldrScopes.join(", "),
    TLDR_STRUCTURE_COMMENT: buildTldrStructureComment(tldrScopes),
    WIKILINK_PREFIX: metadata.wikilinkPrefix
  };
  if (metadata.categoryName) {
    values.CATEGORY_NAME = metadata.categoryName;
    values.CATEGORY_LABEL = metadata.categoryLabel ?? metadata.categoryName;
  }
  return values;
}

// src/reconcile/repairs/missing-file.ts
function resolveTemplateContent(finding, projectDir, config) {
  const ctx = finding.context;
  if (ctx.code !== "MISSING_REQUIRED") {
    throw new Error("Invalid missing-file repair context");
  }
  if (ctx.ownership === "generated") {
    if (finding.filePath.endsWith("/INDEX.md") || finding.filePath === `${config.root ?? "Knowledge"}/INDEX.md`) {
      return buildIndexArtifact(projectDir, config).content;
    }
    if (finding.filePath.endsWith("/ContextPack.md")) {
      const match = finding.filePath.match(/\/packages\/([^/]+)\/ContextPack\.md$/);
      return buildContextPackArtifact(projectDir, config, match?.[1]).content;
    }
  }
  const template = resolveTemplateSource(ctx.templateName);
  if (!template) {
    throw new Error(`Template not found: ${ctx.templateName}`);
  }
  const scopePath = dirname6(finding.filePath).endsWith("/ADR") || dirname6(finding.filePath).endsWith("/TLDR") || dirname6(finding.filePath).endsWith("/Design") || dirname6(finding.filePath).endsWith("/Roadmap") ? dirname6(dirname6(finding.filePath)) : dirname6(finding.filePath);
  return renderTemplate(
    template.content,
    buildScopedRenderValues(config, projectDir, scopePath === "." ? void 0 : scopePath)
  ).content;
}
function repairMissingRequired(finding, projectDir, config) {
  const ctx = finding.context;
  if (ctx.code !== "MISSING_REQUIRED") {
    return { finding, status: "skipped", reason: "Wrong context type", filesModified: [] };
  }
  if (ctx.ownership === "seeded" || ctx.ownership === "report-only") {
    return {
      finding,
      status: "skipped",
      reason: `${ctx.ownership} files require manual authorship`,
      filesModified: []
    };
  }
  const targetPath = join16(projectDir, finding.filePath);
  const content = resolveTemplateContent(finding, projectDir, config);
  if (existsSync12(targetPath)) {
    const existing = readFileSync13(targetPath, "utf8");
    if (existing === content) {
      return {
        finding,
        status: "skipped",
        reason: "file already matches the expected content",
        filesModified: []
      };
    }
  }
  safeWriteFile(targetPath, content);
  return { finding, status: "applied", filesModified: [finding.filePath] };
}

// src/reconcile/repairs/regenerate.ts
import { existsSync as existsSync13, readFileSync as readFileSync14 } from "fs";
import { join as join17 } from "path";
function buildArtifactForFinding(finding, projectDir, config) {
  const ctx = finding.context;
  if (ctx.code === "STALE_CONTEXT_PACK") {
    return buildContextPackArtifact(projectDir, config, ctx.packageScope);
  }
  if (ctx.code === "STALE_INDEX") {
    return buildIndexArtifact(projectDir, config);
  }
  throw new Error(`Unsupported regenerate finding: ${ctx.code}`);
}
function extractGeneratedBody(content) {
  const startIndex = content.indexOf(GENERATED_START);
  const endIndex = content.indexOf(GENERATED_END);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }
  return content.slice(startIndex + GENERATED_START.length, endIndex).trim();
}
function applyArtifactRepair(finding, projectDir, config) {
  const artifact = buildArtifactForFinding(finding, projectDir, config);
  const relativeOutputPath = finding.filePath;
  const targetPath = join17(projectDir, relativeOutputPath);
  const artifactGeneratedBody = extractGeneratedBody(artifact.content);
  if (existsSync13(targetPath)) {
    const existing = readFileSync14(targetPath, "utf8");
    const nextContent = artifactGeneratedBody === null ? artifact.content : replaceGeneratedBlock(existing, artifactGeneratedBody);
    if (existing === nextContent) {
      return {
        finding,
        status: "skipped",
        reason: "generated content already matches expected output",
        filesModified: []
      };
    }
    safeWriteFile(targetPath, nextContent);
    return { finding, status: "applied", filesModified: [relativeOutputPath] };
  }
  safeWriteFile(targetPath, artifact.content);
  return { finding, status: "applied", filesModified: [relativeOutputPath] };
}
function repairStaleContextPack(finding, projectDir, config) {
  if (finding.context.code !== "STALE_CONTEXT_PACK") {
    return { finding, status: "skipped", reason: "Wrong context type", filesModified: [] };
  }
  return applyArtifactRepair(finding, projectDir, config);
}
function repairStaleIndex(finding, projectDir, config) {
  if (finding.context.code !== "STALE_INDEX") {
    return { finding, status: "skipped", reason: "Wrong context type", filesModified: [] };
  }
  return applyArtifactRepair(finding, projectDir, config);
}

// src/reconcile/repairs/wikilink.ts
import { readFileSync as readFileSync15, writeFileSync as writeFileSync5 } from "fs";
import { join as join18 } from "path";
function escapeForRegex2(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function maskCodeSpans(content) {
  const placeholders = [];
  let masked = content.replace(/^```[\s\S]*?^```/gm, (match) => {
    const idx = placeholders.length;
    placeholders.push(match);
    return `\0CODEBLOCK_${idx}\0`;
  });
  masked = masked.replace(/`[^`]*`/g, (match) => {
    const idx = placeholders.length;
    placeholders.push(match);
    return `\0CODEINLINE_${idx}\0`;
  });
  return {
    masked,
    restore: (s) => s.replace(/\0CODE(?:BLOCK|INLINE)_(\d+)\0/g, (_m, idxStr) => placeholders[Number(idxStr)])
  };
}
function repairBrokenWikilink(finding, projectDir, config) {
  const ctx = finding.context;
  if (ctx.code !== "BROKEN_WIKILINK") {
    return { finding, status: "skipped", reason: "Wrong context type", filesModified: [] };
  }
  if (ctx.candidates.length === 0) {
    return {
      finding,
      status: "skipped",
      reason: `No matching targets found for [[${ctx.target}]]`,
      filesModified: []
    };
  }
  if (ctx.candidates.length > 1) {
    return {
      finding,
      status: "skipped",
      reason: `Ambiguous: ${ctx.candidates.length} matching targets for [[${ctx.target}]] \u2014 ${ctx.candidates.join(", ")}`,
      filesModified: []
    };
  }
  const resolvedTarget = ctx.candidates[0];
  const knowledgeRoot = config.root ?? "Knowledge";
  let replacementTarget = resolvedTarget;
  const rootPrefix = `${knowledgeRoot}/`;
  if (replacementTarget.startsWith(rootPrefix)) {
    replacementTarget = replacementTarget.slice(rootPrefix.length);
  }
  replacementTarget = replacementTarget.replace(/\.md$/, "");
  const absPath = join18(projectDir, finding.filePath);
  let content;
  try {
    content = readFileSync15(absPath, "utf8");
  } catch {
    return { finding, status: "failed", reason: `Cannot read ${finding.filePath}`, filesModified: [] };
  }
  const { masked, restore } = maskCodeSpans(content);
  const escapedTarget = escapeForRegex2(ctx.target);
  const wikilinkPattern = new RegExp(
    `\\[\\[${escapedTarget}((?:\\|[^\\]]*)?\\]\\])`,
    "g"
  );
  const newMasked = masked.replace(wikilinkPattern, `[[${replacementTarget}$1`);
  const newContent = restore(newMasked);
  if (newContent === content) {
    return { finding, status: "skipped", reason: `Wikilink [[${ctx.target}]] not found in file content`, filesModified: [] };
  }
  writeFileSync5(absPath, newContent, "utf8");
  return { finding, status: "applied", filesModified: [finding.filePath] };
}

// src/reconcile/repair-registry.ts
var REPORT_ONLY_CODES = /* @__PURE__ */ new Set([
  "INVALID_FRONTMATTER",
  "FORBIDDEN_WIKILINK",
  "ADR_NUMBERING_GAP",
  "ADR_NUMBERING_DUPLICATE",
  "ADR_MISSING_SECTION",
  "ADR_SUPERSESSION_MISSING_SUCCESSOR",
  "ADR_SUPERSESSION_ASYMMETRIC",
  "ADR_SUPERSEDES_MISSING",
  "ADR_SUPERSEDES_ASYMMETRIC"
]);
var REPAIR_HANDLERS = {
  LEGACY_FRONTMATTER_FIELD: {
    fn: repairLegacyFrontmatterField,
    tier: "auto-fix",
    phase: 2
  },
  BROKEN_WIKILINK: {
    fn: repairBrokenWikilink,
    tier: "auto-fix",
    phase: 3
  },
  MISSING_REQUIRED: {
    fn: repairMissingRequired,
    tier: "needs-approval",
    phase: 4
  },
  ADR_SUPERSESSION_STATUS: {
    fn: repairSupersessionStatus,
    tier: "auto-fix",
    phase: 2
  },
  STALE_CONTEXT_PACK: {
    fn: repairStaleContextPack,
    tier: "needs-approval",
    phase: 1
  },
  STALE_INDEX: {
    fn: repairStaleIndex,
    tier: "needs-approval",
    phase: 1
  },
  FRONTMATTER_STATUS_CASE: {
    fn: repairStatusCase,
    tier: "auto-fix",
    phase: 2
  }
};
function getRepairHandler(code) {
  if (REPORT_ONLY_CODES.has(code)) {
    return null;
  }
  return REPAIR_HANDLERS[code] ?? null;
}

// src/reconcile/executor.ts
async function executeRepairs(findings, projectDir, config, options = {}) {
  const dryRun = options.dryRun ?? false;
  const allowedTiers = /* @__PURE__ */ new Set(["auto-fix"]);
  if (options.approve) {
    allowedTiers.add("needs-approval");
  }
  const orderedFindings = [...findings].sort((left, right) => {
    const leftHandler = getRepairHandler(left.code);
    const rightHandler = getRepairHandler(right.code);
    const leftPhase = leftHandler?.phase ?? Number.MAX_SAFE_INTEGER;
    const rightPhase = rightHandler?.phase ?? Number.MAX_SAFE_INTEGER;
    if (leftPhase !== rightPhase) {
      return leftPhase - rightPhase;
    }
    return left.filePath.localeCompare(right.filePath) || left.code.localeCompare(right.code);
  });
  const results = [];
  for (const finding of orderedFindings) {
    const handler = getRepairHandler(finding.code);
    if (dryRun) {
      results.push({
        finding,
        status: "skipped",
        reason: "dry-run",
        filesModified: []
      });
      continue;
    }
    if (handler === null || finding.tier === "report-only") {
      results.push({
        finding,
        status: "skipped",
        reason: "report-only finding",
        filesModified: []
      });
      continue;
    }
    if (!allowedTiers.has(finding.tier)) {
      results.push({
        finding,
        status: "skipped",
        reason: finding.tier === "needs-approval" ? "requires --approve" : "repair tier not enabled",
        filesModified: []
      });
      continue;
    }
    try {
      const result = await handler.fn(finding, projectDir, config);
      results.push(result);
    } catch (error) {
      results.push({
        finding,
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
        filesModified: []
      });
    }
  }
  updateLockFromResults(results, projectDir);
  return results;
}
function updateLockEntry(existing, nextHash) {
  if (existing.action === "created") {
    return { ...existing, hash: nextHash };
  }
  return { ...existing, blockHash: nextHash };
}
function updateLockFromResults(results, projectDir) {
  const appliedResults = results.filter((result) => result.status === "applied");
  if (appliedResults.length === 0) {
    return;
  }
  const lock = loadLock(projectDir);
  if (!lock) {
    return;
  }
  const updates = [];
  for (const result of appliedResults) {
    for (const filePath of result.filesModified) {
      const existing = lock.files[filePath];
      if (!existing) {
        continue;
      }
      const nextHash = hashString(readFileSync16(join19(projectDir, filePath), "utf8"));
      const nextEntry = updateLockEntry(existing, nextHash);
      lock.files[filePath] = nextEntry;
      updates.push({ filePath, entry: nextEntry });
    }
  }
  if (updates.length === 0) {
    return;
  }
  try {
    for (const update of updates) {
      appendFileEntry(projectDir, lock, update.filePath, update.entry);
    }
    finalizeLock(projectDir);
  } catch (error) {
    cleanupLockTmp(projectDir);
    throw error;
  }
}

// src/reconcile/service.ts
import { writeFileSync as writeFileSync7 } from "fs";
import { join as join21 } from "path";

// src/reconcile/plan.ts
import { writeFileSync as writeFileSync6 } from "fs";
import { join as join20 } from "path";
function generatePlan(findings) {
  const summary = {
    autoFix: findings.filter((f) => f.tier === "auto-fix").length,
    needsApproval: findings.filter((f) => f.tier === "needs-approval").length,
    reportOnly: findings.filter((f) => f.tier === "report-only").length
  };
  return {
    version: getKdocVersion(),
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    findings,
    summary
  };
}

// src/reconcile/service.ts
function toCollectorOptions(scope) {
  if (!scope) return void 0;
  return { area: scope.area, package: scope.package, path: scope.path };
}
async function runReconcileCheck(projectDir, config, scope) {
  const { findings, warnings } = await collectFindings(projectDir, config, toCollectorOptions(scope));
  const plan = generatePlan(findings);
  return { findings, warnings, plan };
}
async function runReconcileFix(projectDir, config, scope, options) {
  const { findings, warnings } = await collectFindings(projectDir, config, toCollectorOptions(scope));
  const execOptions = {
    approve: options?.approve,
    dryRun: options?.dryRun
  };
  const results = await executeRepairs(findings, projectDir, config, execOptions);
  let clean = false;
  if (!options?.dryRun) {
    const { findings: remaining } = await collectFindings(projectDir, config, toCollectorOptions(scope));
    clean = remaining.length === 0;
  }
  const deferredCount = results.filter((r) => r.status === "skipped" && r.reason !== "dry-run").length;
  return { findings, warnings, results, deferredCount, clean };
}
async function runReconcilePlan(projectDir, config, scope, outputPath) {
  const { findings } = await collectFindings(projectDir, config, toCollectorOptions(scope));
  const plan = generatePlan(findings);
  if (outputPath) {
    const resolvedPath = join21(projectDir, outputPath);
    writeFileSync7(resolvedPath, JSON.stringify(plan, null, 2) + "\n", "utf8");
    return { findings, plan, planPath: outputPath };
  }
  return { findings, plan };
}

export {
  hasPendingLockTmp,
  createEmptyLock,
  loadLock,
  writeLock,
  appendFileEntry,
  finalizeLock,
  cleanupLockTmp,
  ensureDir,
  safeWriteFile,
  readFileSafe,
  deleteIfEmpty,
  hashString,
  hashFile,
  slugify,
  renderTemplate,
  getGitOwner,
  resolveScopes,
  resolveScopeForPackage,
  resolveRootScope,
  resolveRenderScopePath,
  buildScopedRenderValues,
  configExists,
  loadConfig,
  writeConfig,
  getKdocVersion,
  loadTemplate,
  createTemplateResolver,
  registerDoctorCommand,
  parseKnowledgeDocs,
  writeKnowledgeJsonl,
  resolveReference,
  resolveDocumentTree,
  assembleBrief,
  buildDependencyGraph,
  getExecutionWaves,
  getCriticalPath,
  getNextUnblocked,
  formatNextAsMarkdown,
  formatNextAsJson,
  parseRoadmap,
  resolveRoadmapStatus,
  resolveNextUnblocked,
  registerGenerateCommand,
  runReconcileCheck,
  runReconcileFix,
  runReconcilePlan
};
//# sourceMappingURL=chunk-HTESMSFS.js.map