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
 * Security note: The git command below is hardcoded with no user-controlled
 * input — there is no injection risk from the bash command string (we only
 * detect a pattern; we do not pass it to any subprocess).
 *
 * Usage: node pre-push-check.mjs "<bash-command-string>"
 */

import { statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

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
 * Get the Unix timestamp (seconds) of the last git commit.
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

/**
 * Get the mtime of a file in milliseconds.
 * Returns null if the file does not exist or cannot be stat'd.
 *
 * @param {string} filePath
 * @returns {number | null}
 */
function getFileMtime(filePath) {
  try {
    return statSync(filePath).mtimeMs;
  } catch {
    return null;
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
  const healthFileMtime = getFileMtime(healthFile);
  const lastCommitTime = getLastCommitTime(projectRoot);

  // If we cannot determine timestamps, exit silently.
  if (healthFileMtime === null || lastCommitTime === null) {
    process.exit(0);
  }

  // Warning condition: health file is older than the last commit.
  // lastCommitTime is in seconds; healthFileMtime is in milliseconds.
  if (healthFileMtime < lastCommitTime * 1000) {
    process.stdout.write(
      [
        '',
        'kdoc: Knowledge governance check not run since last commit.',
        'Consider running: pnpm kdoc:check  (or npx kdoc doctor)',
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
