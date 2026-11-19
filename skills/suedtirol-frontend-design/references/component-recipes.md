# Component recipes

## Buttons

Primary buttons are blue, white text, 48–56px high, bold, and pill-shaped. Secondary buttons use a white surface, blue text, and a border. Quiet/icon buttons use transparent or tinted backgrounds. Disabled state reduces opacity but retains its shape. Never communicate destructive intent by color alone; use a clear verb and confirmation.

## Forms

Place visible labels above fields. Inputs are at least 48px high with 16px radius and 12px × 16px padding. Pair help text with the field using `aria-describedby`. On focus, change the border and retain the global 3px focus ring. Group two fields on desktop only when their relationship is obvious; stack them on mobile.

Save feedback must not unexpectedly reset page state, search, pagination, or expanded cards. Use local pending and success states when the framework permits.

## Cards and disclosures

Cards have a strong title region, optional supporting copy, and clear actions. Repeated editable cards can expose secondary fields with native `details` and `summary`. Keep the disclosure arrow aligned to the title's right edge, expose `aria`/native state, and preserve a 44px target.

## Modal dialog

Prefer native `dialog` where supported. Required behavior:

1. The trigger has `aria-haspopup="dialog"`.
2. `showModal()` opens it and focus moves to a useful control.
3. The header contains a linked title and top-right close button.
4. Escape cancels; safe backdrop clicks cancel.
5. Body scrolling is contained inside the dialog and document scrolling is locked.
6. Cancel/close discards the draft. Reset restores the initial draft. Save is explicit.
7. On close, focus returns to the trigger.
8. Pending operations prevent accidental dismissal when interruption would be unsafe.

Use a maximum width around 740px, 32px radius (24px mobile), and a maximum height around 90dvh. The footer holds Reset/Cancel as secondary and Save as primary.

## Navigation

Desktop public navigation uses 56px pill-shaped items with subtle tinted hover. The main call to action is filled blue. Portal navigation can carry more links but must keep the active page visible with `aria-current="page"`. On mobile, use a proper modal menu with focus management, Escape handling, scroll locking, and full-width link rows.

## Search

Search is a rounded white field within a tinted grouping surface. Include an icon, a real label (visually hidden only when surrounding context is sufficient), a clear control with an accessible name, immediate result count, empty state, and stable loading state. Search must tolerate diacritics and translated content when the target application supports them.

## Status, feedback, and loading

- Status badges: short, rounded, high-contrast text plus a written status.
- Empty state: bordered or tinted card with explanation and one useful action.
- Skeleton: match the eventual card geometry and avoid layout shift.
- Spinner: accompany it with visible or screen-reader text and `aria-busy`.
- Save success: `role="status"`; error: `role="alert"`.
- Respect reduced motion.

## Header and footer

Use a white sticky header with a subtle divider/shadow. Preserve brand clear space and do not distort logos. The full footer uses a light-gray canvas, generous 80px top spacing on desktop and 40px on mobile, company/navigation columns, then a lower legal/language/brand row. A compact map footer may condense content but must reuse the typography, lower-line background, and spacing of the full footer.

## Login

Desktop login is a split composition: a dark/photo introduction panel and a centered white form card. Use 48px radii and enough contrast over imagery. Collapse to a single-column layout at smaller widths; content and authentication errors remain fully visible. Never add security claims or access wording the product does not actually enforce.

## Data-heavy portal pages

Group editing and list regions in separate bordered cards. Keep search/filter state stable after local edits. Use compact badges, metadata, and pagination without shrinking controls below 44px. If a table does not fit mobile, choose a deliberate card layout or labeled horizontal scroll—never clip values.
