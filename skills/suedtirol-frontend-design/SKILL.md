---
name: suedtirol-frontend-design
description: Apply the calm, rounded, accessible visual language used by the Suedtirol Feedback public client and protected portal to another frontend without copying backend logic or project content.
---

# Suedtirol frontend design

Use this skill when a user asks to create, restyle, or review a frontend in the visual language of the Suedtirol Feedback applications. It is a design-system skill, not an application clone.

## Boundaries

- Preserve the target project's framework, routing, data flow, authentication, and business behavior.
- Never copy Supabase configuration, API calls, environment identifiers, permissions, database code, production text, personal data, or deployment settings.
- Treat logos, photographs, icons, and the Frutiger/Ely Rounded font files as separately licensed assets. Reuse them only when the target project has explicit rights; otherwise use its own brand assets and the fallback fonts in `assets/design-tokens.css`.
- Keep the target project's content and information architecture unless the user explicitly requests content changes.
- Do not publish or deploy unless explicitly requested.

## Workflow

1. Inspect the target before editing: framework, global styles, component conventions, existing tokens, fonts, breakpoints, accessibility patterns, and dirty worktree state.
2. Identify whether the requested surface is public-facing, administrative, or both. Read `references/visual-language.md` and only the relevant sections of `references/component-recipes.md`.
3. Map the semantic tokens from `assets/design-tokens.css` onto the target project's token mechanism. Prefer existing variables when their meaning already matches; avoid parallel token systems.
4. Build with the target project's components. Use native semantic elements and retain existing event handlers, validation, loading states, permissions, and translations.
5. Apply the system in this order: page shell, typography, layout, surfaces, controls, responsive states, interaction states, then motion.
6. Validate every affected viewport and state using `references/review-checklist.md`. Run the target project's lint, typecheck, tests, and production build when available.
7. Report the files changed, validation performed, and any assets or fonts that still require licensing or replacement.

## Core visual rules

- Use a white or very light blue-gray canvas with one strong blue action color.
- Use deep blue-gray for headings; reserve bright blue for actions, selection, and focus.
- Prefer large rounded cards (24–48px), pill controls (32px radius), thin cool-gray borders, and restrained shadows.
- Use an 8px-derived spacing rhythm. Common gaps are 8, 12, 16, 24, 32, 40, 48, 64, and 80px.
- Public pages may use expressive display headings. Administrative pages prioritize dense, readable humanist typography and clear grouping.
- Keep body text at 16px/24–26px. Keep labels at 14px/20–22px. Never shrink interactive text to solve layout problems.
- Interactive targets must be at least 44px; primary actions are normally 48–56px high.
- Use borders and background changes before introducing stronger shadows.
- Preserve visible focus, keyboard operation, reduced-motion behavior, labels, status announcements, and error messages.
- At narrow widths, collapse grids to one column, let toolbars wrap, and make important form actions full width. Do not horizontally squeeze fields.

## Pattern selection

- Public navigation, information pages, map/list cards, and full footer: use the public patterns.
- Login, management pages, data editors, tables/lists, permission forms, and moderation: use the portal patterns.
- Creation and configuration tasks that should not disrupt page context: use the accessible dialog pattern.
- Optional detail inside repeated cards: use native `details`/`summary` disclosure.
- Loading: keep the current layout stable, show a localized spinner or skeleton, expose `aria-busy`, and respect reduced motion.

## Non-negotiable interaction behavior

- A modal has a visible title, top-right close control, Escape handling, backdrop dismissal where safe, scroll locking, and focus restoration.
- A reset action resets the draft only. Closing or cancelling must not silently save.
- Destructive actions are visually distinct and require an explicit confirmation appropriate to their risk.
- Icon-only controls require an accessible name and normally a tooltip/title.
- Active navigation and toggles expose state with `aria-current`, `aria-pressed`, `aria-expanded`, or native semantics.
- Errors use `role="alert"`; non-urgent save feedback uses `role="status"`.

## Reference routing

- Read `references/visual-language.md` for tokens, typography, spacing, layout, and responsive behavior.
- Read `references/component-recipes.md` when implementing components or interactions.
- Read `references/review-checklist.md` before considering the work complete.
- Start from `assets/design-tokens.css` only when the target does not already have a semantic token layer.

The source applications remain the final visual reference when this package is used inside the original repository: `client/src/app/globals.css` and `protected/src/app/globals.css`. Do not copy those files wholesale into another project.
