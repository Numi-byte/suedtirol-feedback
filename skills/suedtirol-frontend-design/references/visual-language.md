# Visual language

## Character

The system is calm, civic, trustworthy, and approachable. It combines generous white space and rounded geometry with highly legible controls. Public surfaces are slightly more expressive; protected management surfaces are compact but never cramped.

## Semantic palette

Use semantic roles instead of binding components directly to hex values.

| Role | Default | Use |
| --- | --- | --- |
| Action | `#007eb5` | Primary buttons, selected controls, links |
| Action hover | `#006a99` | Primary hover/pressed state |
| Action deep | `#055a81` | Headings, high-emphasis blue text |
| Heading | `#0f2733` | Strong public headings and card titles |
| Portal heading | `#2a424d` | Dense administrative headings |
| Text | `#4b6673` | Body copy |
| Muted | `#64818f` | Metadata and supporting labels |
| Tint | `#ecf6fa` | Selection, soft information surfaces |
| Canvas | `#f5f8fa` | Portal/page background |
| Border | `#dbe6ef` | Dividers and surface boundaries |
| Success | `#2f8f5b` | Confirmed/success state |
| Warning | `#efa51b` | Attention state |
| Danger | `#9b2f22` | Errors and destructive actions |

White remains the primary surface. Do not turn every region blue. Tint is for grouping and interaction feedback, not decoration.

## Typography

- Preferred humanist sans: Frutiger when licensed. Fallback: `Segoe UI`, `Helvetica Neue`, Helvetica, Arial, sans-serif.
- Preferred rounded display: Ely Rounded when licensed. Fallback: `Segoe UI Rounded`, `Segoe UI`, sans-serif.
- Public hero/title: display face, 48–80px, line height 1–1.16, weight 700, slight negative tracking.
- Portal page title: display face, 48/56px; reduce with `clamp()` on narrow screens.
- Card title: display face, 24–32px with 32–40px line height.
- Body: 16px with 24–26px line height.
- Label/meta: 14px with 20–22px line height.
- Eyebrow: 14/20px, weight 700, uppercase, `.08em` tracking. Use sparingly.

Long words, identifiers, and multilingual labels must wrap rather than overflow. Do not depend on English label lengths.

## Spacing and geometry

- Base rhythm: 8px.
- Inline micro-gaps: 4, 8, 12px.
- Control and form gaps: 16px.
- Card internal spacing: 24px mobile, 32px desktop.
- Section spacing: 40–80px depending on hierarchy.
- Cards: 24–32px radius; feature/login surfaces may use 48px.
- Inputs: 16px radius.
- Pills and primary actions: 32px radius.
- Compact badges: 16–24px radius.
- Hairline border: 1px cool gray.
- Standard content max width: 1200px; broad application shell: 1600px.

## Layout

Public shells use a 96px desktop header and broad responsive side padding. Portal content uses a centered 1600px shell, 32px desktop padding, and 16px mobile padding. Two-column grids use `minmax(0, …)` to prevent overflow and collapse to one column around 900–1100px based on content.

Do not force desktop density onto mobile. Toolbars wrap; tables become cards or receive an intentional scroll container; fields stack; critical actions expand to the available width.

## Surfaces and elevation

Cards are white with a cool-gray 1px border. Use tinted backgrounds for selected, informative, or grouped content. Standard cards need no shadow. Sticky headers use a subtle divider plus low shadow. Dialogs may use `0 24px 100px rgb(0 43 77 / 20%)` and a dark translucent backdrop.

## Motion

Motion communicates state, not personality. Use 150–200ms ease transitions for hover, disclosure, or dialog entry. Disable nonessential animation under `prefers-reduced-motion: reduce`. Never make access to information depend on animation completing.

## Public and portal differences

Public pages can use larger titles, photographs, spacious content sections, prominent calls to action, and richer footers. Portal pages use the same colors and radii but stronger information hierarchy: page heading, bordered work cards, clear form labels, compact status badges, and persistent navigation. They must feel related, not identical.
