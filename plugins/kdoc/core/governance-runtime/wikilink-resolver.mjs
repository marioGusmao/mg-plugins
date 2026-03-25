import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;
const PLACEHOLDER_RE = /\{\{.*?\}\}|<[A-Z][a-z]+>|<note>/;
const FORBIDDEN_RE = /^(\/Users\/|\/home\/|[A-Z]:\\|file:\/\/)/;

/**
 * Resolve wikilinks in a file's content.
 * @param {string} filePath - Absolute path to the source file
 * @param {string} content - File content
 * @param {string} repoPath - Absolute path to project root
 * @returns {{ resolved: string[], broken: string[], forbidden: string[] }}
 */
export function resolveWikilinks(filePath, content, repoPath) {
  const knowledgeRoot = join(repoPath, 'Knowledge');
  const fileDir = dirname(filePath);

  const resolved = [];
  const broken = [];
  const forbidden = [];

  let match;
  while ((match = WIKILINK_RE.exec(content)) !== null) {
    const raw = match[1];
    const target = raw.split('|')[0].split('#')[0].trim();

    if (!target) continue;

    // Skip placeholders
    if (PLACEHOLDER_RE.test(target)) continue;

    // Flag forbidden patterns
    if (FORBIDDEN_RE.test(target)) {
      forbidden.push(target);
      continue;
    }

    // Resolution order:
    // 1. Relative to Knowledge root
    // 2. Relative to current file's directory
    const candidates = [
      join(knowledgeRoot, target),
      join(knowledgeRoot, target + '.md'),
      join(fileDir, target),
      join(fileDir, target + '.md'),
    ];

    const found = candidates.some((c) => existsSync(c));
    if (found) {
      resolved.push(target);
    } else {
      broken.push(target);
    }
  }

  return { resolved, broken, forbidden };
}
