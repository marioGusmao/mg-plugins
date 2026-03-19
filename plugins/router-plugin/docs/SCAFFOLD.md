# Scaffold

## Command

```bash
node src/cli.js scaffold /absolute/path/to/host-repo --project-key my_project
node src/cli.js scaffold /absolute/path/to/host-repo --project-key my_project --default-language pt-PT
node src/cli.js scaffold /absolute/path/to/host-repo --project-key my_project --packet-type improvement_proposal --packet-type question --packet-type ack
node src/cli.js scaffold /absolute/path/to/host-repo --project-key my_project --force
```

If installed as a binary:

```bash
router-plugin scaffold /absolute/path/to/host-repo --project-key my_project
```

The command accepts either a repository root or a direct `router/` root.

## What It Creates

- `router/router-contract.json`
- `router/inbox/.gitkeep`
- `router/outbox/.gitkeep`
- `router/conformance/valid-packet.example.md`
- `router/conformance/invalid-packet.example.md`

Default packet types:

- `improvement_proposal`
- `question`
- `insight`
- `ack`

## Safety Model

- Existing managed files are not overwritten unless `--force` is passed.
- The command creates protocol surfaces only.
- It does not generate repository-specific workflow code.
- It does not modify local machine config or downstream integration paths.

## Recommended Follow-Up

After scaffolding, run:

```bash
node src/cli.js certify /absolute/path/to/host-repo
```

Then add repository-local handling rules for how inbound packets are reviewed and who may emit acknowledgements.
