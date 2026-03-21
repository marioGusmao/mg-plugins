---
name: kdoc:governance-check
description: Run all kdoc validation scripts and report Knowledge health. Use when the user asks for a Knowledge audit, health check, or before pushing changes that affect Knowledge files.
metadata:
  filePattern: "Knowledge/**/*.md"
  bashPattern: "kdoc doctor|kdoc:check|kdoc:governance"
---

# kdoc:governance-check — Knowledge Health Check

Use this skill when the user asks to check Knowledge health, run governance validation, or diagnose Knowledge issues.

## When to Use

- "check knowledge" / "kdoc doctor" / "run governance check"
- Before pushing changes that modify Knowledge files
- After adding a new area or pack
- When wikilink or ADR errors are suspected

## Workflow

1. Run the primary health check: `npx kdoc doctor`
   - Reports: config validity, structure completeness, script freshness, integration markers, governance.
   - Exit codes: 0 = all pass, 1 = failures, 2 = config error.

2. If the project has Python governance scripts installed, run them directly:
   - `python3 scripts/kdoc/check_sync.py` — Knowledge sync check
   - `python3 scripts/kdoc/check_wikilinks.py` — wikilink integrity
   - `python3 scripts/kdoc/check_adr_governance.py` — ADR governance
   Note: There are no `kdoc:check` or `kdoc:governance` npm scripts. Use `npx kdoc doctor` or run the Python scripts directly.

3. If `governance_health.py` is available, run: `python3 scripts/kdoc/governance_health.py`
   - This produces a consolidated governance report.

4. Interpret and surface:
   - PASS items: summarize count only.
   - WARN items: list each with suggested fix.
   - FAIL items: list each with required action and the relevant `fix` command from JSON output.

5. If `--json` output is available, parse it for structured reporting; otherwise parse stdout.

## Interpreting Results

| Status | Action |
|--------|--------|
| `pass` | No action needed |
| `warn` | Inform user; suggest fix but do not block |
| `fail` | Report as blocking; provide `fix` command |

## Common Failures and Fixes

| Failure | Fix |
|---------|-----|
| ADR numbering gap | Rename files to fill gap or accept gap (gaps are allowed) |
| Broken wikilink | Find and fix the `[[TARGET]]` reference |
| Missing TLDR for module | `kdoc:tldr-create` for that module |
| INDEX.md stale | `pnpm kdoc:index` or `npx kdoc doctor` will suggest |
| CLAUDE.md missing kdoc block | `npx kdoc add-tool claude-code` |

## Related Skills

- `kdoc:scaffold` — if structure is missing, scaffold it
- `kdoc:adr-validate` — focused ADR governance check
- `kdoc:tldr-update-status` — if TLDRs have stale status
