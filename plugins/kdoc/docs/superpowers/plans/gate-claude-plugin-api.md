# Gate: Claude Code Plugin API

- Date: 2026-03-18
- Result: FALLBACK
- Evidence: Tested codegraph plugin at `/Users/mariosilvagusmao/Documents/Code/MarioProjects/Plugins/codegraph/`. The codegraph plugin does NOT use a `.claude-plugin/plugin.json` manifest — skills are discovered by convention from the `skills/` directory relative to the plugin root. The `--plugin-dir` flag and `claude plugins add` mechanism are not publicly confirmed APIs. The codegraph plugin uses a direct `.claude/skills/` copy approach in practice.
- Impact on Plan 5: `integrations/claude-code/install.js` is the PRIMARY mechanism for deploying skills, agents, and hooks. `.claude-plugin/plugin.json` is created as a marker/metadata file per plan spec but is not relied upon for discovery. All remaining tasks place files in their plugin-relative directories (`skills/`, `agents/`, `hooks/`) and the install script copies them to `.claude/` in target projects.
