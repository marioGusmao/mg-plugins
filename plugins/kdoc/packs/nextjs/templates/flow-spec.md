---
type: flow-spec
app: {{APP}}
id: {{FLOW_NAME}}-flow
status: draft
date: {{DATE}}
tags:
  - {{APP}}
  - flow
summary: {{FLOW_NAME}} — multi-step user flow specification.
---

# {{FLOW_NAME}} Flow

## Objective

<!-- What does this flow accomplish? What is the user goal at completion? -->

## Entry Points

<!-- How does the user enter this flow? Which routes or triggers? -->

## Steps

### Step 1: <!-- Step Name -->

**Route:** `<!-- /path/to/step-1 -->`

**Purpose:** <!-- What does the user do here? -->

**Inputs:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| <!-- field --> | <!-- text/select/... --> | Yes/No | <!-- rule --> |

**Actions:**
- **Continue**: Validates inputs → proceeds to Step 2.
- **Back**: Returns to entry point (or previous step).
- **Cancel**: Abandons flow → redirect to `<!-- /path -->`.

**Error States:**
- Validation failure: inline field error below each invalid input.
- Server error: toast notification with retry option.

---

### Step 2: <!-- Step Name -->

<!-- Repeat the Step 1 structure for each step. -->

---

### Completion

**Route:** `<!-- /path/to/confirmation -->`

**Success state:** <!-- What does the user see on successful completion? -->

**Post-completion action:** <!-- Redirect, email sent, etc. -->

## State Persistence

<!-- How is flow state preserved if the user navigates away or refreshes? (URL params, session, server) -->

## Accessibility Requirements

- Focus moves to the first invalid field on validation failure.
- Step progress is communicated to screen readers (e.g., `aria-current="step"`).
- Each step page has a descriptive `<h1>` reflecting the current step.

## Acceptance Criteria

- [ ] User can complete all steps from entry to confirmation.
- [ ] Validation prevents progression with invalid inputs.
- [ ] Back navigation preserves previously entered data.
- [ ] Cancel exits the flow and redirects correctly.
- [ ] Completion state is shown after the final step.
