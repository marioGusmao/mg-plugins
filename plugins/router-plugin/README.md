# Router-Plugin

Reusable protocol pack for repositories that participate in the Project Router flow.

This plugin is meant for two host-repository roles:

- consume packets received in `router/inbox/`
- author protocol-valid packets that another router will later ingest

The package is intentionally lightweight. It does not ship a runtime SDK yet. It defines the protocol, the safety rules, the templates, and the AI skills that help repositories follow the same contract.

## Why

Without a shared plugin, each repository tends to invent its own understanding of:

- which files belong under `router/`
- which metadata fields are mandatory
- when a repo may write to `inbox/` versus `outbox/`
- how acknowledgements should work
- what must stay read-only

That usually drifts into incompatible packet formats and unsafe cross-repo writes.

## What Is Included

### Protocol docs

- `docs/PROTOCOL.md` — protocol surfaces, mandatory metadata, and safety rules
- `docs/ADOPTION.md` — how a host repository should adopt the protocol
- `docs/CERTIFY.md` — executable certification flow for host repositories
- `docs/SCAFFOLD.md` — host bootstrap flow for creating a router surface

### Templates

- `templates/router/router-contract.json` — starter downstream contract
- `templates/router/conformance/valid-packet.example.md` — valid packet fixture
- `templates/router/conformance/invalid-packet.example.md` — intentionally invalid fixture

### Skills

- `skills/consume-router-inbox/` — for repositories that receive and process packets from `router/inbox/`
- `skills/write-router-packets/` — for repositories that author new protocol packets for delivery

## Recommended Adoption Model

Use this plugin as the shared contract layer, then let each host repository decide how to integrate it:

1. Copy or mirror the `templates/router/` scaffold into the host repository.
2. Copy the relevant skill folder into the agent surface used by that repository.
3. Keep repository-specific routing rules and machine-local paths outside this plugin.

## Certification

This plugin now ships a certification entrypoint for host repositories:

```bash
node src/cli.js certify /absolute/path/to/host-repo
node src/cli.js certify /absolute/path/to/host-repo --json
node src/cli.js certify /absolute/path/to/host-repo --fix
```

The certification report is designed to answer one question with evidence: is this repository protocol-compatible enough to participate in router traffic without manual repair?

## Scaffold

This plugin also ships a scaffold entrypoint for bootstrapping a host repository:

```bash
node src/cli.js scaffold /absolute/path/to/host-repo --project-key my_project
node src/cli.js certify /absolute/path/to/host-repo
```

The intended loop is:

1. scaffold the router surface
2. certify the result
3. add repository-specific handling rules on top

## Non-Goals

- No automatic dispatch
- No cross-repo mutation outside the declared `router/` surfaces
- No repository-specific routing rules
- No machine-local path storage

## Next Step

If the host repository already uses the Project Router template, align this plugin with the repository's existing `router/router-contract.json`, `supported_packet_types`, and `doctor` validation flow instead of introducing a second protocol variant.
