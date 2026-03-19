# Adoption Guide

## Host Repository Responsibilities

Each host repository should own:

- its local `router/` folder
- its packet handling logic
- its repository-specific workflow rules
- its validation and review policy

This plugin should stay generic. It defines the protocol, not the host repository's internal business logic.

## Recommended Rollout

1. Create or update the host repository's `router/` scaffold from `templates/router/`.
   Or bootstrap it directly with `router-plugin scaffold <target> --project-key <key>`.
2. Set the correct `project_key`, `default_language`, and `supported_packet_types`.
3. Add the relevant skill into the host repository's AI surface.
4. Add repository-local docs describing who may approve and emit packets.
5. Validate the contract with the repository's own protocol checks.

## Suggested Split

- Shared protocol and examples: this plugin
- Shared router validation and orchestration: central router repository
- Repository-specific handling rules: the host repository itself

## Important Constraint

If the host repository already follows the central Project Router protocol, prefer alignment over extension. A host repo should not invent new packet fields or packet types unless the central router can validate and consume them.
