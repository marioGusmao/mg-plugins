---
type: route-contract
module: {{MODULE}}
status: draft
date: {{DATE}}
tags:
  - api
  - {{MODULE}}
summary: API contract for {{METHOD}} {{ROUTE_PATH}}.
---

# Route Contract: {{METHOD}} {{ROUTE_PATH}}

## Endpoint

| Property | Value |
|----------|-------|
| Method | `{{METHOD}}` |
| Path | `{{ROUTE_PATH}}` |
| Auth required | Yes / No |
| Auth type | <!-- Session cookie / API key / None --> |

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| <!-- param --> | string | Yes | <!-- description --> |

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| <!-- param --> | string | No | — | <!-- description --> |

### Request Body (if POST/PUT/PATCH)

```json
{
  "field": "string (required)",
  "optionalField": "string (optional)"
}
```

**Zod schema:** `<!-- z.object({ field: z.string(), ... }) -->`

## Response

### 200 OK

```json
{
  "data": {}
}
```

### 400 Bad Request

```json
{ "error": "Validation failed", "details": [] }
```

### 401 Unauthorized

```json
{ "error": "Unauthorized" }
```

### 404 Not Found

```json
{ "error": "Not found" }
```

### 500 Internal Server Error

```json
{ "error": "Internal server error" }
```

## Implementation Notes

<!-- Route handler file: `apps/<app>/src/app/api/.../route.ts` -->
<!-- Uses `responseSchema` for contract enforcement. -->
<!-- Related Server Actions (if any): `modules/{{MODULE}}/actions/` -->

## Acceptance Criteria

- [ ] Returns correct status codes for all documented cases.
- [ ] Response shape matches the documented schemas.
- [ ] Auth check rejects unauthenticated requests when required.
- [ ] Input validation returns 400 with field-level errors.
