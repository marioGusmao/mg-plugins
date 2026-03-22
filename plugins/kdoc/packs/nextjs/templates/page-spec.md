---
type: page-spec
app: {{APP}}
id: {{PAGE_ID}}
status: draft
date: {{DATE}}
tags:
  - {{APP}}
summary: {{PAGE_NAME}} — page specification.
---

# {{PAGE_NAME}}

## Objective

<!-- What is this page for? Who does it serve? What is the primary user goal? -->

## Persona / Role

- **Primary persona**: <!-- e.g., Authenticated customer, Admin operator -->

## Related TLDR

<!-- Links to feature TLDRs that this page implements. Use wikilinks: [[TLDR/Scope/feature|Feature]] -->

## Route

`{{ROUTE}}`

## Layout Regions

### Header

<!-- Describe navigation, logo placement, auth state differences. -->

### Main Content

<!-- Primary content area — sections, cards, data displays. -->

### Footer

<!-- Footer links and copyright. -->

## Components Used

<!-- List of components rendered on this page and their source module. -->

## Interaction Rules

<!-- Describe all user interactions: clicks, form submissions, navigations. -->

## States

### Default

<!-- Happy path — all data loaded and visible. -->

### Loading

<!-- Skeleton placeholders — which regions show skeletons and how? -->

### Empty

<!-- No data to show — what is displayed instead? -->

### Error

<!-- Data fetch or action failure — how is the error surfaced? -->

## Validations

<!-- Form fields and their validation rules. "None" if no forms on this page. -->

## Accessibility Requirements

- Page has exactly one `<h1>`.
- Landmark elements: `<header>`, `<main>`, `<footer>`.
- Skip link present as first focusable element.
- All interactive elements have accessible labels.
- <!-- Add any page-specific a11y requirements. -->

## Responsive Behavior

| Viewport  | Layout            | Notes |
|-----------|-------------------|-------|
| Mobile    | Single column     |       |
| Tablet    | Two-column grid   |       |
| Desktop   | Multi-column grid |       |

## Acceptance Criteria

- [ ] Page renders at `{{ROUTE}}` with all layout regions visible.
- [ ] Loading state shows appropriate skeletons.
- [ ] Empty state is handled gracefully.
- [ ] Error state surfaces a meaningful message.
- [ ] Page is accessible: one `<h1>`, landmarks, skip link.
- [ ] Responsive layout correct across mobile / tablet / desktop.
