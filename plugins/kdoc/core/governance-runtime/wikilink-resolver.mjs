import { existsSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;
const PLACEHOLDER_RE = /\{\{.*?\}\}|<[A-Z][a-z]+>|<note>/;
const FORBIDDEN_RE = /^(\/Users\/|\/home\/|[A-Z]:\\|file:\/\/)/;
const PACKAGE_TARGET_RE = /^packages\/([^/]+)\/(.+)$/;

function pushMarkdownCandidates(candidates, seen, basePath) {
  for (const candidate of [basePath, `${basePath}.md`]) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    candidates.push(candidate);
  }
}

function getPackageKnowledgeRoot(filePath, repoPath) {
  const segments = relative(repoPath, filePath).split(/[\\/]/);
  if (segments[0] === 'packages' && segments[2] === 'Knowledge') {
    return join(repoPath, 'packages', segments[1], 'Knowledge');
  }

  return null;
}

/**
 * Resolve wikilinks in a file's content.
 * @param {string} filePath - Absolute path to the source file
 * @param {string} content - File content
 * @param {string} repoPath - Absolute path to project root
 * @returns {{ resolved: string[], broken: string[], forbidden: string[] }}
 */
export function resolveWikilinks(filePath, content, repoPath) {
  const knowledgeRoot = join(repoPath, 'Knowledge');
  const packageKnowledgeRoot = getPackageKnowledgeRoot(filePath, repoPath);
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

    const candidates = [];
    const seen = new Set();

    // Resolution order:
    // 1. Relative to repository Knowledge root
    // 2. Relative to repository root
    // 3. Relative to package Knowledge root (current package or explicit packages/<pkg>/...)
    // 4. Relative to current file's directory
    pushMarkdownCandidates(candidates, seen, join(knowledgeRoot, target));
    pushMarkdownCandidates(candidates, seen, join(repoPath, target));

    const packageTargetMatch = target.match(PACKAGE_TARGET_RE);
    if (packageTargetMatch) {
      const [, packageName, packageRelativeTarget] = packageTargetMatch;
      if (!packageRelativeTarget.startsWith('Knowledge/')) {
        pushMarkdownCandidates(
          candidates,
          seen,
          join(repoPath, 'packages', packageName, 'Knowledge', packageRelativeTarget),
        );
      }
    }

    if (packageKnowledgeRoot) {
      pushMarkdownCandidates(candidates, seen, join(packageKnowledgeRoot, target));
    }

    pushMarkdownCandidates(candidates, seen, join(fileDir, target));

    // Filter out candidates that escape the repo root (path traversal protection)
    // Append platform separator to prevent sibling directory matches (e.g. /tmp/repo-evil matching /tmp/repo)
    const resolvedRepo = resolve(repoPath);
    const repoPrefix = resolvedRepo + sep;
    const safeCandidates = candidates.filter((c) => {
      const resolvedCandidate = resolve(c);
      return resolvedCandidate === resolvedRepo || resolvedCandidate.startsWith(repoPrefix);
    });
    const found = safeCandidates.some((c) => existsSync(c));
    if (found) {
      resolved.push(target);
    } else {
      broken.push(target);
    }
  }

  return { resolved, broken, forbidden };
}
