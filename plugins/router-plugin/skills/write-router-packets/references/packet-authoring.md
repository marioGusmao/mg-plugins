# Packet Authoring

## Goal

Write protocol-valid packets that another repository or central router can ingest without manual repair.

## Minimum Packet Shape

Include:

- `schema_version`
- `packet_id`
- `created_at`
- `source_project`
- `packet_type`
- `title`
- `language`
- `status`

The body should explain the request, insight, question, or acknowledgement in normal Markdown.

## Surface Selection

- Write to `router/inbox/` when delivering work into the receiving repository's intake surface.
- Write to `router/outbox/` when publishing a response or event for a router to scan later.

## Packet Type Discipline

Always derive `packet_type` from the destination contract.

Examples:

- `improvement_proposal`
- `question`
- `insight`
- `ack` only if the receiving side declares it in `supported_packet_types`

## Safety

- Avoid side effects beyond writing the packet itself.
- Do not treat packet creation as approval to mutate the target repository.
