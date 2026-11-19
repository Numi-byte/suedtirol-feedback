# Review checklist

## Visual consistency

- Semantic colors are used consistently; no unnecessary one-off hex values.
- Typography follows the public or portal hierarchy.
- Spacing follows the 8px-derived rhythm.
- Cards, inputs, pills, borders, and shadows match the intended geometry.
- Existing content, translations, and brand assets were not silently replaced.

## Responsive behavior

- Check approximately 360px, 768px, 1024px, and a wide desktop viewport.
- No horizontal document overflow.
- Grids collapse intentionally and long labels/identifiers wrap.
- Touch targets remain at least 44×44px.
- Mobile dialogs, menus, forms, footer, and sticky elements remain usable with the on-screen keyboard.

## Interaction states

- Default, hover, focus-visible, active/selected, disabled, pending, success, error, empty, and long-content states are present where applicable.
- Saving does not discard unrelated search, pagination, scroll, or disclosure state.
- Dialog Cancel, Reset, Save, Escape, backdrop, focus entry, and focus return behave correctly.
- Loading UI does not hide a permanent failure or create large layout shifts.

## Accessibility

- Semantic headings remain ordered.
- Every input has a label and every icon-only control has an accessible name.
- State is available without color alone.
- Keyboard navigation reaches every action in a logical order.
- Focus is always visible.
- Dynamic success uses `role="status"`; errors use `role="alert"`.
- `aria-current`, `aria-pressed`, `aria-expanded`, and `aria-busy` are applied where relevant.
- Reduced-motion preference is honored.
- Text and controls meet WCAG AA contrast.

## Engineering

- Target framework and component conventions are preserved.
- No backend, credentials, environment bindings, or deployment configuration were copied.
- No copyrighted font, logo, photo, or icon file was transferred without authorization.
- Lint, typecheck, relevant tests, and production build pass, or failures are documented.
- Only requested files changed; unrelated user work remains intact.
