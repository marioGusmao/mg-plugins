import { existsSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;
const PLACEHOLDER_RE = /\{\{.*?\}\}|<[A-Za-z][a-z]+>|<note>/;
const FORBIDDEN_RE = /^(\/Users\/|\/home\/|[A-Z]:\\|file:\/\/)/;
const PACKAGE_TARGET_RE = /^packages\/([^/]+)\/(.+)$/;
const INLINE_CODE_SPAN_RE = /`[^`]*`/g;
const FENCED_CODE_RE = /^```/;

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
 * Join multiline wikilinks into single lines.
 * A wikilink that spans lines (e.g. `[[ADR-0001-some-\nlong-title]]`)
 * is collapsed so the line-by-line scanner can match it.
 * Uses non-greedy matching to avoid cross-bracket greediness.
 * Whitespace around newlines is stripped entirely — wikilink targets
 * are paths and should not gain extra spaces from line wrapping.
 */
function collapseMultilineWikilinks(content) {
  return content.replace(
    /\[\[([^\]]*?(?:\n[^\]]*?)*?)\]\]/g,
    (match) => match.replace(/\s*\n\s*/g, ''),
  );
}

/**
 * Build resolution candidates for a wikilink target.
 * @param {string} filePath - Absolute path to the source file
 * @param {string} target - The wikilink target text
 * @param {string} repoPath - Absolute path to project root
 * @returns {{ candidates: string[], ambiguous: boolean }}
 */
export function collectWikilinkCandidates(filePath, target, repoPath) {
  const knowledgeRoot = join(repoPath, 'Knowledge');
  const packageKnowledgeRoot = getPackageKnowledgeRoot(filePath, repoPath);
  const fileDir = dirname(filePath);

  const candidates = [];
  const seen = new Set();

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

  const resolvedRepo = resolve(repoPath);
  const repoPrefix = resolvedRepo + sep;
  const safeCandidates = candidates.filter((c) => {
    const resolvedCandidate = resolve(c);
    return resolvedCandidate === resolvedRepo || resolvedCandidate.startsWith(repoPrefix);
  });

  const existing = safeCandidates.filter((c) => existsSync(c)).sort();
  return {
    candidates: existing,
    ambiguous: existing.length > 1,
  };
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

  // Collapse multiline wikilinks before line-by-line scanning (PRE-3 fix)
  const normalizedContent = collapseMultilineWikilinks(content);

  let inFencedBlock = false;
  for (const line of normalizedContent.split(/\r?\n/)) {
    if (FENCED_CODE_RE.test(line)) {
      inFencedBlock = !inFencedBlock;
      continue;
    }
    if (inFencedBlock) continue;
    const scanLine = line.replace(INLINE_CODE_SPAN_RE, '');
    WIKILINK_RE.lastIndex = 0;

    let match;
    while ((match = WIKILINK_RE.exec(scanLine)) !== null) {
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
  }

  return {
    resolved: [...new Set(resolved)],
    broken: [...new Set(broken)],
    forbidden: [...new Set(forbidden)],
  };
}
