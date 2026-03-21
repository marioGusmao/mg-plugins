---
name: kdoc:adr-validate
description: Validate all ADRs for numbering integrity, cross-references, supersession chains, and status lifecycle. Use when suspecting ADR numbering issues or before a PR review.
metadata:
  filePattern: "Knowledge/ADR/ADR-*.md"
  bashPattern: "kdoc:adr:check|check_adr_governance"
---

# kdoc:adr-validate — Validate ADR Governance

Use this skill when the user asks to validate ADRs, check ADR numbering, or audit the ADR directory.

## When to Use

- "validate ADRs" / "check ADR governance" / "audit ADR directory"
- After creating or modifying ADRs
- Before a PR that includes ADR changes

## Workflow

1. Run the ADR governance script if available:
   ```bash
   npx kdoc doctor
   ```
   Note: There is no separate `kdoc:adr:check` script. Use `npx kdoc doctor` which includes ADR governance checks, or fall back to `python3 scripts/kdoc/check_adr_governance.py` if the Python scripts are installed.

2. If the script is not installed, perform manual checks:

   **Numbering integrity:**
   - Glob `Knowledge/ADR/ADR-*.md` and sort.
   - Extract NNNN from each filename.
   - Verify no duplicates (same number, different slug).
   - Report gaps (non-sequential numbers) — gaps are allowed but should be noted.

   **Frontmatter completeness:**
   - Each ADR must have: `id`, `title`, `date`, `status`.
   - `id` in frontmatter must match the filename NNNN.

   **Status validity:**
   - Valid statuses: `proposed`, `accepted`, `rejected`, `superseded`.
   - If status is `superseded`, the file should reference the superseding ADR.

   **Supersession chain integrity:**
   - If ADR-X says `supersedes: ADR-Y`, then ADR-Y must exist and its status should be `superseded`.
   - No circular supersession chains.

   **Cross-reference validity:**
   - Wikilinks `[[ADR-NNNN]]` inside ADRs must resolve to existing files.

3. Report all findings:
   - PASS: "ADR numbering is sequential (N ADRs, no duplicates)"
   - WARN: "Gap detected at NNNN" (acceptable, just informational)
   - FAIL: "Duplicate number", "Missing frontmatter field", "Broken supersession chain"

## What to Do on Failures

| Failure | Fix |
|---------|-----|
| Duplicate NNNN | Renumber one ADR and update all references |
| Missing frontmatter field | Add the field with correct value |
| Broken supersession | Fix the `supersedes` reference or update status |
| Broken wikilink | Fix the `[[ADR-NNNN]]` reference in the file |

## Related Skills

- `kdoc:adr-create` — create a new ADR
- `kdoc:governance-check` — full Knowledge health check
