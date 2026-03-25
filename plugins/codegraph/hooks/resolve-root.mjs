/**
 * resolve-root.mjs — Shared project-root resolver for CodeGraph hooks.
 *
 * Prefers CLAUDE_PROJECT_DIR when set and non-empty, otherwise falls back to
 * process.cwd(). Guards against empty-string substitution failures.
 */
import path from 'node:path';

/**
 * Resolve the project root directory.
 * @returns {string} Absolute path to the project root.
 */
export function resolveProjectRoot() {
  const envDir = process.env.CLAUDE_PROJECT_DIR;
  if (envDir && envDir.trim() !== '') {
    return envDir.trim();
  }
  return process.cwd();
}

/**
 * Resolve the plugin root directory.
 * @param {string} hookDir - __dirname of the calling hook
 * @returns {string} Absolute path to the plugin root.
 */
export function resolvePluginRoot(hookDir) {
  const envRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (envRoot && envRoot.trim() !== '') {
    return envRoot.trim();
  }
  return path.resolve(hookDir, '..');
}
