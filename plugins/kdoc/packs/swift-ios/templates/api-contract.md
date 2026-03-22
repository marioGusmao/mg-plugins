---
type: api-contract
pack: swift-ios
endpoint: {{ENDPOINT_NAME}}
status: draft
date: YYYY-MM-DD
owner: ''
tags: []
summary: ''
---

# API Contract: {{ENDPOINT_NAME}}

## Endpoint

| Field | Value |
|---|---|
| Method | `GET` / `POST` / `PUT` / `DELETE` |
| Path | `/api/v1/<resource>` |
| Auth | Bearer token / None |
| Base URL | `{{API_BASE_URL}}` |

## Request

### Path Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `id` | `String` | Yes | Resource identifier |

### Query Parameters

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `page` | `Int` | No | `1` | Page number |

### Body (POST / PUT)

```swift
struct <RequestName>: Encodable {
    let field: String
    let count: Int
}
```

## Response

### Success (2xx)

```swift
struct <ResponseName>: Decodable {
    let id: String
    let name: String
    let createdAt: Date        // ISO 8601 — use `.iso8601` JSONDecoder strategy
}
```

### Error Shape

```swift
struct APIError: Decodable {
    let code: String
    let message: String
}
```

| HTTP Status | `code` | Meaning |
|---|---|---|
| 400 | `invalid_input` | Request validation failed |
| 401 | `unauthorized` | Token missing or expired |
| 404 | `not_found` | Resource does not exist |
| 500 | `server_error` | Retry with backoff |

## Retry Policy

- Max attempts: 3
- Backoff: exponential (1 s, 2 s, 4 s)
- Retryable: 429, 500, 503

## Open Questions

-
