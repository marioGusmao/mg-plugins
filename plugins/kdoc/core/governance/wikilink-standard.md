---
version: "1.1.0"
date: "2026-03-26"
summary: "Defines wikilink syntax, canonical formats, resolution rules, and forbidden patterns for Knowledge files."
---

# Wikilink Standard

Wikilinks provide portable internal cross-references in Knowledge files. This document covers syntax, resolution rules, and forbidden patterns.

## Syntax

```
[[path/to/file]]                    # bare link
[[path/to/file|Display Text]]       # with display text
[[path/to/file#section]]            # with section anchor
[[path/to/file#section|Text]]       # combined
```

The `.md` extension is optional — the validator normalizes both forms.

## Canonical Formats

Prefer the shortest portable form that still identifies the target unambiguously:

1. Knowledge-relative links for repository-root Knowledge content:

   ```markdown
   [[ADR/ADR-0001-decision]]
   [[TLDR/Shop/cart]]
   ```

2. Root-relative links when you need to point at an explicit repo path:

   ```markdown
   [[Knowledge/ADR/ADR-0001-decision]]
   [[packages/codegraph/Knowledge/TLDR/indexer-pipeline]]
   ```

3. Package-scoped links for package Knowledge content:

   ```markdown
   [[packages/codegraph/TLDR/indexer-pipeline]]
   [[packages/router-plugin/ADR/ADR-0003-contract]]
   ```

Within `packages/<pkg>/Knowledge/**`, local package links may also omit the package prefix:

```markdown
[[TLDR/indexer-pipeline]]
[[ADR/ADR-0003-contract]]
```

Use the explicit `packages/<pkg>/...` form when linking across packages.

## Resolution Rules

1. Resolve relative to the repository Knowledge root (`<repo>/Knowledge/...`).
2. Resolve relative to the repository root (`<repo>/...`).
3. Resolve relative to a package Knowledge root:
   - for explicit `packages/<pkg>/...` targets, try `<repo>/packages/<pkg>/Knowledge/...`
   - for files already inside `packages/<pkg>/Knowledge/**`, try that package's Knowledge root
4. Final fallback: resolve relative to the current file's directory.

## Placeholder / Example Links

Links containing `<...>` or `{{...}}` are treated as examples and are exempt from validation:

```
[[TLDR/<Area>/<note>]]         # exempt — placeholder syntax
[[TLDR/{{Area}}/{{feature}}]]  # exempt — template placeholder
```

## Forbidden Patterns

The following patterns are detected and reported as errors:

| Pattern | Example | Reason |
| ------- | ------- | ------ |
| Local absolute path (Unix) | `[[/Users/alice/project/README.md]]` | Machine-specific; breaks portability |
| Local absolute path (Windows) | `[[C:\Users\alice\file.md]]` | Machine-specific; breaks portability |
| `file://` URL | `[[file:///home/alice/file.md]]` | Not portable |

## Escaped Pipes in Tables

Inside markdown tables, use `\|` to escape the pipe character:

```markdown
| Link | `[[path/to/file\|Display Text]]` |
```

Both `|` and `\|` are recognized by the validator.

## Fixing Broken Wikilinks

1. Check that the target file exists at the expected path.
2. Check casing — wikilinks are case-sensitive on most file systems.
3. Run `kdoc:check:wikilinks` to see all broken links with suggested matches.
4. The validator provides fuzzy-match suggestions when a close filename is found.

## Validation

Run `kdoc:check:wikilinks` (or `python3 core/scripts/check_wikilinks.py`) to validate all wikilinks in the Knowledge directory.
