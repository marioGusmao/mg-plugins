---
name: write-router-packets
description: Author protocol-valid router packets for delivery through router inbox or router outbox surfaces, using the destination contract to choose supported packet types and preserving the central router safety model. Use when a repository needs to send work, questions, insights, or acknowledgements through the router protocol.
---

# Write Router Packets

Use this skill when a repository needs to author new packets for another router participant.

## Workflow

1. Read `references/packet-authoring.md`.
2. Inspect the destination `router/router-contract.json` before choosing `packet_type`.
3. Use only packet types declared in `supported_packet_types`.
4. Write a complete packet with YAML frontmatter and Markdown body.
5. Place the packet only in the correct protocol surface.

## Guardrails

- Never invent packet types ad hoc.
- Never write outside the declared `router/` surface.
- Do not use this skill to bypass the central router's explicit approval model.
- Keep packet bodies concise, actionable, and reviewable by humans.
