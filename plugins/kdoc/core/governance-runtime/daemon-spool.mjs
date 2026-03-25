import { appendFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const SPOOL_PATH = join(homedir(), '.ai-sessions', 'spool', 'events.jsonl');

/**
 * Emit a daemon event by appending a JSONL line to the spool file.
 * Fire-and-forget: never throws, never blocks.
 *
 * @param {string} eventType - e.g. 'kdoc.governance_check', 'kdoc.doc_drift', 'kdoc.artifact_created'
 * @param {object} eventData - Arbitrary event payload
 * @param {string} [repoId] - Optional repository identifier
 * @param {string} [branch] - Optional branch name
 */
export function emitDaemonEvent(eventType, eventData, repoId, branch) {
  try {
    const now = new Date().toISOString();
    const event = {
      event_type: eventType,
      event_data: eventData,
      source: 'mcp:kdoc',
      event_class: 'record',
      created_at: now,
      timestamp: now,
    };
    if (repoId) event.repo_id = repoId;
    if (branch) event.branch = branch;

    const spoolDir = dirname(SPOOL_PATH);
    if (!existsSync(spoolDir)) {
      // Spool directory doesn't exist — silently skip
      return;
    }

    appendFileSync(SPOOL_PATH, JSON.stringify(event) + '\n');
  } catch {
    // Fire-and-forget: swallow all errors
  }
}
