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

export { loadSchemas, clearSchemaCache } from './governance-runtime/schema-loader.mjs';
export { validateFrontmatter, detectDocType, parseFrontmatter, buildZodSchema } from './governance-runtime/frontmatter.mjs';
export { scanRepo } from './governance-runtime/repo-scan.mjs';
export { resolveWikilinks } from './governance-runtime/wikilink-resolver.mjs';
export { buildReport } from './governance-runtime/report-builder.mjs';
export { checkCodegraphAvailable, queryDrift } from './governance-runtime/codegraph-bridge.mjs';
export { emitDaemonEvent } from './governance-runtime/daemon-spool.mjs';

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
