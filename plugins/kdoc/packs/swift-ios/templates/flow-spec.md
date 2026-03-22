---
type: flow-spec
pack: swift-ios
flow: {{FLOW_NAME}}
status: draft
date: YYYY-MM-DD
owner: ''
tags: []
summary: ''
---

# Flow Spec: {{FLOW_NAME}}

## Entry Points

<!-- Where can a user enter this flow from? -->

| Entry | Trigger | Context passed |
|---|---|---|
| `<SourceScreen>` | Button tap | `<ContextType>` |

## Screens in Flow

| Step | Screen | Description |
|---|---|---|
| 1 | `<Step1Screen>` | <!-- Brief purpose --> |
| 2 | `<Step2Screen>` | |
| N | Completion | Flow exits or presents confirmation |

## State Machine

```
[Idle] --start--> [Step1] --next--> [Step2] --submit--> [Processing]
                                               ^               |
                                               |-- retry <-- [Error]
                                                             |
                                                           [Done]
```

## Navigation Method

- [ ] `NavigationStack` (push/pop)
- [ ] Modal sheet (`sheet` / `fullScreenCover`)
- [ ] Tab switch
- [ ] Deep link: `<url-scheme>://<path>`

## Exit Points

| Exit | Condition | Destination |
|---|---|---|
| Success | Flow completed | `<DestinationScreen>` |
| Cancel | User taps dismiss | Returns to entry point |
| Error (unrecoverable) | Fatal failure | Root / Home |

## Open Questions

-
