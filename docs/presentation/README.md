# System architecture for a non-technical audience

Four English slides, in 16:9 format, using the application's blue palette.

- `system-architecture.pdf`: vector PDF with selectable text, suitable for presenting or printing.
- `slide-1.png` through `slide-4.png`: 2400 × 1350 images for PowerPoint, Keynote or other slide tools.
- `presentation-images.zip`: all four PNG slides.
- `generate.py`: editable source; run with Python and ReportLab. It uses the system DejaVu Sans fonts.

## Suggested speaking notes

1. **One system, two ways to use it.** Passengers use the map and feedback form. The team uses a separate protected portal. Both work with the same shared information, but passengers receive only the public portions. Stop imports are initiated by staff; the arrows illustrate information exchange, not individual network requests.
2. **From observation to response.** The passenger selects a particular boarding point, reports an issue, and the team reviews it. Staff with the separate reply permission can publish an answer. Public posts show categories, dates and staff replies; report descriptions, photos and optional contact details stay private.
3. **Access in layers.** Vercel's IP rule guards the protected portal URL, personal accounts identify staff, and the data service enforces their task permissions. The network restriction does not itself apply to Supabase's separate API: data permissions provide that service's security boundary. Permissions can be combined; only the fixed owner manages accounts and grants access.
4. **Current map, retained history.** Staff import, enrich and publish the stop catalogue. Archiving places or retiring categories retains report history. While capture is enabled, official-testing snapshots retain submission-time stop/category information without copying report text, photos or contact details.

## Scope and verification

The content follows the repository's implemented architecture and the user's statement that Vercel Custom Rules restrict the protected portal to approved networks. Live hosting settings and whether every migration is deployed were not independently audited for this presentation. Do not describe the slides as a production security certification.

References: root `README.md`; protected portal pages and permission helpers; migrations for stop-point feedback, private photo uploads, official-testing snapshots, category configuration, reply permissions and user management.

Regenerate the exports from the repository root:

```sh
python3 docs/presentation/generate.py
pdftoppm -scale-to 2400 -png docs/presentation/system-architecture.pdf docs/presentation/slide
```
