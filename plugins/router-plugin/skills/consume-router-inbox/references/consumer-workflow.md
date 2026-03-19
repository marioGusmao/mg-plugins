# Consumer Workflow

## Goal

Consume inbound router packets in a repository-local workflow without breaking protocol boundaries.

## Steps

1. Confirm a local router scaffold exists:
   - `router/router-contract.json`
   - `router/inbox/`
   - `router/outbox/`
2. Read the router contract and identify supported packet types.
3. Validate the incoming packet metadata before treating it as actionable.
4. Review the payload in the host repository's own workflow.
5. Record a decision locally.
6. If appropriate, emit an acknowledgement packet through `router/outbox/`.

## Decision Model

Recommended statuses:

- `in_progress` for accepted but not completed work
- `applied` for completed implementation
- `blocked` for valid work that cannot proceed
- `rejected` for work intentionally not accepted

## Safety

- Preserve the original inbound packet.
- Keep the repo-local workflow authoritative for implementation.
- Do not assume every inbound packet must produce an acknowledgement.
