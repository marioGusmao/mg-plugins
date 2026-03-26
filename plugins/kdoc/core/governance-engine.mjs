/**
 * kdoc Governance Engine — public facade.
 *
 * Schema-driven runtime that reads knowledge-structure.json and
 * frontmatter-schemas.json as sole sources of truth to validate
 * Knowledge documentation structures.
 */

import { loadSchemas, clearSchemaCache } from './governance-runtime/schema-loader.mjs';
import { validateFrontmatter, detectDocType, parseFrontmatter } from './governance-runtime/frontmatter.mjs';
import { scanRepo, safeReadFile } from './governance-runtime/repo-scan.mjs';
import { resolveWikilinks } from './governance-runtime/wikilink-resolver.mjs';
import { buildReport } from './governance-runtime/report-builder.mjs';
import { checkCodegraphAvailable, queryDrift } from './governance-runtime/codegraph-bridge.mjs';
import { emitDaemonEvent } from './governance-runtime/daemon-spool.mjs';
import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';

export { loadSchemas, clearSchemaCache } from './governance-runtime/schema-loader.mjs';
export { validateFrontmatter, detectDocType, parseFrontmatter, buildZodSchema } from './governance-runtime/frontmatter.mjs';
export { scanRepo } from './governance-runtime/repo-scan.mjs';
export { resolveWikilinks } from './governance-runtime/wikilink-resolver.mjs';
export { buildReport } from './governance-runtime/report-builder.mjs';
export { checkCodegraphAvailable, queryDrift } from './governance-runtime/codegraph-bridge.mjs';
export { emitDaemonEvent } from './governance-runtime/daemon-spool.mjs';

function extractFrontmatterValue(content, key) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return null;
  const pattern = new RegExp(`^${key}:\\s*(.*)$`, 'm');
  const fieldMatch = match[1].match(pattern);
  if (!fieldMatch) return null;

  const raw = fieldMatch[1].trim();
  if (!raw || raw === '""' || raw === "''") return null;
  return raw.replace(/^["']|["']$/g, '').trim() || null;
}

function extractFrontmatterValueWithLegacy(content, keys) {
  for (const key of keys) {
    const value = extractFrontmatterValue(content, key);
    if (value !== null) return value;
  }

  return null;
}

function normalizeAdrRef(value) {
  if (!value) return null;
  const match = value.trim().match(/^ADR-(\d{1,4})$/i);
  if (!match) return null;
  return `ADR-${match[1].padStart(4, '0')}`;
}

function listMarkdownFilesRecursive(dir) {
  if (!existsSync(dir)) return [];

  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listMarkdownFilesRecursive(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

function collectLegacyFrontmatterViolations(knowledgeRoot, repoPath) {
  const legacyFields = [
    { legacy: 'superseded_by', canonical: 'superseded-by' },
    { legacy: 'security_tier', canonical: 'security-tier' },
  ];
  const violations = [];

  for (const filePath of listMarkdownFilesRecursive(knowledgeRoot)) {
    const content = safeReadFile(filePath) ?? '';
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!frontmatterMatch) continue;

    for (const field of legacyFields) {
      const pattern = new RegExp(`^${field.legacy}:\\s*`, 'm');
      if (!pattern.test(frontmatterMatch[1])) continue;
      const relativePath = filePath.startsWith(`${repoPath}/`)
        ? filePath.slice(repoPath.length + 1)
        : filePath;
      violations.push({
        code: 'LEGACY_FRONTMATTER_FIELD',
        severity: 'warning',
        path: relativePath,
        message: `${relativePath} uses legacy "${field.legacy}". Prefer "${field.canonical}".`,
      });
    }
  }

  return violations;
}

function loadAdrRecords(adrDir) {
  if (!existsSync(adrDir)) return [];

  return readdirSync(adrDir)
    .filter((entry) => /^ADR-\d{4}-.+\.md$/.test(entry))
    .map((entry) => {
      const fullPath = join(adrDir, entry);
      const content = safeReadFile(fullPath) ?? '';
      const numberMatch = entry.match(/^ADR-(\d{4})-/);
      const number = parseInt(numberMatch?.[1] ?? '0', 10);
      const id = `ADR-${String(number).padStart(4, '0')}`;
      const supersededByField = extractFrontmatterValueWithLegacy(content, ['superseded-by', 'superseded_by']);

      return {
        id,
        number,
        path: fullPath,
        status: extractFrontmatterValue(content, 'status') ?? '',
        supersededBy: normalizeAdrRef(supersededByField),
        supersedes: normalizeAdrRef(extractFrontmatterValue(content, 'supersedes')),
      };
    })
    .filter((record) => record.number > 0);
}

function collectAdrGovernanceViolations(repoPath, knowledgeRootName) {
  const adrDir = join(repoPath, knowledgeRootName, 'ADR');
  const adrRecords = loadAdrRecords(adrDir);
  const violations = [];

  if (adrRecords.length === 0) {
    return violations;
  }

  const sortedNumbers = [...new Set(adrRecords.map((record) => record.number))].sort((a, b) => a - b);
  for (let i = 1; i < sortedNumbers.length; i += 1) {
    if (sortedNumbers[i] !== sortedNumbers[i - 1] + 1) {
      violations.push({
        code: 'ADR_NUMBERING_GAP',
        severity: 'warning',
        path: 'Knowledge/ADR',
        message: `ADR numbering gaps detected: ${String(sortedNumbers[i - 1]).padStart(4, '0')} -> ${String(sortedNumbers[i]).padStart(4, '0')}`,
      });
    }
  }

  const duplicates = new Map();
  for (const record of adrRecords) {
    duplicates.set(record.number, [...(duplicates.get(record.number) ?? []), record.path]);
  }
  for (const [number, paths] of duplicates.entries()) {
    if (paths.length < 2) continue;
    violations.push({
      code: 'ADR_NUMBERING_DUPLICATE',
      severity: 'error',
      path: 'Knowledge/ADR',
      message: `Duplicate ADR numbers found: ADR-${String(number).padStart(4, '0')}`,
    });
  }

  const recordsById = new Map(adrRecords.map((record) => [record.id, record]));
  for (const record of adrRecords) {
    if (record.supersededBy) {
      const successor = recordsById.get(record.supersededBy);
      if (!successor) {
        violations.push({
          code: 'ADR_SUPERSESSION_MISSING_SUCCESSOR',
          severity: 'error',
          path: record.path,
          message: `${record.id} points to missing successor ${record.supersededBy}`,
        });
      } else if (successor.supersedes !== record.id) {
        violations.push({
          code: 'ADR_SUPERSESSION_ASYMMETRIC',
          severity: 'error',
          path: record.path,
          message: `${record.id} is superseded by ${record.supersededBy}, but ${record.supersededBy} does not declare supersedes: ${record.id}`,
        });
      }

      if (record.status !== 'superseded') {
        violations.push({
          code: 'ADR_SUPERSESSION_STATUS',
          severity: 'warning',
          path: record.path,
          message: `${record.id} has superseded_by set but status is "${record.status || 'missing'}"`,
        });
      }
    }

    if (record.supersedes) {
      const original = recordsById.get(record.supersedes);
      if (!original) {
        violations.push({
          code: 'ADR_SUPERSEDES_MISSING',
          severity: 'error',
          path: record.path,
          message: `${record.id} supersedes missing ADR ${record.supersedes}`,
        });
      } else if (original.supersededBy !== record.id) {
        violations.push({
          code: 'ADR_SUPERSEDES_ASYMMETRIC',
          severity: 'error',
          path: record.path,
          message: `${record.id} declares supersedes: ${record.supersedes}, but ${record.supersedes} does not set superseded_by: ${record.id}`,
        });
      }
    }
  }

  return violations;
}

/**
 * Run a full governance check on a repository.
 *
 * @param {string} repoPath - Absolute path to project root
 * @param {object} [options]
 * @param {object} [options.schemas] - Pre-loaded schemas (skips loading)
 * @param {boolean} [options.codegraph] - Include CodeGraph analysis (default: false)
 * @param {boolean} [options.emit] - Emit daemon event (default: false)
 * @param {string[]} [options.paths] - Limit scan to specific paths
 * @param {Array} [options.extensionAreas] - Extension area definitions from config
 * @returns {object} GovernanceReport
 */
export function runGovernance(repoPath, options) {
  const schemas = options?.schemas ?? loadSchemas();

  const knowledgeRootName = options?.knowledgeRoot ?? 'Knowledge';

  // Scan repository structure
  const scanResult = scanRepo(repoPath, schemas.structure, {
    extensionAreas: options?.extensionAreas,
    knowledgeRoot: knowledgeRootName,
  });

  // Validate frontmatter for all discovered files
  const knowledgeRoot = join(repoPath, knowledgeRootName);
  const validationResults = [];
  const wikilinkResults = [];

  for (const [_areaKey, areaData] of Object.entries(scanResult.areas)) {
    for (const relPath of areaData.files) {
      const absPath = join(knowledgeRoot, relPath);
      const content = safeReadFile(absPath);
      if (!content) continue;

      // Detect type and validate
      const docType = detectDocType(content);
      if (docType) {
        const vResult = validateFrontmatter(content, docType, schemas);
        validationResults.push({
          filePath: relPath,
          valid: vResult.valid,
          errors: vResult.errors,
          docType,
        });
      }

      // Resolve wikilinks
      const wResult = resolveWikilinks(absPath, content, repoPath);
      if (wResult.broken.length > 0 || wResult.forbidden.length > 0) {
        wikilinkResults.push({ filePath: relPath, ...wResult });
      }
    }
  }

  // Check CodeGraph if requested
  let degraded = false;
  let degradedReason;
  if (options?.codegraph) {
    const cgStatus = checkCodegraphAvailable(repoPath);
    if (!cgStatus.available) {
      degraded = true;
      degradedReason = cgStatus.reason;
    }
  }

  // Build report
  const report = buildReport(scanResult, validationResults, wikilinkResults, {
    repoPath,
    degraded,
    degradedReason,
  });
  const governanceViolations = [
    ...collectLegacyFrontmatterViolations(knowledgeRoot, repoPath),
    ...collectAdrGovernanceViolations(repoPath, knowledgeRootName),
  ];
  if (governanceViolations.length > 0) {
    report.violations.push(...governanceViolations);
    const scorePenalty = governanceViolations.reduce(
      (total, violation) => total + (violation.severity === 'error' ? 5 : 2),
      0,
    );
    report.healthScore = Math.max(0, report.healthScore - scorePenalty);
  }

  // Emit daemon event if requested
  if (options?.emit) {
    emitDaemonEvent('kdoc.governance_check', {
      healthScore: report.healthScore,
      violationCount: report.violations.length,
    });
  }

  return report;
}

/**
 * Validate a single file's frontmatter.
 *
 * @param {string} filePath - Absolute path to file
 * @param {object} [schemas] - Pre-loaded schemas (loads if omitted)
 * @returns {{ valid: boolean, errors: Array<{path?: string, message: string}>, parsed: object|null, docType: string|null }}
 */
export function validateFile(filePath, schemas) {
  const s = schemas ?? loadSchemas();
  const content = safeReadFile(filePath);
  if (!content) {
    return { valid: false, errors: [{ message: `Cannot read file: ${filePath}` }], parsed: null, docType: null };
  }

  const docType = detectDocType(content);
  if (!docType) {
    return { valid: false, errors: [{ message: 'No "type" field in frontmatter' }], parsed: null, docType: null };
  }

  const result = validateFrontmatter(content, docType, s);
  return { ...result, docType };
}

/**
 * Get documentation coverage metrics for a repository.
 *
 * @param {string} repoPath - Absolute path to project root
 * @param {string[]} [paths] - Limit to specific paths
 * @param {object} [schemas] - Pre-loaded schemas
 * @returns {object} Coverage metrics
 */
export function getCoverage(repoPath, paths, schemas, options) {
  const s = schemas ?? loadSchemas();
  const scanResult = scanRepo(repoPath, s.structure, {
    extensionAreas: options?.extensionAreas,
    knowledgeRoot: options?.knowledgeRoot,
  });

  const coverage = { byArea: {} };
  for (const [areaKey, areaData] of Object.entries(scanResult.areas)) {
    // If paths filter is provided, only include areas that match
    if (paths && paths.length > 0) {
      const hasMatch = areaData.files.some((f) => paths.some((p) => f.startsWith(p)));
      if (!hasMatch) continue;
    }

    coverage.byArea[areaKey] = {
      exists: areaData.exists,
      fileCount: areaData.files.length,
      missingRequired: areaData.missingRequired.length,
      complete: areaData.missingRequired.length === 0 && areaData.exists,
    };
  }

  return coverage;
}
