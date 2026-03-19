# Project Router Protocol

## Purpose

The protocol defines the minimum shared contract between repositories that exchange router packets.

The design goal is interoperability with strict safety boundaries:

- downstream repositories expose a narrow `router/` surface
- inbox consumption is local to the receiving repository
- outbox scanning is read-only from the central router side
- packet formats remain simple and inspectable

## Router Surface

Each participating repository should expose:

- `router/router-contract.json`
- `router/inbox/`
- `router/outbox/`
- `router/conformance/`

## Contract File

`router/router-contract.json` must declare:

- `schema_version`
- `project_key`
- `default_language`
- `supported_packet_types`

The contract should stay minimal. Local machine paths do not belong in this file.

## Packet Rules

Protocol packets are Markdown files with YAML frontmatter plus a Markdown body.

Required metadata depends on the workflow, but the baseline packet should include:

- `schema_version`
- `packet_id`
- `created_at`
- `source_project`
- `packet_type`
- `title`
- `language`
- `status`

## Safety Rules

- Never auto-apply an incoming packet without explicit local approval.
- Never rewrite or delete the original inbound packet as part of review.
- Never write into another repository outside its declared `router/` surface.
- Treat downstream `router/outbox/` as read-only during scan and review.
- Emit acknowledgements only when the receiving repository actually completed a decision.
- Keep packet types aligned with `supported_packet_types`.

## Write Boundaries

Use `router/inbox/` when a repository is receiving work or context from another router participant.

Use `router/outbox/` when a repository is publishing derived responses, acknowledgements, insights, or proposals for a router to ingest later.

Do not bypass these folders with ad hoc shared files.
