---
type: design-standard
id: responsive-strategy
status: active
tags: [design, responsive, mobile-first, layout]
summary: Breakpoint definitions, mobile-first approach, and responsive layout rules.
---

# Responsive Strategy

## Mobile-First Approach

Base styles target the smallest viewport (320px minimum). Larger layouts are progressive enhancements applied via `min-width` breakpoints. Content is never hidden from mobile users — layout adapts presentation, not availability.

In Tailwind CSS, write classes without prefixes for mobile, add prefixes (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`) for larger viewports.

## Breakpoints

| Token | Name | Width | Primary Use |
|-------|------|-------|-------------|
| — | Base (mobile) | < 640px | Single-column, stacked content, full-width |
| `breakpoint.sm` | Small | 640px | Large phones landscape, minor adjustments |
| `breakpoint.md` | Medium | 768px | Tablets portrait, 2-column layouts begin |
| `breakpoint.lg` | Large | 1024px | Laptops, multi-column layouts |
| `breakpoint.xl` | Extra Large | 1280px | Standard desktops, max container width |
| `breakpoint.2xl` | 2x Large | 1536px | Wide monitors, full-width data tables |

## Layout Rules

### Containers

- Max content width: `1280px` (align with `breakpoint.xl`).
- Horizontal padding: `spacing.4` (mobile), `spacing.8` (tablet+).
- Centered with `margin: 0 auto`.

### Grid

- Mobile: 1 column (default)
- Tablet (`md`): 2 columns (cards, forms)
- Desktop (`lg`): up to 12-column grid (complex layouts)

### Navigation

| Viewport | Pattern |
|----------|---------|
| Mobile | Bottom navigation bar or hamburger menu |
| Tablet | Collapsible sidebar or top navigation |
| Desktop | Full sidebar or header navigation |

## Touch Targets

- Minimum 44×44px for all interactive elements (WCAG 2.5.5).
- Minimum 48×48px recommended for primary CTAs.
- Adequate spacing between adjacent targets to prevent mis-taps.

## Images

- Use `next/image` with `priority` for above-the-fold images (LCP).
- Provide explicit `width` and `height` to prevent layout shift (CLS).
- Use `sizes` attribute to serve appropriately-sized images per viewport.

## Testing

1. Test mobile first — verify the experience is complete before larger viewports.
2. Test at each defined breakpoint (not just endpoints).
3. Test landscape orientation on mobile (constrain tall elements to `max-height: 50vh`).
4. Verify with keyboard-only navigation at all breakpoints.
