---
version: "1.0.0"
date: "2026-03-24"
summary: "Defines wikilink syntax, resolution rules, and forbidden patterns for Knowledge files."
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

## Resolution Rules

1. If the first path segment matches a known Knowledge subdirectory (e.g. `TLDR`, `ADR`, `Roadmap`), the link resolves relative to the Knowledge root.
2. If no segment match is found, the validator tries the Knowledge root directly.
3. Final fallback: resolve relative to the current file's directory.

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
