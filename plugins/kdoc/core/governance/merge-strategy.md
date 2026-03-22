# Merge Strategy

kdoc uses named marker pairs to manage sections it injects into existing project files (e.g. `CLAUDE.md`, `AGENTS.md`, `.gitignore`). This document describes how the merge algorithm works.

## Marker Pairs

Each managed block is bounded by named markers:

```markdown
<!-- kdoc:core:start -->
... managed content ...
<!-- kdoc:core:end -->
```

Pack-specific variant:

```markdown
<!-- kdoc:pack:nextjs:start -->
... pack content ...
<!-- kdoc:pack:nextjs:end -->
```

For `.gitignore` (no HTML comments):

```
# kdoc:core:start
... managed entries ...
# kdoc:core:end
```

## Algorithm

| Scenario | Action |
| -------- | ------ |
| No existing block | **Create** — append markers + content at end of file |
| Block exists, unchanged | **Skip** — content matches hash; no write |
| Block exists, kdoc-updated | **Replace** — overwrite block with new content |
| Block exists, user-modified | **Prompt** — ask `[S]kip / [O]verwrite / [D]iff` |
| Block markers corrupted | **Error** — report path and stop |

## Hash Tracking

Each block is tracked by a `blockHash` in `.kdoc.lock`. The hash covers only the injected block content, not the surrounding file. On update:

1. Compute hash of new block content.
2. Compare with stored `blockHash`.
3. If different, check whether current file content matches the old hash (kdoc-managed) or has diverged (user-modified).

## User-Modified Prompt

When a block has been edited outside kdoc:

```
Block modified by user in CLAUDE.md (kdoc:core):
  [S]kip   — keep user changes, skip update
  [O]verwrite — replace with new kdoc content
  [D]iff   — show diff and decide
```

## Force Flag

`kdoc update --force` or `kdoc add --force` skips the prompt and unconditionally overwrites all managed blocks.

## Identifying Managed Blocks

Search the file for marker comments to see which blocks kdoc manages:

```bash
grep -n "kdoc:" CLAUDE.md
```

## Unmanaging a Block

1. Remove the marker comments from the file manually.
2. Run `kdoc undo --block <block-id>` to remove the block entry from `.kdoc.lock`.
3. kdoc will no longer track or update that section.
