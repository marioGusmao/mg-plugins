---
name: consume-router-inbox
description: Consume packets from a repository-local router inbox, validate the protocol contract before acting, preserve inbound packets, and emit acknowledgements only after a real decision. Use when a repository receives work or context through router/inbox.
---

# Consume Router Inbox

Use this skill when a repository receives protocol packets through `router/inbox/` and needs to process them safely.

## Workflow

1. Read `references/consumer-workflow.md` before taking action.
2. Confirm the repository has a local `router/router-contract.json`.
3. Treat inbound packets as immutable inputs during analysis.
4. Review the packet against the declared `supported_packet_types`.
5. Move the host workflow forward only after a local decision is explicit.
6. Emit an acknowledgement packet only if the host repository actually completed a decision.

## Guardrails

- Never auto-apply inbound requests.
- Never mutate another repository directly as part of inbox review.
- Do not emit `ack` unless the host contract supports it.
- Keep the original packet available for auditability.
