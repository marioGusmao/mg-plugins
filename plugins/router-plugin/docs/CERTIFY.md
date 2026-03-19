# Certification

## Command

```bash
node src/cli.js certify /absolute/path/to/host-repo
node src/cli.js certify /absolute/path/to/router-root
node src/cli.js certify /absolute/path/to/host-repo --json
node src/cli.js certify /absolute/path/to/host-repo --fix
```

If the package is installed as a binary:

```bash
router-plugin certify /absolute/path/to/host-repo
```

The command accepts either a repository root containing `router/` or a direct `router/` root path.

## What The MVP Checks

- required router surfaces exist
- `router/router-contract.json` is valid JSON with the supported minimal schema
- packet fixtures in `router/conformance/` are protocol-valid
- conformance fixtures whose filename contains `invalid` are treated as expected-failure fixtures and must fail validation
- any packet files present in `router/inbox/` or `router/outbox/` are also validated
- warnings are emitted when `ack` is not part of `supported_packet_types`

## What `--fix` Does

`--fix` is intentionally conservative.

It may create these directories when they are missing:

- `router/`
- `router/inbox/`
- `router/outbox/`
- `router/conformance/`

It does not write:

- `router/router-contract.json`
- packet files
- repository-specific workflow code

## Current Limits

This first version certifies static protocol compatibility, not end-to-end host workflow execution.

It does not yet:

- invoke host repository commands
- simulate approval workflows
- verify that emitted acknowledgements are semantically correct
- detect runtime writes outside `router/`
