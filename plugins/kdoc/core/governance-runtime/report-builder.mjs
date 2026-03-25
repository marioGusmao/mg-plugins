import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getReportVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Build a GovernanceReport from scan and validation results.
 *
 * @param {object} scanResult - From repo-scan.mjs scanRepo()
 * @param {Array<{filePath: string, valid: boolean, errors: Array<{path?: string, message: string}>, docType?: string}>} validationResults
 * @param {Array<{filePath: string, resolved: string[], broken: string[], forbidden: string[]}>} wikilinkResults
 * @param {object} [options]
 * @param {string} [options.repoPath]
 * @param {boolean} [options.degraded]
 * @param {string} [options.degradedReason]
 * @returns {object} GovernanceReport
 */
export function buildReport(scanResult, validationResults, wikilinkResults, options) {
  const violations = [];
  let score = 100;

  // Missing required files
  for (const [areaKey, areaData] of Object.entries(scanResult.areas)) {
    for (const missing of areaData.missingRequired) {
      violations.push({
        code: 'MISSING_REQUIRED',
        severity: 'error',
        path: `${areaKey}/${missing}`,
        message: `Required file missing: ${missing}`,
        expected: missing,
        actual: null,
        fix: `Create ${missing} in Knowledge/${areaKey}/`,
      });
      score -= 10;
    }
  }

  // Invalid frontmatter
  for (const vr of validationResults) {
    if (!vr.valid) {
      for (const err of vr.errors) {
        violations.push({
          code: 'INVALID_FRONTMATTER',
          severity: 'error',
          path: vr.filePath,
          message: err.message,
          expected: err.path ?? null,
          actual: null,
          fix: `Fix frontmatter in ${vr.filePath}`,
        });
        score -= 5;
      }
    }
  }

  // Broken wikilinks
  for (const wr of wikilinkResults) {
    for (const broken of wr.broken) {
      violations.push({
        code: 'BROKEN_WIKILINK',
        severity: 'warning',
        path: wr.filePath,
        message: `Broken wikilink: [[${broken}]]`,
        expected: broken,
        actual: null,
        fix: `Fix or remove [[${broken}]] in ${wr.filePath}`,
      });
      score -= 3;
    }
    for (const forbidden of wr.forbidden) {
      violations.push({
        code: 'FORBIDDEN_WIKILINK',
        severity: 'error',
        path: wr.filePath,
        message: `Forbidden wikilink pattern: [[${forbidden}]]`,
        expected: 'relative path',
        actual: forbidden,
        fix: `Replace absolute path with relative path in ${wr.filePath}`,
      });
      score -= 5;
    }
  }

  // Coverage by area
  const coverage = { byArea: {}, byType: {} };
  for (const [areaKey, areaData] of Object.entries(scanResult.areas)) {
    coverage.byArea[areaKey] = {
      exists: areaData.exists,
      fileCount: areaData.files.length,
      missingRequired: areaData.missingRequired.length,
    };
  }

  // Coverage by type
  for (const vr of validationResults) {
    if (vr.docType) {
      if (!coverage.byType[vr.docType]) {
        coverage.byType[vr.docType] = { total: 0, valid: 0, invalid: 0 };
      }
      coverage.byType[vr.docType].total++;
      if (vr.valid) {
        coverage.byType[vr.docType].valid++;
      } else {
        coverage.byType[vr.docType].invalid++;
      }
    }
  }

  // Suggestions
  const suggestions = [];
  for (const [areaKey, areaData] of Object.entries(scanResult.areas)) {
    if (!areaData.exists) {
      suggestions.push({
        type: 'create_area',
        path: areaKey,
        reason: `Knowledge area "${areaKey}" has no directory`,
        priority: 'low',
      });
    }
  }
  if (scanResult.unknownFiles.length > 0) {
    suggestions.push({
      type: 'review_unknown',
      path: scanResult.unknownFiles.join(', '),
      reason: `${scanResult.unknownFiles.length} file(s) not mapped to any known area`,
      priority: 'medium',
    });
  }

  // Clamp score to 0–100
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return {
    version: getReportVersion(),
    repoPath: options?.repoPath ?? '',
    generatedAt: new Date().toISOString(),
    healthScore: score,
    violations,
    coverage,
    staleness: [],
    suggestions,
    degraded: options?.degraded ?? false,
    degradedReason: options?.degradedReason ?? undefined,
  };
}
