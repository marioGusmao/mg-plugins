#!/usr/bin/env node
/**
 * kdoc PreToolUse hook — pre-push governance reminder
 *
 * Fires before any Bash tool call when Claude Code executes bash commands.
 * Checks if a `git push` is about to happen and warns if kdoc:check has not
 * been run since the last commit.
 *
 * Behaviors:
 * - Non-push commands: exit 0 silently.
 * - No .kdoc.yaml in project: exit 0 silently.
 * - git push detected + governance-health.md is stale: output warning.
 * - git push detected + governance-health.md is fresh: exit 0 silently.
 * - All errors (git unavailable, no commits, missing files): exit 0 silently.
 * - Exit code is ALWAYS 0 — this is a reminder, not a block.
 *
 * Note: This hook fires when Claude uses the Bash tool to run `git push`.
 * It does NOT fire when the user pushes from a terminal. Terminal coverage
 * requires a separate git pre-push hook (documented in project guides).
 *
 * Security note: The git commands below are hardcoded with no user-controlled
 * input — there is no injection risk from the bash command string (we only
 * detect a pattern; we do not pass it to any subprocess).
 *
 * Usage: node pre-push-check.mjs "<bash-command-string>"
 */

import { existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

const SPOOL_DIR = join(homedir(), '.ai-sessions', 'spool');
const SPOOL_FILE = join(SPOOL_DIR, 'events.jsonl');

/**
 * Detect whether the given bash command is a git push.
 * Matches: git push, git push origin main, git push --force, etc.
 *
 * @param {string} cmd
 * @returns {boolean}
 */
function isGitPush(cmd) {
  return /\bgit\s+push\b/.test(cmd);
}

/**
 * Get the Unix timestamp (seconds) of the last git commit that touched a
 * specific file. Uses spawnSync with a fixed argument list — no user input
 * is passed. Returns null if git is unavailable, the file has never been
 * committed, or there are no commits.
 *
 * @param {string} cwd
 * @param {string} filePath
 * @returns {number | null}
 */
function getLastCommitTimeForFile(cwd, filePath) {
  try {
    // Hardcoded command and args — no injection risk.
    const result = spawnSync('git', ['log', '-1', '--format=%ct', '--', filePath], {
      cwd,
      encoding: 'utf8',
      timeout: 5000,
    });
    if (result.status !== 0 || !result.stdout) return null;
    const ts = parseInt(result.stdout.trim(), 10);
    return isNaN(ts) ? null : ts;
  } catch {
    return null;
  }
}

/**
 * Get the Unix timestamp (seconds) of the most recent git commit overall.
 * Uses spawnSync with a fixed argument list — no user input is passed.
 * Returns null if git is unavailable or there are no commits.
 *
 * @param {string} cwd
 * @returns {number | null}
 */
function getLastCommitTime(cwd) {
  try {
    // Hardcoded command and args — no injection risk.
    const result = spawnSync('git', ['log', '-1', '--format=%ct'], {
      cwd,
      encoding: 'utf8',
      timeout: 5000,
    });
    if (result.status !== 0 || !result.stdout) return null;
    const ts = parseInt(result.stdout.trim(), 10);
    return isNaN(ts) ? null : ts;
  } catch {
    return null;
  }
}

function emitGovernanceCheckEvent(eventData) {
  try {
    if (!existsSync(SPOOL_DIR)) {
      return;
    }

    const now = new Date().toISOString();
    appendFileSync(
      SPOOL_FILE,
      JSON.stringify({
        event_type: 'kdoc.governance_check',
        event_data: eventData,
        source: 'hook:kdoc-pre-push',
        event_class: 'record',
        created_at: now,
        timestamp: now,
      }) + '\n',
    );
  } catch {
    // Fire-and-forget: swallow all errors
  }
}

function main() {
  const cmd = process.argv[2] ?? '';

  // Non-push command: exit silently.
  if (!isGitPush(cmd)) {
    process.exit(0);
  }

  const projectRoot = process.env.CLAUDE_PROJECT_ROOT ?? process.cwd();
  const configPath = join(projectRoot, '.kdoc.yaml');

  // No .kdoc.yaml: project does not use kdoc, exit silently.
  if (!existsSync(configPath)) {
    process.exit(0);
  }

  const healthFile = join(projectRoot, 'Knowledge', 'governance-health.md');
  const healthFileCommitTime = getLastCommitTimeForFile(projectRoot, healthFile);
  const lastCommitTime = getLastCommitTime(projectRoot);

  // If we cannot determine timestamps, exit silently.
  if (healthFileCommitTime === null || lastCommitTime === null) {
    process.exit(0);
  }

  const isStale = healthFileCommitTime < lastCommitTime;
  emitGovernanceCheckEvent({
    command: cmd,
    project_root: projectRoot,
    governance_file: 'Knowledge/governance-health.md',
    result: isStale ? 'stale' : 'fresh',
    stale: isStale,
    health_file_commit_time: healthFileCommitTime,
    last_commit_time: lastCommitTime,
  });

  // Warning condition: the health file's last commit is older than the
  // repository's latest commit, meaning something changed after the last
  // governance check was committed.
  if (isStale) {
    process.stdout.write(
      [
        '',
        'kdoc: Knowledge governance check not run since last commit.',
        'Consider running: kdoc doctor  (or npx kdoc doctor)',
        'This ensures Knowledge docs are in sync before pushing.',
        '',
      ].join('\n')
    );
  }

  // Always exit 0 — this is advisory, not a block.
  process.exit(0);
}

try {
  main();
} catch {
  // Suppress all errors — hook failure must not disrupt the push.
  process.exit(0);
}
