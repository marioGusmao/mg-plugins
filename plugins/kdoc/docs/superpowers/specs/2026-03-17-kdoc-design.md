# kdoc — Design Specification

**Date:** 2026-03-17
**Status:** Approved
**Author:** Mario + Claude Code (brainstorming session)

---

## 1. Problem Statement

AVShop2 has a mature Knowledge documentation system (`Knowledge/` directory with ADRs, TLDRs, Roadmap, Design specs, Guides, Agent Memory, Runbooks, Threat Models, Templates, and governance scripts) that has proven highly effective for managing project documentation, AI agent context, and architectural decisions.

This system is **85%+ universally reusable** across projects — the patterns, templates, validation scripts, and governance rules are not specific to AVShop2's domain. However, there is no way to:

1. Scaffold this structure into existing projects that already have code and configs
2. Keep templates and scripts updated across multiple projects
3. Adapt the structure to different technology stacks (Next.js, Swift/iOS, Python)
4. Integrate with different AI tools (Claude Code, Codex CLI) using each tool's native strengths

### Goals

- **Scaffold**: Install a Knowledge structure into any project (new or existing) safely and incrementally
- **Maintain**: Update templates and scripts across projects without breaking user customizations
- **Adapt**: Support multiple technology stacks via "packs" and multiple AI tools via native integrations
- **Document**: The toolkit documents itself using its own structure (dogfooding)

### Non-Goals

- Replace existing documentation tools (MkDocs, Docusaurus, Notion)
- Provide a rendered documentation site (this is about source documentation, not presentation)
- Auto-generate documentation from code (this is about structure and governance, not content generation)
- Support every possible technology stack in v1

---

## 2. Solution Overview

**kdoc** is a hybrid CLI toolkit + Claude Code plugin that scaffolds and maintains Knowledge documentation structures across projects.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    kdoc (single repo)                    │
│                                                         │
│  ┌─────────┐  ┌─────────┐  ┌───────────┐  ┌─────────┐ │
│  │   CLI   │  │  Core   │  │   Packs   │  │  Integ  │ │
│  │ (npx)   │  │templates│  │  nextjs   │  │ claude  │ │
│  │ init    │  │ scripts │  │ swift-ios │  │  codex  │ │
│  │ add     │  │ schemas │  │           │  │         │ │
│  │ update  │  │ govern. │  │           │  │         │ │
│  │ doctor  │  │         │  │           │  │         │ │
│  │ create  │  │         │  │           │  │         │ │
│  │ undo    │  │         │  │           │  │         │ │
│  └────┬────┘  └────┬────┘  └─────┬─────┘  └────┬────┘ │
│       │            │             │              │       │
│       └────────────┴─────────────┴──────────────┘       │
│                         │                                │
│              Reads .kdoc.yaml for config                 │
│              Writes .kdoc.lock for state                  │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   Target Project    │
              │                     │
              │  Knowledge/         │
              │  scripts/kdoc/      │
              │  .kdoc.yaml         │
              │  .kdoc.lock         │
              │  CLAUDE.md (merged) │
              │  AGENTS.md (merged) │
              └─────────────────────┘
```

### Key Design Decisions

| # | Decision | Rationale | ADR |
|---|----------|-----------|-----|
| 1 | Marker-based merging for existing files | Safe, reversible, user controls position. AST parsing is fragile, full file replace is destructive | ADR-0001 |
| 2 | Hash manifest for idempotency | Best balance of complexity and safety. Copier's 3-way merge is more powerful but excessive for v1 | ADR-0002 |
| 3 | Hybrid CLI + Plugin architecture | CLI gives independence from AI tools. Plugin gives rich experience. Either alone loses one side | ADR-0003 |
| 4 | Technology packs | 70% of core is universal, 30% diverges by stack. One plugin with config beats N separate plugins | ADR-0004 |
| 5 | Native agents per AI tool | Claude Code has parallel sub-agents, Codex has multi-stream. Abstracting wastes each tool's strengths | ADR-0005 |
| 6 | TypeScript (CLI) + Python (validation) | TS is natural for npm CLI. Python is natural for text processing/validation | ADR-0006 |
| 7 | YAML for config | Readable, supports comments, standard for config. JSON lacks comments. TOML less familiar | ADR-0007 |
| 8 | Dogfooding | Proves the structure works. Integrated maintenance documentation. Separate docs/ doesn't test the product | ADR-0008 |

---

## 3. Directory Structure

```
kdoc/
├── .claude-plugin/
│   └── plugin.json                 # Plugin manifest
│
├── cli/                            # CLI source (TypeScript)
│   ├── src/
│   │   ├── index.ts                # Entry point (Commander.js)
│   │   ├── commands/
│   │   │   ├── init.ts             # Interactive scaffold
│   │   │   ├── add.ts              # Add area/pack/tool
│   │   │   ├── update.ts           # Update scripts/templates
│   │   │   ├── doctor.ts           # Health check
│   │   │   ├── create.ts           # Create ADR/TLDR/etc
│   │   │   └── undo.ts             # Revert installation
│   │   ├── scaffold/
│   │   │   ├── detect.ts           # Detect stack + state
│   │   │   ├── plan.ts             # Generate execution plan
│   │   │   ├── execute.ts          # Apply changes
│   │   │   └── merge/
│   │   │       ├── markers.ts      # Marker-based merge (CLAUDE.md, AGENTS.md, .gitignore)
│   │   │       ├── package-json.ts # Key-prefix merge (package.json)
│   │   │       ├── turbo-json.ts   # Task-prefix merge (turbo.json)
│   │   │       └── index.ts        # Strategy dispatcher
│   │   ├── config/
│   │   │   ├── loader.ts           # Read/write .kdoc.yaml
│   │   │   ├── lock.ts             # Read/write .kdoc.lock
│   │   │   └── schema.ts           # Config validation (Zod)
│   │   ├── templates/
│   │   │   └── renderer.ts         # Placeholder substitution engine
│   │   └── utils/
│   │       ├── hash.ts             # SHA-256 file hashing
│   │       ├── fs.ts               # Safe file operations
│   │       └── git.ts              # Git status checks
│   ├── package.json
│   ├── tsconfig.json
│   └── tsup.config.ts
│
├── skills/                         # Claude Code skills
│   ├── scaffold/
│   │   └── SKILL.md
│   ├── adr-create/
│   │   └── SKILL.md
│   ├── adr-validate/
│   │   └── SKILL.md
│   ├── tldr-create/
│   │   └── SKILL.md
│   ├── tldr-update-status/
│   │   └── SKILL.md
│   ├── roadmap-add-phase/
│   │   └── SKILL.md
│   ├── roadmap-update/
│   │   └── SKILL.md
│   ├── design-create-spec/
│   │   └── SKILL.md
│   ├── governance-check/
│   │   └── SKILL.md
│   ├── memory-save/
│   │   └── SKILL.md
│   ├── create-guide/
│   │   └── SKILL.md
│   └── create-threat-model/
│       └── SKILL.md
│
├── agents/                         # Agents (native per tool)
│   ├── claude-code/
│   │   ├── knowledge-auditor.md    # Orchestrator — runs scripts, launches sub-agents
│   │   ├── adr-auditor.md          # Sub-agent — validates ADR governance
│   │   ├── tldr-sync-checker.md    # Sub-agent — validates TLDR completeness
│   │   └── roadmap-builder.md      # Sub-agent — generates dashboard
│   └── codex/
│       └── AGENTS-knowledge.md     # Multi-stream templates for Codex
│
├── hooks/
│   ├── hooks.json                  # Hook configuration
│   ├── session-start.mjs           # Inject Knowledge context on session start
│   └── pre-push-check.mjs         # Warn if kdoc:check not run before push
│
├── core/                           # Universal content
│   ├── templates/
│   │   ├── adr.md
│   │   ├── tldr.md
│   │   ├── phase.md
│   │   ├── sub-phase.md
│   │   ├── test-map.md
│   │   ├── runbook.md
│   │   ├── threat-model.md
│   │   ├── context-pack.md
│   │   ├── guide.md
│   │   ├── memory.md
│   │   ├── readme-adr.md
│   │   ├── readme-tldr.md
│   │   └── readme-roadmap.md
│   ├── scripts/
│   │   ├── check_sync.py
│   │   ├── check_wikilinks.py
│   │   ├── build_index.py
│   │   ├── check_adr_governance.py
│   │   └── governance_health.py
│   ├── schema/
│   │   ├── knowledge-structure.json
│   │   └── frontmatter-schemas.json
│   └── governance/
│       ├── adr-conventions.md
│       ├── tldr-lifecycle.md
│       ├── wikilink-standard.md
│       ├── gap-tracking.md
│       ├── roadmap-conventions.md
│       └── merge-strategy.md
│
├── packs/
│   ├── nextjs/
│   │   ├── pack.json
│   │   ├── templates/
│   │   │   ├── page-spec.md
│   │   │   ├── flow-spec.md
│   │   │   ├── route-contract.md
│   │   │   └── recipe.md
│   │   ├── scripts/
│   │   │   └── check_route_contracts.ts
│   │   ├── guides/
│   │   │   ├── onboarding.md
│   │   │   ├── troubleshooting.md
│   │   │   └── module-placement.md
│   │   └── design/
│   │       ├── tokens-template.json
│   │       └── standards/
│   │           ├── ui-patterns.md
│   │           ├── responsive-strategy.md
│   │           └── accessibility.md
│   └── swift-ios/
│       ├── pack.json
│       ├── templates/
│       │   ├── screen-spec.md
│       │   ├── flow-spec.md
│       │   ├── api-contract.md
│       │   └── recipe.md
│       ├── scripts/
│       │   └── check_module_deps.sh
│       ├── guides/
│       │   ├── onboarding.md
│       │   ├── troubleshooting.md
│       │   └── module-placement.md
│       └── design/
│           ├── tokens-template.json
│           └── standards/
│               ├── hig-patterns.md
│               └── accessibility.md
│
├── integrations/
│   ├── claude-code/
│   │   └── install.js              # Copy skills + agents + hooks
│   └── codex/
│       └── install.js              # Generate AGENTS.md block
│
├── Knowledge/                      # Dogfooding (kdoc's own docs)
│   ├── ADR/
│   │   ├── README.md
│   │   ├── ADR-0001-marker-based-merging.md
│   │   ├── ADR-0002-hash-manifest-idempotency.md
│   │   ├── ADR-0003-cli-plus-plugin-hybrid.md
│   │   ├── ADR-0004-pack-architecture.md
│   │   ├── ADR-0005-native-agents-per-tool.md
│   │   ├── ADR-0006-python-plus-typescript-split.md
│   │   ├── ADR-0007-yaml-config-format.md
│   │   └── ADR-0008-dogfooding.md
│   ├── TLDR/
│   │   ├── README.md
│   │   ├── cli-init.md
│   │   ├── cli-add.md
│   │   ├── cli-update.md
│   │   ├── cli-doctor.md
│   │   ├── cli-create.md
│   │   ├── cli-undo.md
│   │   ├── merge-strategies.md
│   │   ├── pack-nextjs.md
│   │   ├── pack-swift-ios.md
│   │   ├── integration-claude.md
│   │   └── integration-codex.md
│   ├── ContextPack.md
│   └── INDEX.md
│
├── .kdoc.yaml                      # kdoc's own config (reference example)
├── .gitignore
├── package.json                    # Root package.json for CLI
└── README.md
```

---

## 4. CLI Architecture

### 4.1 Commands

| Command | Description | Flags |
|---------|-------------|-------|
| `npx kdoc init` | Interactive scaffold | `--pack`, `--tools`, `--yes`, `--dry-run`, `--verbose` |
| `npx kdoc add <area>` | Add area to existing install | `--yes`, `--force` |
| `npx kdoc add-pack <pack>` | Add technology pack | `--yes` |
| `npx kdoc add-tool <tool>` | Add AI tool integration | `--yes` |
| `npx kdoc update` | Update scripts/templates | `--force`, `--dry-run`, `--yes` |
| `npx kdoc doctor` | Health check | `--json` (machine-readable output) |
| `npx kdoc create <type> [name]` | Create document | `--scope`, `--status` |
| `npx kdoc undo` | Revert last install | `--keep-config`, `--yes` |

**`--yes` flag contract (applies uniformly to all commands):**
Non-interactive mode for CI and scripting. When `--yes` is set:
- All interactive prompts are skipped
- Conflict resolution defaults to **Skip** (never overwrites user-modified content without explicit `--force`)
- Area/pack/tool selection uses detected defaults or flag values
- Confirmation prompts are auto-accepted

`--force` is a separate, stronger flag: it overwrites user-modified content without asking. `--force` implies `--yes`.

### 4.2 Init Flow

```
1. DETECT
   ├── Stack detection (root + 2 levels deep for monorepos):
   │   ├── next.config.{ts,js,mjs}  → nextjs
   │   ├── Package.swift / *.xcodeproj → swift-ios
   │   ├── pyproject.toml / setup.py → python (future)
   │   ├── go.mod → go (future)
   │   ├── Monorepo detection: if indicators found at depth > 0,
   │   │   report all detected packs and prompt user to confirm
   │   └── Multiple packs detected → suggest multi-pack: "--pack nextjs,swift-ios"
   │
   ├── State detection:
   │   ├── Knowledge/ → check which subdirs exist + file counts
   │   ├── .kdoc.yaml → re-run mode (use existing config)
   │   └── .kdoc.lock → managed files tracking
   │
   └── AI tool detection:
       ├── .claude/ or .claude-plugin/ → claude-code
       ├── AGENTS.md or .codex/ → codex
       └── .cursor/ or .cursorrules → cursor (future)

2. ASK (interactive, skipped with --yes)
   ├── Confirm detected pack(s) or select
   ├── Select areas (checkbox, defaults based on pack)
   ├── Select AI tools (checkbox)
   ├── Configure scopes (TLDR/Design subdirs)
   └── Confirm scripts prefix (default: kdoc)

3. PLAN
   ├── Generate file operations list
   ├── Classify each: CREATE / MERGE / SKIP / CONFLICT
   ├── Show preview with file counts
   └── Ask for confirmation

4. EXECUTE
   ├── Create backup (.kdoc.backup/) if merging
   ├── Create directories and files
   ├── Apply merge strategies
   ├── Write .kdoc.yaml
   └── Write .kdoc.lock

5. REPORT
   └── Summary of changes + next steps
```

### 4.3 Merge Strategies

#### Marker-based (CLAUDE.md, AGENTS.md, .gitignore)

```
Named markers — each logical block has its own unique marker pair:
  Core:         <!-- kdoc:core:start -->    / <!-- kdoc:core:end -->
  Per-pack:     <!-- kdoc:pack:nextjs:start --> / <!-- kdoc:pack:nextjs:end -->
  .gitignore:   # kdoc:core:start           / # kdoc:core:end

This allows core content and pack-specific content to coexist independently
in the same file. Each block is managed separately — adding a pack does not
regenerate the core block, and updating core does not touch pack blocks.

The .kdoc.lock records which marker name each merged file uses (e.g., "core",
"pack:nextjs"), enabling targeted update and undo per block.

Algorithm (per marker-named block):
  1. File does not exist        → create with block
  2. Exists, no markers for this name → append block at end
  3. Exists, markers found      → replace between markers
  4. Corrupted markers (only 1) → error + manual fix instructions
  5. Duplicate markers for same name → error + ask which to keep
  6. User edited between markers:
     → Hash in .lock matches current → safe to update
     → Hash differs → prompt: "[S]kip / [O]verwrite / [D]iff"
```

#### Key-prefix (package.json)

```
Identifier: all scripts with prefix "kdoc:" belong to toolkit

Operations:
  Install: add kdoc:* keys to "scripts" object
  Update:  replace values of kdoc:* keys
  Undo:    remove all kdoc:* keys

Never touches keys without "kdoc:" prefix.
```

#### Task-prefix (turbo.json)

```
Same pattern as package.json but for "tasks" object.
Only applied if turbo.json exists.
```

### 4.4 Lock File (.kdoc.lock)

The lock file is **committed to git** (not git-ignored). It is a team-shared file that enables any team member to run `kdoc update`, `kdoc doctor`, and `kdoc undo`. The `.kdoc.backup/` directory IS git-ignored (contains pre-install file snapshots, local-only).

```jsonc
{
  "lockVersion": 1,                       // lock file schema version
  "kdocVersion": "1.0.0",                 // kdoc CLI version that created/updated this
  "installedAt": "2026-03-17T15:30:00Z",
  "updatedAt": "2026-03-17T15:30:00Z",
  "config": {
    "root": "Knowledge",
    "packs": ["nextjs"],
    "tools": ["claude-code", "codex"]
  },
  "files": {
    "<path>": {
      "action": "created" | "merged",
      "hash": "sha256:<hex>",           // for created files: hash of full file content
      "blockHash": "sha256:<hex>",      // for merged files: hash of ONLY the injected block
      "templateHash": "sha256:<hex>",   // hash of source template at install time (for update diffing)
      "template": "<source-template>",  // which template generated it
      "strategy": "markers" | "prefix", // for merged files
      "markerName": "core" | "pack:<name>"  // for strategy "markers": which named marker pair (optional, absent for "prefix")
    }
  }
}
```

**Hash comparison rules:**
- For `created` files: compare `hash` (full file content) to detect user modifications
- For `merged` files: compare `blockHash` (content between markers only) to detect user modifications. Never compare full file hash — user content outside markers is expected to change.
- For `update` version detection: compare `templateHash` against current kdoc version's template hash to determine if the source template has changed

**Schema migration:** If `lockVersion` is less than the running kdoc version's expected lock version, `kdoc update` runs an automatic lock migration before proceeding. Breaking lock schema changes require a kdoc major version bump.

### 4.5 Config File (.kdoc.yaml)

```yaml
version: 1
root: Knowledge
packs: [nextjs]
tools: [claude-code, codex]

areas:
  adr:            { enabled: true }
  tldr:           { enabled: true, scopes: [Admin, Shop, Shared] }
  roadmap:        { enabled: true }
  design:         { enabled: true, scopes: [admin, shop] }
  guides:         { enabled: true }
  agent-memory:   { enabled: true }
  runbooks:       { enabled: true }
  threat-models:  { enabled: true }
  templates:      { enabled: true }
  governance:     { enabled: true }
  context-pack:   { enabled: true }
  index:          { enabled: true }

governance:
  sync-check: true
  wikilinks: true
  adr-governance: true
  index-build: true
  enforced-paths:
    - apps/*/src/modules/
    - apps/*/src/core/
    - packages/*/src/

scripts:
  prefix: kdoc
```

### 4.6 Idempotency Decision Tree

```
For each file in the execution plan:

  File exists?
  ├─ NO → Create
  │       └─ Register in .lock as "created" + hash
  │
  └─ YES → In .lock?
           │
           ├─ YES (managed by toolkit) → Current hash == lock hash?
           │   │
           │   ├─ YES (unmodified) → Safe to update
           │   │   └─ Overwrite + update hash in .lock
           │   │
           │   └─ NO (user modified) → Prompt
           │       └─ "[S]kip / [O]verwrite / [D]iff"
           │
           └─ NO (not managed) → Mergeable file?
               │
               ├─ YES (CLAUDE.md, package.json, etc.) → Apply merge strategy
               │   └─ Register in .lock as "merged"
               │
               └─ NO → SKIP with warning
                   └─ "⚠ <path> exists (not managed by kdoc). Skipping."
```

### 4.7 Transactional Execution and Partial Failure Recovery

The EXECUTE step uses an incremental lock-write strategy to handle crashes:

```
1. Write .kdoc.lock.tmp (empty manifest with metadata)
2. For each file operation:
   a. Execute the operation (create/merge)
   b. Append the file entry to .kdoc.lock.tmp immediately
   c. If operation fails: log error, continue to next file (best-effort)
3. On completion (success or partial):
   a. Rename .kdoc.lock.tmp → .kdoc.lock (atomic)
   b. Report summary including any failures
4. On crash (process killed):
   a. .kdoc.lock.tmp exists → next run detects partial install
   b. `kdoc doctor` reads .kdoc.lock.tmp and reports incomplete state
   c. `kdoc init` with existing .kdoc.lock.tmp → prompts:
      "Previous install was interrupted. [R]esume / [U]ndo partial / [S]tart fresh"
```

This ensures:
- No silent partial state — `.kdoc.lock.tmp` always reflects what was actually done
- Recovery is possible — `undo` reads `.lock.tmp` if `.lock` is absent
- Re-running is safe — detected as interrupted install, user chooses action

**Concurrency limitation (v1):** Running multiple `kdoc` instances simultaneously against
the same project directory is NOT supported. The `.kdoc.lock.tmp` file acts as a soft
indicator but is not a mutual-exclusion lock. If two processes write concurrently, the
second may silently overwrite the first's lock state. This is acceptable for v1 — kdoc
is a developer tool typically run manually or in a single CI job. A PID-based lock guard
(`O_CREAT | O_EXCL` on `.kdoc.pid`) may be added in a future version if needed.

### 4.8 Undo Algorithm

```
npx kdoc undo

1. Read .kdoc.lock (or .kdoc.lock.tmp if .lock is missing)
2. For each file entry, by action type:

   action: "created"
     → Compare current file hash against hash in .kdoc.lock:
       - Hash matches (file unmodified since scaffold) → delete the file
       - Hash differs (user edited the file) → prompt:
         "[K]eep / [A]rchive to .kdoc.backup/ / [D]elete --force"
         With --yes: defaults to Keep (safe)
         With --force: deletes without asking
     → After file deletion, walk ancestor directories up to (but not
       including) the Knowledge/ root:
       - For each ancestor, check if directory contains ONLY empty
         subdirectories and NO files (tracked or untracked)
       - If safe → delete the empty directory
       - If any file found → stop walking, leave directory intact

   action: "merged", strategy: "markers"
     → Read current file
     → Find named markers using the file-type-appropriate delimiter:
       - Markdown: <!-- kdoc:<name>:start --> / <!-- kdoc:<name>:end -->
       - .gitignore: # kdoc:<name>:start / # kdoc:<name>:end
       (where <name> is recorded in .kdoc.lock, e.g., "core", "pack:nextjs")
     → Remove everything between markers (inclusive)
     → If file is now empty (was created by kdoc with only the block) → delete file
     → Otherwise write the file back without the block
     → Repeat for all marker names in .kdoc.lock for this file

   action: "merged", strategy: "prefix"
     → Read package.json / turbo.json
     → Remove all keys with "kdoc:" prefix
     → Write file back

3. Delete .kdoc.lock and .kdoc.lock.tmp (whichever exists)
4. Delete .kdoc.backup/ if exists
5. Prompt: "Remove .kdoc.yaml too? [Y/n]"
   → --keep-config flag skips this prompt and preserves config

Backup strategy:
  - .kdoc.backup/ stores the ORIGINAL state of merged files (pre-first-install)
  - Subsequent `update` runs do NOT overwrite the backup — it always reflects pre-kdoc state
  - If undo detects a merged file has been deleted by the user, it skips that file with a warning
```

### 4.9 Update Flow

```
npx kdoc update [--force] [--dry-run]

1. VALIDATE
   ├── .kdoc.yaml must exist (error if not: "Run `kdoc init` first")
   ├── .kdoc.lock must exist (error if not: "No installation found")
   └── Read running kdoc version + lock's kdocVersion

2. DESIRED-STATE DIFF
   Build a desired-state manifest from current kdoc version + .kdoc.yaml,
   then diff against .kdoc.lock to produce 5 operation types:

   CREATE — file exists in desired state but not in lock
   ├── New template/script added in this kdoc version
   └── Treat as new CREATE (same as init)

   UPDATE — file exists in both desired state and lock
   ├── action: "created"
   │   ├── Compare source template hash (current kdoc) vs lock's templateHash
   │   ├── Template unchanged → skip
   │   ├── Template changed + file unmodified (hash matches lock) → update
   │   └── Template changed + file modified → prompt: "[S]kip / [O]verwrite / [D]iff"
   │
   └── action: "merged"
       ├── Regenerate block from current kdoc + .kdoc.yaml
       ├── Compare with blockHash in lock
       ├── Block unchanged → skip
       └── Block changed → apply merge strategy

   REMOVE — file exists in lock but NOT in desired state
   ├── Template/script was removed or renamed in this kdoc version
   ├── File unmodified (hash matches lock) → delete + remove from lock
   ├── File modified → prompt: "[K]eep / [D]elete / [A]rchive"
   └── With --yes: defaults to Keep (safe)

   RENAME — file exists in lock at old path, desired state has it at new path
   ├── Detected via `template` field match (e.g., "core/templates/adr.md") at
   │   different paths. The `template` field is the stable identity key for
   │   rename detection — not `templateHash`, which only tracks content drift.
   │   This avoids false matches when two different templates happen to have
   │   identical content.
   ├── File unmodified → move file + update lock
   ├── File modified → prompt: "[R]ename / [K]eep at old path"
   └── With --yes: defaults to Rename (preserves user content)

   SKIP — file exists in both and is unchanged → no-op

3. PLAN (same as init step 3: generate operation list, preview, confirm)

4. EXECUTE (same as init step 4: backup, create, merge, write .kdoc.yaml)
   Then update .kdoc.lock with new hashes and kdocVersion

5. REPORT (same as init step 5: summary of changes)

Note: `update` NEVER touches user-created documents (ADRs, TLDRs, etc.).
It only manages files that kdoc originally created or merged (tracked in .lock).
--force and --yes follow the global flag contract defined in Section 4.1.
```

### 4.10 Add Commands

```
npx kdoc add <area>        — Add a Knowledge area
npx kdoc add-pack <pack>   — Add a technology pack
npx kdoc add-tool <tool>   — Add an AI tool integration

All three commands follow the same transactional pattern:
1. Read .kdoc.yaml (error if missing: "Run `kdoc init` first")
2. Validate the argument is valid
3. Compute desired .kdoc.yaml in memory (do NOT write yet)
4. Run a targeted scaffold (same PLAN → EXECUTE as init, but scoped)
5. On success: persist .kdoc.yaml + .kdoc.lock atomically
6. On failure: .kdoc.yaml is unchanged — config never declares
   packs/areas/tools that were not successfully scaffolded

Valid <area> values:
  adr, tldr, roadmap, design, guides, agent-memory,
  runbooks, threat-models, templates, governance, context-pack, index

Valid <pack> values:
  nextjs, swift-ios (extensible via packs/ directory)

Valid <tool> values:
  claude-code, codex (extensible via integrations/ directory)

npx kdoc add-pack nextjs:
  → Copies pack templates to Knowledge/Templates/nextjs/
  → Copies pack guides to Knowledge/Guides/nextjs/
  → Copies pack scripts to scripts/kdoc/nextjs/
  → Creates Knowledge/Design/nextjs/<scope>/ per pack default scope
  → Merges pack's enforced-paths into .kdoc.yaml (union)
  → Updates CLAUDE.md/AGENTS.md blocks with new commands
  → On success: persists .kdoc.yaml with pack added + updates .kdoc.lock

npx kdoc add-tool codex:
  → Runs integrations/codex/install.js
  → Generates/merges AGENTS.md block
  → On success: persists .kdoc.yaml with tool added + updates .kdoc.lock
```

### 4.11 Create Command

```
npx kdoc create <type> [name] [--scope <scope>] [--status <status>]

Valid <type> values and their applicable flags:

| Type | Name Required | --scope | --status | Output Path |
|------|--------------|---------|----------|-------------|
| adr | Yes | — | proposed (default) | Knowledge/ADR/ADR-{NNNN}-{name}.md |
| tldr | Yes | Required | draft (default) | Knowledge/TLDR/{scope}/{name}.md |
| phase | Yes | — | — | Knowledge/Roadmap/phases/phase-{N}.md |
| sub-phase | Yes | — | — | Knowledge/Roadmap/phases/phase-{N}/{M}.md |
| guide | Yes | — | — | Knowledge/Guides/{name}.md |
| threat-model | Yes | — | — | Knowledge/runbooks/threat-models/{name}.md |
| runbook | Yes | — | — | Knowledge/runbooks/{name}.md |
| test-map | Yes | — | — | Knowledge/Templates/{name}-test-map.md |

ADR sequential numbering:
  1. Glob Knowledge/ADR/ADR-*.md
  2. Extract highest NNNN
  3. Next = highest + 1 (zero-padded to 4 digits)
  4. If concurrent creation causes a gap, that's acceptable (gaps are allowed)
```

### 4.12 Doctor Command

```
npx kdoc doctor [--json]

Checks performed per category:

CONFIG:
  ✓/✗ .kdoc.yaml exists and is valid (Zod schema)
  ✓/✗ .kdoc.lock exists and matches .kdoc.yaml areas
  ✓/✗ No .kdoc.lock.tmp (no interrupted installs)

STRUCTURE (per enabled area, using knowledge-structure.json expectations):
  ✓/✗ Expected directory exists
  ✓/✗ Required files exist (driven by area's "requires" field)

  Per-area expectation types (from knowledge-structure.json):
    empty-ok:              area can be empty after scaffold (guides, runbooks)
    readme-required:       area must have README.md (adr, tldr, roadmap, design)
    generated-required:    area must have its generated file (index → INDEX.md)
    seed-file-required:    area must have its seed file (agent-memory → MEMORY.md, context-pack → ContextPack.md)
    content-expected:      warn if area has README but zero user-created documents (adr, tldr — soft nudge, not failure). This is a static file-count check, not time-based — the lock has no per-area activation timestamp.

SCRIPTS:
  ✓/✗ Each expected script exists in scripts/kdoc/
  ✓/✗ Script hash matches current kdoc version (outdated if different)

INTEGRATIONS:
  ✓/✗ CLAUDE.md has kdoc block (if claude-code in tools)
  ✓/✗ AGENTS.md has kdoc block (if codex in tools)
  ✓/✗ package.json has kdoc:* scripts

GOVERNANCE (if scripts exist, run them):
  ✓/✗ ADR numbering valid (sequential, no duplicates)
  ✓/✗ Wikilinks valid (no broken references)
  ✓/✗ INDEX.md up to date (compare generated vs existing)

JSON output schema (--json):
{
  "version": "1.0.0",
  "status": "healthy" | "issues" | "broken",
  "checks": [
    {
      "category": "config" | "structure" | "scripts" | "integrations" | "governance",
      "name": "check name",
      "status": "pass" | "fail" | "warn",
      "message": "description",
      "fix": "suggested fix command (optional)"
    }
  ],
  "summary": { "pass": N, "fail": N, "warn": N }
}

Exit codes: 0 = all pass, 1 = failures found, 2 = config error
```

### 4.13 Safety Features

| Protection | Implementation |
|------------|---------------|
| Never deletes files it didn't create | .kdoc.lock verification |
| Never overwrites without asking | Hash comparison + prompt |
| Backup before merge | .kdoc.backup/ stores pre-first-install state of merged files |
| Dry-run mode | `--dry-run` shows plan without executing |
| Verbose mode | `--verbose` shows each operation |
| Git dirty check | Warns if uncommitted changes before scaffold |
| Undo support | `kdoc undo` reverses all operations via .lock |
| Crash recovery | Incremental `.kdoc.lock.tmp` survives process crash |
| Non-interactive mode | `--yes` defaults to Skip for conflicts (safe for CI) |

### 4.14 Tech Stack

| Dependency | Purpose | Size |
|------------|---------|------|
| `commander` | CLI command parsing | ~50KB |
| `inquirer` | Interactive prompts | ~150KB |
| `yaml` | YAML parse/write | ~100KB |
| `fast-glob` | File detection | ~30KB |
| `zod` | Config validation | ~60KB |
| `tsup` | Build/bundle (dev) | — |
| `vitest` | Testing (dev) | — |

---

## 5. Core Content

### 5.1 Templates

13 templates extracted from AVShop2 and generalized with placeholders:

| Template | Source | Placeholders |
|----------|--------|-------------|
| `adr.md` | `Knowledge/Templates/adr.md` | `{{ID}}`, `{{TITLE}}`, `{{DATE}}` |
| `tldr.md` | `Knowledge/Templates/feature.md` | `{{AREA}}`, `{{MODULE}}`, `{{STATUS}}` |
| `phase.md` | `Knowledge/Templates/phase.md` | `{{PHASE_NUMBER}}`, `{{PHASE_NAME}}` |
| `sub-phase.md` | `Knowledge/Templates/sub-phase.md` | `{{PHASE}}`, `{{SUB_PHASE}}` |
| `test-map.md` | `Knowledge/Templates/test-map.md` | `{{FEATURE}}`, `{{DATE}}` |
| `runbook.md` | `Knowledge/Templates/runbook.md` | `{{TITLE}}` |
| `threat-model.md` | `Knowledge/Templates/threat-model.md` | `{{AREA}}`, `{{MODULE}}` |
| `context-pack.md` | Based on `Knowledge/ContextPack.md` | `{{PROJECT_NAME}}`, `{{AREAS}}` |
| `guide.md` | New (generic) | `{{TITLE}}`, `{{CATEGORY}}` |
| `memory.md` | Based on `Knowledge/AgentMemory/MEMORY.md` | `{{PROJECT_NAME}}` |
| `readme-adr.md` | Based on `Knowledge/ADR/README.md` | `{{AUTHORITY}}` |
| `readme-tldr.md` | Based on `Knowledge/TLDR/README.md` | `{{SCOPES}}` |
| `readme-roadmap.md` | Based on `Knowledge/Roadmap/README.md` | None |

Placeholder substitution uses simple `{{KEY}}` syntax — no template engine dependency.

**Placeholder rules:**
- Escape: use `\{{KEY}}` to output a literal `{{KEY}}` without substitution (for templates that document other template systems)
- Missing key: if a placeholder has no value provided, the CLI emits a warning (`"⚠ Placeholder {{KEY}} has no value — left as literal"`) and the placeholder text remains in the output. This is a soft error, not a hard failure — the resulting file is valid but may need manual editing.
- All placeholders SHOULD be provided at instantiation time. The CLI warns on missing values but does not abort, allowing partial scaffolding where some values are filled later by the user.

### 5.2 Validation Scripts (Python)

| Script | Source | Config Read |
|--------|--------|-------------|
| `check_sync.py` | `scripts/check_knowledge_sync.py` | `enforced-paths`, `root`, `areas` |
| `check_wikilinks.py` | `scripts/check_knowledge_wikilinks.py` | `root` |
| `build_index.py` | `scripts/build_knowledge_index.py` | `root`, `areas` |
| `check_adr_governance.py` | Based on AVShop2 validators | `areas.adr` |
| `governance_health.py` | `scripts/governance_health.py` | `governance` |

All scripts read `.kdoc.yaml` for configuration. They validate only enabled areas and enforced paths.

**Config schema evolution:** The Zod schema in `config/schema.ts` uses `.passthrough()` for forward compatibility — unknown fields are preserved, not rejected. Breaking schema changes (removing or renaming fields) require a kdoc major version bump and a migration path in `kdoc update`. Non-breaking additions (new optional fields with defaults) are handled transparently.

### 5.3 Governance Documents

Reference documents consulted by skills and agents (not copied to target projects):

| Document | Content |
|----------|---------|
| `adr-conventions.md` | Status lifecycle, acceptance gates, sequencing, supersession |
| `tldr-lifecycle.md` | Status taxonomy, gap tracking tags, readiness checklist |
| `wikilink-standard.md` | Syntax `[[TARGET]]`, resolution, validation |
| `gap-tracking.md` | Tags, removal rules |
| `roadmap-conventions.md` | Phase/sub-phase structure, exit criteria, retrospectives |
| `merge-strategy.md` | How markers work, merge rules by file type |

### 5.4 Schemas

```jsonc
// knowledge-structure.json — defines expected structure per area
{
  "areas": {
    "adr": {
      "path": "ADR",
      "requires": ["readme"],
      "filePattern": "ADR-{NNNN}-*.md",
      "frontmatter": { "required": ["id", "status", "date"] }
    },
    "tldr": {
      "path": "TLDR",
      "requires": ["readme"],
      "scoped": true,
      "frontmatter": { "required": ["area", "status"] }
    },
    "roadmap": {
      "path": "Roadmap",
      "requires": ["readme"],
      "subfolders": ["phases", "generated", "reference"]
    },
    "design": {
      "path": "Design",
      "requires": ["readme"],
      "scoped": true,
      "subfolders": ["tokens", "standards"]
    },
    "guides": {
      "path": "Guides"
    },
    "agent-memory": {
      "path": "AgentMemory",
      "requires": ["memory-index"]
    },
    "runbooks": {
      "path": "runbooks",
      "subfolders": ["operations", "recipes", "plans", "guides"]
    },
    "threat-models": {
      "path": "runbooks/threat-models",
      "note": "Independently managed area. Created by kdoc when threat-models is enabled, regardless of runbooks setting. Lives inside runbooks/ for organizational coherence but has its own enable/disable toggle."
    },
    "templates": {
      "path": "Templates"
    },
    "context-pack": {
      "file": "ContextPack.md"
    },
    "index": {
      "file": "INDEX.md",
      "generated": true
    }
  }
}
```

---

## 6. Technology Packs

### 6.1 Pack Manifest (pack.json)

```jsonc
{
  "name": "<pack-name>",
  "displayName": "<human-readable>",
  "description": "<what this pack is for>",
  "detect": {
    "files": ["<glob patterns for auto-detection>"],
    "dependencies": ["<package names>"],
    "packageManager": ["<npm|pnpm|yarn|spm|cocoapods>"]
  },
  "defaults": {
    "scopes": ["<default TLDR/Design scopes>"],
    "enforced-paths": ["<default paths for sync-check>"],
    "scripts-prefix": "kdoc",
    "scripts-runner": "<pnpm|make|swift>"
  },
  "areas": {
    "<area-specific overrides>"
  }
}
```

### 6.2 Pack: nextjs

**Detection:** `next.config.{ts,js,mjs}` or `next` in dependencies

**Additional templates:**
- `page-spec.md` — Page specification (layout, components, tokens, responsive, a11y)
- `flow-spec.md` — Multi-step flow specification (checkout, onboarding)
- `route-contract.md` — API route contract (endpoint, request/response schemas)
- `recipe.md` — Reusable recipe template (auth setup, API wrapper, etc.)

**Additional scripts:**
- `check_route_contracts.ts` — Validates route handlers have defined contracts

**Guides:**
- `onboarding.md` — Next.js project onboarding (pnpm, env vars, dev server)
- `troubleshooting.md` — Common Next.js errors and solutions
- `module-placement.md` — File placement decision tree for modular Next.js

**Design:**
- `tokens-template.json` — DTCG-format design tokens (colors, spacing, typography)
- `standards/ui-patterns.md` — UI patterns reference
- `standards/responsive-strategy.md` — Responsive breakpoints and strategy
- `standards/accessibility.md` — WCAG 2.2 checklist

**Default scopes:** `[Admin, Shop, Shared]`
**Default enforced-paths:** `[apps/*/src/modules/, apps/*/src/core/, apps/*/src/app/api/, packages/*/src/]`

### 6.3 Pack: swift-ios

**Detection:** `Package.swift`, `*.xcodeproj`, `*.xcworkspace`

**Additional templates:**
- `screen-spec.md` — Screen specification (equivalent to page-spec for iOS)
- `flow-spec.md` — Navigation flow specification (state transitions)
- `api-contract.md` — API client contract (endpoint, Codable models)
- `recipe.md` — Reusable recipe template (networking, persistence, etc.)

**Additional scripts:**
- `check_module_deps.sh` — Validates dependencies between SPM modules

**Guides:**
- `onboarding.md` — iOS project onboarding (Xcode, SPM, simulators)
- `troubleshooting.md` — Common iOS development issues
- `module-placement.md` — Target/package organization decision tree

**Design:**
- `tokens-template.json` — Design tokens for iOS (Dynamic Type, SF Symbols)
- `standards/hig-patterns.md` — HIG alignment patterns
- `standards/accessibility.md` — iOS accessibility checklist (VoiceOver, Dynamic Type)

**Default scopes:** `[App, Shared]`
**Default enforced-paths:** `[Sources/*/Modules/, Sources/*/Core/, Packages/*/Sources/]`

### 6.4 Multi-Pack Support

When a project uses multiple packs (`--pack nextjs,swift-ios`):

1. Core installs normally (once)

**Unified namespacing rule — ALL pack-specific content is namespaced by pack name:**

| Content type | Single-pack path | Multi-pack path | Ownership |
|---|---|---|---|
| Templates | `Knowledge/Templates/<pack>/` | Same — always namespaced | Lock tracks per-pack |
| Guides | `Knowledge/Guides/<pack>/` | Same — always namespaced | Lock tracks per-pack |
| Design | `Knowledge/Design/<pack>/<scope>/` | Same — platform is outer axis | Lock tracks per-pack |
| Scripts | `scripts/kdoc/<pack>/` | Same — always namespaced | Lock tracks per-pack |
| Core templates | `Knowledge/Templates/` (root) | Unchanged | Lock tracks as core |
| Core scripts | `scripts/kdoc/` (root) | Unchanged | Lock tracks as core |

Examples:
```
Knowledge/
├── Templates/
│   ├── adr.md                    ← core (shared)
│   ├── tldr.md                   ← core (shared)
│   ├── nextjs/
│   │   ├── page-spec.md          ← pack: nextjs
│   │   ├── flow-spec.md
│   │   └── recipe.md
│   └── swift-ios/
│       ├── screen-spec.md        ← pack: swift-ios
│       ├── flow-spec.md
│       └── recipe.md
├── Guides/
│   ├── nextjs/
│   │   ├── onboarding.md
│   │   └── troubleshooting.md
│   └── swift-ios/
│       ├── onboarding.md
│       └── troubleshooting.md
├── Design/
│   ├── nextjs/                   ← platform is outer axis
│   │   ├── admin/                ← scope is inner axis
│   │   ├── shop/
│   │   ├── tokens/
│   │   └── standards/
│   └── swift-ios/
│       ├── app/
│       ├── shared/
│       ├── tokens/
│       └── standards/
scripts/
└── kdoc/
    ├── check_sync.py             ← core
    ├── nextjs/
    │   └── check_route_contracts.ts
    └── swift-ios/
        └── check_module_deps.sh
```

This rule eliminates all collision scenarios:
- `onboarding.md` from nextjs and swift-ios never collide (different subdirs)
- Design scopes are per-pack, not global — no confusion between platform and scope
- `kdoc undo` of one pack does not affect the other's files
- `.kdoc.lock` records `template: "packs/nextjs/..."` or `template: "core/..."` for clear ownership

Additional multi-pack behaviors:
5. Validation scripts from both packs run — enforced-paths are combined (set union, deduplicated)
6. Scopes are NOT combined globally — each pack owns its own scopes within its namespace
7. `.kdoc.yaml` records both: `packs: [nextjs, swift-ios]`

---

## 7. AI Tool Integrations

### 7.1 Claude Code — Full Plugin

#### Skills (12)

| Skill | Trigger Patterns | Purpose |
|-------|-----------------|---------|
| `kdoc:scaffold` | "scaffold knowledge", "kdoc init" | Invoke CLI or scaffold inline |
| `kdoc:adr-create` | "create ADR", "new decision" | Fill template, prompt for input, save with sequential numbering |
| `kdoc:adr-validate` | "validate ADRs" | Run `check_adr_governance.py`, interpret results |
| `kdoc:tldr-create` | "create TLDR", "document module" | Fill template with scope/area, detect module from context |
| `kdoc:tldr-update-status` | "mark TLDR as done" | Update frontmatter status + remove resolved gap tags |
| `kdoc:roadmap-add-phase` | "add phase to roadmap" | Create phase + sub-phase files from templates |
| `kdoc:roadmap-update` | "update phase status" | Update frontmatter status, generate dashboard |
| `kdoc:design-create-spec` | "create page spec", "create screen spec" | Detect pack, use correct template |
| `kdoc:governance-check` | "check knowledge", "kdoc doctor" | Run all validation scripts, report |
| `kdoc:memory-save` | "save to memory", "remember" | Create/update file in AgentMemory/ |
| `kdoc:create-guide` | "create onboarding guide" | Fill guide template |
| `kdoc:create-threat-model` | "threat model for auth" | Fill STRIDE threat-model template |

#### Agents (4)

| Agent | Type | Purpose | Leverages |
|-------|------|---------|-----------|
| `knowledge-auditor` | Orchestrator | Run scripts, launch sub-agents, consolidate report, write governance-health.md | Parallel sub-agents |
| `adr-auditor` | Sub-agent | Validate all ADRs: numbering, cross-refs, supersession, status | Mass file reading |
| `tldr-sync-checker` | Sub-agent | Validate all TLDRs: gap tags vs content, status lifecycle, wikilinks, coverage | Gap reasoning |
| `roadmap-builder` | Sub-agent | Read all phases + TLDRs + evidence, generate dashboard | Report generation |

#### Hooks (2)

| Hook | Event | Purpose |
|------|-------|---------|
| `session-start.mjs` | `SessionStart` | Read `.kdoc.yaml`, inject summary of active areas and available commands |
| `pre-push-check.mjs` | `PreToolUse` (matcher: `Bash`, filters for `git push` in command) | Warn if `kdoc:check` not run since last commit. **Note:** This is a Claude Code hook, not a git hook — it only fires when `git push` is executed via Claude's Bash tool, not when run directly in a terminal. For terminal coverage, users should add a git `pre-push` hook separately (documented in guides). |

#### Plugin Manifest (.claude-plugin/plugin.json)

```jsonc
{
  "name": "kdoc",
  "description": "Knowledge documentation toolkit — scaffold, maintain, and govern project documentation structures",
  "version": "1.0.0",
  "author": {
    "name": "MRM"
  }
}
```

Claude Code auto-discovers this manifest when the plugin directory is registered via `--plugin-dir` or installed via `claude plugins add`. The manifest declares identity only — skills, agents, hooks, and MCP servers are discovered by convention from their respective directories at the plugin root.

### 7.2 Codex CLI — Generated Config

Codex has no plugins, skills, or hooks. Everything goes into AGENTS.md and .codex/:

**Generated into AGENTS.md (with markers):**
- Knowledge structure description
- Rules for when to update Knowledge
- Multi-stream audit templates (3 streams for parallel auditing)
- Available validation commands

**Generated into .codex/agents/:**
- `knowledge-auditor/instructions.md` — Equivalent to Claude Code agent but using multi-stream patterns

### 7.3 Equivalence Table

| Capability | Claude Code | Codex CLI |
|------------|-------------|-----------|
| Create ADR | Skill `kdoc:adr-create` (interactive) | AGENTS.md instructions + template |
| Validate Knowledge | Skill `kdoc:governance-check` | Command `pnpm kdoc:check` |
| Full audit | Agent `knowledge-auditor` (parallel sub-agents) | Multi-stream template (3 streams) |
| Startup context | Hook `session-start.mjs` | AGENTS.md section (auto-read) |
| Pre-push alert | Hook `pre-push-check.mjs` | AGENTS.md instruction |
| Scaffold | Skill `kdoc:scaffold` → CLI | CLI directly (`npx kdoc init`) |

---

## 8. Scaffold Operations Detail

### 8.1 What Gets Created (per area)

| Area | Files Created |
|------|--------------|
| `adr` | `Knowledge/ADR/README.md` |
| `tldr` | `Knowledge/TLDR/README.md`, `Knowledge/TLDR/<scope>/` per scope |
| `roadmap` | `Knowledge/Roadmap/README.md`, `Knowledge/Roadmap/phases/`, `Knowledge/Roadmap/generated/`, `Knowledge/Roadmap/reference/` |
| `design` | `Knowledge/Design/README.md`, per pack: `Knowledge/Design/<pack>/<scope>/`, `Knowledge/Design/<pack>/tokens/`, `Knowledge/Design/<pack>/standards/`. Always namespaced by pack — even single-pack projects use `Knowledge/Design/<pack>/` to avoid path drift if a second pack is added later (e.g., `Knowledge/Design/nextjs/admin/`). |
| `guides` | `Knowledge/Guides/` (empty, ready for guides) |
| `agent-memory` | `Knowledge/AgentMemory/MEMORY.md` |
| `runbooks` | `Knowledge/runbooks/` with subfolders: `operations/`, `recipes/`, `plans/`, `guides/` |
| `threat-models` | `Knowledge/runbooks/threat-models/` |
| `templates` | `Knowledge/Templates/` with all enabled templates |
| `governance` | `scripts/kdoc/` with all enabled scripts |
| `context-pack` | `Knowledge/ContextPack.md` |
| `index` | `Knowledge/INDEX.md` (generated by running `build_index.py`) |

### 8.2 What Gets Merged

| File | What is Injected |
|------|-----------------|
| `CLAUDE.md` | Knowledge Base section (areas, commands, rules) |
| `AGENTS.md` | Knowledge Management section (structure, rules, multi-stream templates) |
| `.gitignore` | `.kdoc.backup/`, `.kdoc.lock.tmp` entries (note: `.kdoc.lock` is committed, not ignored) |
| `package.json` | `kdoc:check`, `kdoc:index`, `kdoc:adr:check`, `kdoc:governance` scripts |
| `turbo.json` | `kdoc:check`, `kdoc:index` tasks (if turbo.json exists) |

### 8.3 What is Never Touched

- Any file not in the plan
- Content outside markers in merged files
- Package.json keys without "kdoc:" prefix
- Existing Knowledge files not managed by the toolkit
- User's git history, branches, or commits

---

## 9. Dogfooding

kdoc documents itself using its own Knowledge structure:

### 9.1 ADRs (8 initial)

| ADR | Decision | Key Rationale |
|-----|----------|---------------|
| 0001 | Marker-based merging | Safe, reversible, user controls position |
| 0002 | Hash manifest idempotency | Best complexity/safety balance |
| 0003 | CLI + Plugin hybrid | Independence from AI tools + rich AI experience |
| 0004 | Pack architecture | 70% universal core, 30% stack-specific |
| 0005 | Native agents per tool | Each AI tool has different strengths |
| 0006 | TypeScript + Python split | Each language in its strength |
| 0007 | YAML config format | Readable, comments, standard |
| 0008 | Dogfooding | Proves structure works, integrated maintenance docs |

### 9.2 TLDRs (11 initial)

One TLDR per CLI command + merge strategies + each pack + each integration.

### 9.3 ContextPack

Quick-start document for anyone (human or AI) maintaining kdoc.

---

## 10. Research-Informed Decisions

Based on web research conducted during brainstorming:

### 10.1 From Scaffold Tools (Plop, Hygen, Yeoman, Copier)

| Pattern Adopted | Source | How Applied |
|----------------|--------|-------------|
| Marker-based injection with `skip_if` | Hygen | Our marker system with hash-based skip detection |
| In-memory planning before execution | Yeoman | Plan step shows all operations before executing |
| Hash manifest for file tracking | Drupal scaffold system | `.kdoc.lock` tracks created/merged files with hashes |
| Composable generators | Yeoman composability | Packs compose on top of core |

| Pattern Rejected | Source | Why |
|-----------------|--------|-----|
| 3-way merge | Copier | Too complex for v1; hash manifest is sufficient |
| AST parsing for file modification | Yeoman best practice for complex edits | Our merges are append/replace, not structural |
| Template engine (Handlebars/EJS) | Plop/Yeoman | Simple `{{KEY}}` substitution is sufficient |

### 10.2 From Claude Code Plugin Best Practices

| Pattern Adopted | Source | How Applied |
|----------------|--------|-------------|
| Skills for repeated procedures | Anthropic plugin docs | 12 skills for common Knowledge operations |
| Minimal MCP footprint | Context budget research | No MCP server — skills and hooks are sufficient |
| PreToolUse hooks for validation | Claude Code hook system | Pre-push check hook (can warn before push executes) |
| SessionStart for context injection | Claude Code hook system | Session-start hook injects Knowledge summary |

### 10.3 From Documentation Management Research

| Pattern Adopted | Source | How Applied |
|----------------|--------|-------------|
| Co-located docs with CI enforcement | Industry best practice (Backstage, Fern) | Knowledge sync check in governance scripts |
| Single source of truth in repo | Docs-as-code movement | All Knowledge in git, no external wikis |
| Automated index generation | MkDocs monorepo plugin | `build_index.py` generates INDEX.md |
| Wikilink validation | Obsidian ecosystem | `check_wikilinks.py` validates cross-references |

---

## 11. Platform Support

**v1: macOS and Linux (Unix-like systems only).**

Windows is not a target for v1. The CLI, scripts, and hooks assume:
- POSIX filesystem semantics (case-sensitive paths, symlinks, `rename` atomicity)
- Python 3.9+ available on `PATH` (for validation scripts)
- Node.js 20+ (for CLI and hooks)

**No shell scripts as entrypoints.** All automation uses Node.js or Python entrypoints:
- `integrations/claude-code/install.js` (not `.sh`)
- `integrations/codex/install.js` (not `.sh`)
- `core/scripts/governance_health.py` (replaces `.sh` wrapper — invokes Python validators directly)
- Pack-specific scripts: `.ts` (compiled by the CLI) or `.py` (invoked directly)

The only exception is `packs/swift-ios/scripts/check_module_deps.sh`, which uses
Xcode tooling only available on macOS. This is documented in the swift-ios `pack.json`
as a platform requirement. The script lives in the pack directory, not in `core/scripts/`.

Windows support may be added in a future version if demand warrants it.

---

## 12. Future Considerations (Not in v1)

- Additional packs: Python, Go, Rust
- Additional AI tools: Cursor, Gemini CLI
- Rendered documentation site (MkDocs integration)
- Plugin marketplace distribution
- CI/CD workflow templates per pack
- `kdoc migrate` — migrate from other documentation structures
- Design token generation from Figma
- AI-powered documentation suggestions (detect undocumented modules)

---

## 12. Success Criteria

1. `npx kdoc init` on a blank project creates full Knowledge structure in < 30 seconds
2. `npx kdoc init` on AVShop2 detects existing structure and only adds missing pieces
3. `npx kdoc init` run twice on an unmodified install produces zero file changes and exits cleanly (idempotent)
4. `npx kdoc undo` cleanly reverses all scaffold operations
5. `npx kdoc doctor` accurately reports health across all areas
6. Claude Code skills correctly create ADRs, TLDRs, and other documents
7. Codex CLI audit templates produce equivalent results to Claude Code agents
8. Multi-pack projects (`nextjs,swift-ios`) have no conflicts between packs
9. All validation scripts respect `.kdoc.yaml` config (only check enabled areas)
10. Marker-based merges never corrupt user content outside markers
