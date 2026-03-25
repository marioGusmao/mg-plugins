import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Check whether CodeGraph is available for a given repo.
 * @param {string} repoPath - Absolute path to project root
 * @returns {{ available: boolean, dbPath?: string, reason?: string }}
 */
export function checkCodegraphAvailable(repoPath) {
  const dbPath = join(repoPath, '.codegraph', 'graph.db');
  if (existsSync(dbPath)) {
    return { available: true, dbPath };
  }
  return { available: false, reason: 'CodeGraph database not found at .codegraph/graph.db' };
}

/**
 * Query CodeGraph for symbol drift — check if documented symbols still exist in code.
 * This is a placeholder that returns degraded results. The real implementation
 * would query the SQLite database or call the CodeGraph MCP server.
 *
 * @param {string} repoPath
 * @param {string[]} docFiles - Paths to documentation files
 * @returns {{ degraded: boolean, reason?: string, results: Array<{doc: string, status: string}> }}
 */
export function queryDrift(repoPath, docFiles) {
  const cgStatus = checkCodegraphAvailable(repoPath);

  if (!cgStatus.available) {
    return {
      degraded: true,
      reason: cgStatus.reason,
      results: docFiles.map((doc) => ({ doc, status: 'unknown' })),
    };
  }

  // When CodeGraph is available but we don't have a direct DB reader,
  // return a degraded result suggesting the MCP server be used instead.
  return {
    degraded: true,
    reason: 'Direct CodeGraph DB queries not yet implemented — use kdoc_reconcile MCP tool',
    results: docFiles.map((doc) => ({ doc, status: 'unchecked' })),
  };
}
