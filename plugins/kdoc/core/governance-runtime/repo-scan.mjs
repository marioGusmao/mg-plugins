import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

/**
 * Recursively collect all .md files under a directory.
 * @param {string} dir
 * @param {string[]} [results]
 * @returns {string[]}
 */
function walkMd(dir, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkMd(full, results);
    } else if (entry.isFile() && extname(entry.name) === '.md') {
      results.push(full);
    }
  }
  return results;
}

/**
 * Scan a repository's Knowledge directory against the structure schema.
 * @param {string} repoPath - Absolute path to project root
 * @param {object} structureSchema - Loaded knowledge-structure.json
 * @param {{ extensionAreas?: Array<{name: string, directory: string, required_files?: string[]}>, knowledgeRoot?: string }} [config]
 * @returns {{ areas: Record<string, {exists: boolean, files: string[], missingRequired: string[]}>, unknownFiles: string[] }}
 */
export function scanRepo(repoPath, structureSchema, config) {
  const knowledgeRoot = join(repoPath, config?.knowledgeRoot ?? 'Knowledge');
  const areas = {};
  const knownPaths = new Set();

  // Scan built-in areas from schema
  for (const [areaKey, areaDef] of Object.entries(structureSchema.areas)) {
    const areaDir = areaDef.directory === '.'
      ? knowledgeRoot
      : join(knowledgeRoot, areaDef.directory);

    const exists = existsSync(areaDir);
    const files = exists ? walkMd(areaDir).map((f) => relative(knowledgeRoot, f)) : [];
    const missingRequired = [];

    for (const req of areaDef.required ?? []) {
      const reqPath = areaDef.directory === '.'
        ? join(knowledgeRoot, req)
        : join(areaDir, req);
      if (!existsSync(reqPath)) {
        missingRequired.push(req);
      }
    }

    // Track known paths for unknown-file detection
    for (const f of files) knownPaths.add(f);

    areas[areaKey] = { exists, files, missingRequired };
  }

  // Scan extension areas from config
  const extensionAreas = config?.extensionAreas ?? [];
  for (const ext of extensionAreas) {
    const areaDir = join(knowledgeRoot, ext.directory);
    const exists = existsSync(areaDir);
    const files = exists ? walkMd(areaDir).map((f) => relative(knowledgeRoot, f)) : [];
    const missingRequired = [];

    for (const req of ext.required_files ?? []) {
      if (!existsSync(join(areaDir, req))) {
        missingRequired.push(req);
      }
    }

    for (const f of files) knownPaths.add(f);

    areas[`ext:${ext.name}`] = { exists, files, missingRequired };
  }

  // Collect unknown files
  const allFiles = existsSync(knowledgeRoot)
    ? walkMd(knowledgeRoot).map((f) => relative(knowledgeRoot, f))
    : [];
  const unknownFiles = allFiles.filter((f) => !knownPaths.has(f));

  return { areas, unknownFiles };
}

/**
 * Read file content safely, returning null on error.
 * @param {string} filePath
 * @returns {string|null}
 */
export function safeReadFile(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Get file modification time in milliseconds, or null.
 * @param {string} filePath
 * @returns {number|null}
 */
export function getFileMtime(filePath) {
  try {
    return statSync(filePath).mtimeMs;
  } catch {
    return null;
  }
}
