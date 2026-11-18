# Südtirol Feedback

Two independent Next.js applications backed by the same hosted Supabase Cloud project:

- `client/` — public feedback application on port 3000
- `protected/` — internal administration portal on port 3001
- `supabase/` — versioned database assets (migrations are planned for Phase 2)

## Security

See [the security review and deployment checklist](docs/security/REVIEW.md) before deploying the hardened applications. The staff/photo-access migration must be applied first; production anti-abuse controls and capacity validation remain required.

## Requirements

- Node.js 20 or newer
- npm
- A hosted Supabase project (no local Supabase runtime is required)

## Setup

Install dependencies from the repository root:

```bash
npm install
npm install --prefix client
npm install --prefix protected
```

Copy `.env.local.example` to `.env.local` in **both** application directories and fill in the values from the hosted project's API settings:

```bash
cp client/.env.local.example client/.env.local
cp protected/.env.local.example protected/.env.local
```

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The publishable key is intended for application clients. Never add a database password or service-role key to either application.

Next.js reads each application's environment file when its development server starts. If either file is added or changed while `npm run dev` is running, restart the development server. The protected portal displays a setup prompt instead of failing when its Supabase configuration is absent.

When the protected development server is started without a `.env.local` file, its `predev` step copies `.env.local.example` automatically. The copy is never overwritten, so existing local credentials remain untouched. Review the generated file and restart the server after changing its values.

## Development

Start both applications together:

```bash
npm run dev
```

Or start them independently with `npm run dev:client` and `npm run dev:protected`.

| Application | URL |
| --- | --- |
| Public client | http://localhost:3000 |
| Protected portal | http://localhost:3001 |

The authenticated portal opens the feedback inbox at `/`. CSV/EFA imports are at `/stops`. Stop creation, the searchable database, archived stops, and stop/stop-point editing are together at `/database`. Selecting a result keeps its search and page numbers in the URL while opening the editor beside the list (below it on smaller screens). Saves report success or errors inline without redirecting or clearing fields, including unsaved changes in the other editor. Creating a stop selects the new record so the next save updates it. Archive/restore preserve the list context; old `/stops?stop=<id>` links redirect to the database editor. All three routes enforce staff authorization and load only the data for their section.

## User management

Only Auth user `bdee91d9-c969-4bd4-b336-8f7e780ead3e` can use `/users` to create accounts, change email/password, assign independent import/database/feedback permissions and deactivate portal access. Feedback access is off by default for new accounts. Apply the new migration and configure the protected app's private server key before enabling account creation; see [deployment and permission details](docs/security/USER_MANAGEMENT.md).

## Missing municipality names

At the bottom of **Datenbank verwalten**, filter missing municipalities or fill them from EFA stop IDs/municipality codes and the official bilingual ANPR reference. Existing translations are preserved; frazioni resolve to their comune. Apply the new municipality migration first. See [sources, safeguards and deployment](docs/features/MUNICIPALITY_BACKFILL.md).

## Checks

Run `npm run lint`, `npm run typecheck`, and `npm run build` from the repository root.

The editing browser regression runs Next.js against a synthetic local Supabase fixture; it never writes to the hosted project. With Playwright available to Node and Chromium installed, run:

```bash
CHROMIUM_PATH=/usr/bin/chromium node protected/scripts/database-editing.e2e.mjs
```

It checks create/edit, search and pagination retention, unsaved fields, failure/retry, archive confirmation/restore, legacy links, mobile scrolling, and denied non-staff access. Stop development servers before running a production build because they share `.next` outputs.

The public map API pages through all published, unarchived stops using a stable
ID order, so Supabase's response row limit cannot truncate the map. Only the
popular-stops sidebar is limited to five suggestions. Pagination regression tests:

```bash
node --test client/scripts/published-stop-pages.test.mjs
```

The public Stops directory searches the complete published dataset and renders
12 results per page to keep large lists responsive. Search matches all stop names
and both municipality languages. Stop points load when their card is expanded;
feedback, comments, and map links stay scoped to each point. Failed stop requests
show a retry control rather than a misleading empty-directory message.

The map groups nearby stop places into blue count circles; larger groups use
larger circles. Click a group or zoom in to reveal its stops (individual places
are shown from zoom 18). Stop-point/platform dots remain a separate layer for the
selected place and never contribute to group counts. A spatial index is reused
across pans and selections; only markers near the viewport are rendered.

```bash
node --test client/scripts/stop-clusters.test.mjs
```

## Stop-place CSV imports

Apply `supabase/migrations/20261007120000_import_latest_stop_place_versions.sql`
to the hosted project before deploying the updated importer. This adds
`id_version`, `publication_timestamp`, and the authenticated batch-import RPC.

The last column (`private_code`) identifies each stop. The importer selects its
newest `publication_timestamp` and stores the complete third field (`id_version`),
including commas inside CSV quotes. Newer records update existing stops while
preserving their UUIDs, feedback, municipality, accessibility, publication and
archive settings. The publication checkbox applies to newly inserted stops.
Older or identical timestamped records are left unchanged; invalid rows are
reported separately from unchanged or older stops, with all invalid-row details
available as a download. Coordinates support `(longitude,latitude)`, an empty
third field, or a numeric altitude such as `(longitude,latitude,0)`; altitude
is not used by the map. Stops missing one translated name use the other available name.

Upload the CSV again through the protected portal after applying the migration.
No previously imported stop needs to be deleted. If a batch fails, the import
reports how many stops were saved before the failure, and retrying is safe.

Parser regression tests (Node.js 22.18+ or 24) run with:

```bash
node --test protected/scripts/stop-place-csv.test.mjs
```

## EFA stop-place import

Apply `supabase/migrations/20261015120000_import_efa_stop_places.sql` after the
existing migrations, then apply
`supabase/migrations/20261016120000_complete_efa_stop_place_import.sql`
(the follow-up is required even if the initial EFA migration was already applied).
In the protected portal's **Stop places** import section,
use **Fetch and import EFA stop places**. The protected server needs HTTPS access
to `efa.sta.bz.it` as well as the configured Supabase project. No EFA key is needed.

The importer fetches the complete rapidJSON stop list and processes every entry whose full ID starts with `it:22021:`.
It does not restrict the ID suffix to digits or impose an additional type filter. For example, `it:22021:2139`
becomes `(it:apb:StopPlace:it:22021:2139,any)` in `bus_stops.id_version`.
`properties.stopId` is stored separately in `stop_id`; `coord[0]` is latitude
and `coord[1]` longitude. Additional coordinate dimensions are ignored.
A numeric `stopId` is stored as text; a missing `stopId` is left null instead of
discarding an otherwise valid place. Different complete IDs are not discarded
just because they share this additional metadata. New records leave the CSV
private `stop_code` blank. Only the main Italian name is imported. New records
have empty German/English names and municipality; parent names are not imported.

Every imported stop is set to **unpublished**, including existing matches.
Existing German/English translations, UUIDs, feedback, stop points, private stop
codes, CSV timestamps, municipality and archive settings are retained. Matching
uses the complete source reference (ignoring version). Matching by `stop_id`
or private code is only used for legacy rows without a source ID; distinct full
source IDs are never merged based on stopId. Identical feed duplicates are removed.
Conflicting duplicate feed IDs are reported without blocking unrelated places.
Each database batch is atomic. A row conflict triggers individual retries of that
batch so the rest of the API list still imports. Network, authentication and
schema errors stop the run and report completed work. Retrying is safe.

The result shows API records received, matching IDs, saved places and duplicate
counts. Any invalid/conflicting records are flagged as an incomplete import, with
a downloadable report containing all affected IDs. The portal loads the entire
database across Supabase response limits and displays ten stops per UI page.

Run `node --test protected/scripts/efa-stop-places.test.mjs protected/scripts/efa-import-batches.test.mjs`
for mapping, multi-batch and listing regression tests.

## Stop-point CSV imports and map dots

Apply `supabase/migrations/20261007130000_link_stop_points_to_places.sql` after
the stop-place import migration. It creates `stop_points`, the staff import RPC,
and a public read RPC that only returns points of published, unarchived places.

In the protected portal, switch the import toggle from **Stop places** to
**Stop points** and upload a `.csv` file. The first row must have
these headers in row 1 (their order may vary):

```text
id_version,point_number,latitude,longitude,name_de,name_it
```

Quote identifiers containing commas, for example
`"(it:apb:ScheduledStopPoint:it:22021:468:1:5352,any)"`.

For example, `(it:apb:ScheduledStopPoint:it:22021:468:1:5352,any)` and
`(it:apb:ScheduledStopPoint:it:22021:468:1:2805,any)` both link to the place with
identifier `(it:apb:StopPlace:it:22021:468,any)`. Matching uses the complete source
reference, excluding its version, rather than a partial match on `468`.
Stop places must be imported first. Points with missing or ambiguous parents
are reported in the result and a downloadable issue file. Re-uploading updates
the same point without duplicating it. With no timestamps in this CSV,
the last row for a repeated point reference wins.

Selecting a stop place on the client map loads only its linked points and shows
them as blue dots. Hovering or focusing a dot shows its name and point number.
Switching places removes the previous dots. CSV files are parsed in the
browser; only normalized point records are sent in batches of at most 250.

```bash
node --test protected/scripts/stop-place-csv.test.mjs protected/scripts/stop-point-csv.test.mjs
```

## Public submission capacity and safety

Feedback is submitted from each visitor's browser directly to the transactional
`create_feedback_report` Supabase RPC. Optional photos are also uploaded directly
to the private storage bucket and registered only after a report exists. As a
result, a short burst of public submissions does not funnel large multipart bodies
through the Next.js server or hold their files in application-server memory.

The database RPC and storage policies remain the security boundary: they validate
published stops, category and severity values, upload type and size, and the
report-owned storage path. The browser additionally prevents duplicate clicks,
checks the photo before making any request, and shows a recoverable error instead
of replacing the page with a server error.

### Feedback and comments for individual stop points

Apply `supabase/migrations/20261019120000_stop_point_feedback_and_transport.sql`
**before deploying both updated apps**. It requires all previous migrations.
The migration adds a point reference to feedback, enforces the matching parent
place, and exposes point-specific submission, lookup, and discussion RPCs.
The old place-only submission/discussion RPCs are disabled. Visitors with an
old feedback URL are returned to the map to choose a point; cached older
clients must refresh after rollout.

Existing reports keep their original place reference and an empty point
reference. They remain reviewable and replyable in the protected inbox, marked
as historic place feedback. They are not assigned to any point's public thread.
Reports and their replies are retained when points/places are retired.

Every existing and newly imported point defaults to `bus`. In the protected
portal, select a place, then use **Edit stop points** to choose Bus, Train, or
Cable car for each point. Re-importing points preserves these choices. Public
point lists show the transport icon; map point tooltips identify the point by
name and number. Each point has its own feedback and comment links. A place
without imported points offers no point-feedback submission.

Run the database checks against a disposable PostgreSQL container with Docker:

```sh
supabase/tests/run-stop-point-feedback.sh
```

This applies all migrations and checks point isolation, public/private reads,
publication and archive rules, transport defaults and re-imports, atomic report
creation, reply scoping, report retention, and the historic feedback workflow.
It never connects to the hosted Supabase project. `supabase/tests/bootstrap.sql`
provides minimal Auth/Storage stubs for the isolated tests only.

### Structured feedback dataset for official testing

After all earlier migrations, run
`supabase/migrations/20261020120000_capture_structured_test_feedback.sql` in the
Supabase SQL Editor. Applying it activates capture immediately; a Git push alone
does not apply database migrations. No client or protected-app deployment is needed.

The new `public.feedback_test_results` table starts empty and records one row for
each **new** feedback submission. Existing feedback is never copied, including
when an older report is edited or answered. Each row contains the submission time,
language, severity, selected issue codes and labels in German/Italian/English,
and a snapshot of the selected stop point and its parent place: identifiers,
names, municipality, transport type, and the point's coordinates.

The dataset excludes descriptions and other visitor-written text, emails,
contact preferences, photos, replies, and visitor/account identifiers. The internal
feedback UUID remains for deduplication and can be linked to the original report
by an authorized administrator. The original private feedback/contact workflow
continues separately.

Capture runs in the submission transaction, after its category links have been
inserted. If capture fails, the entire submission rolls back rather than silently
losing its test record. Application users cannot insert, edit, delete, or truncate
test results. Public visitors cannot read them; authenticated portal staff have
read-only access, consistent with the existing staff authorization model.
Database administrators can inspect/export the table in Supabase Table Editor or
SQL Editor, for example:

```sql
select submitted_at, stop_place_name_it, stop_point_number, transport_type,
       category_labels_de, severity, language
from public.feedback_test_results
order by submitted_at desc;
```

Names, coordinates, and issue labels are frozen at submission time. Changes to,
or deletion of, the source feedback, stops, points, or replies do not change or
delete the saved test results. The table deliberately has no source foreign keys.

To end/pause the official testing phase without interrupting normal submissions,
run this as a database administrator:

```sql
alter table public.stop_feedback disable trigger capture_structured_test_feedback;
```

To resume capture of future submissions:

```sql
alter table public.stop_feedback enable trigger capture_structured_test_feedback;
```

Neither action deletes results or backfills submissions made while capture was
paused. Capture uses a deferred constraint trigger; keep it deferred until the
submission RPC has inserted its category links (the normal PostgREST RPC
transaction already does this).

Run the dedicated integration suite against disposable PostgreSQL 17 with Docker:

```sh
supabase/tests/run-feedback-test-results.sh
```

It seeds feedback before applying the capture migration, then checks the activation
boundary, complete snapshots, excluded private data, staff-only read access,
write protection, transaction rollback on capture failure, transport types,
frozen history, pause/resume, and retention after deleting source records.
It never connects to the hosted Supabase database.

### German and Italian municipality names

Apply `supabase/migrations/20261022120000_bilingual_bus_stop_municipalities.sql`
in the Supabase SQL Editor **before deploying either updated app**. It adds
`municipality_de` and `municipality_it` to `bus_stops` only and extends the public
stop and point lookup RPCs to return those parent-place fields. No municipality
columns are added to `stop_points` or the frozen testing dataset.

Both municipality names are required when creating or saving a stop in the
protected portal, with browser and server validation. Database constraints allow
either two nonempty names or two empty fields for imports awaiting completion.
CSV and EFA imports can continue without translations; reimporting a stop keeps
municipality translations already entered by staff.

Existing `municipality` values are retained as a display fallback. Their language
is unknown, so the migration does not copy them into either translation field.
Complete both fields manually when editing an existing or imported stop. The
portal also writes the Italian name to the legacy `municipality` field for
compatibility with older consumers and the existing feedback snapshot format.

The map, stop list, feedback form, and portal show the German name in German and
the Italian name in Italian or English. If translations are missing, the other
available name or legacy value is shown. Searches match both translations and
the legacy value. Historical feedback snapshots are not rewritten.

Checks:

```sh
node --test shared/municipality.test.mjs protected/scripts/portal-pagination.test.mjs
supabase/tests/run-stop-point-feedback.sh
supabase/tests/run-feedback-test-results.sh
```

### Feedback form management

Apply `supabase/migrations/20261111120000_manage_feedback_form.sql` in the
Supabase SQL Editor **before deploying both apps from the same branch**.
It depends on the preceding migrations. No existing report or photo is deleted;
photos initially remain enabled with the existing 10 MiB limit. No new
credentials or storage buckets are needed.

The designated owner (`bdee91d9-c969-4bd4-b336-8f7e780ead3e`) gets **Feedback
verwalten / Configura feedback / Manage feedback** at `/feedback-settings`.
The owner and users explicitly granted **Manage feedback** can:

- Enable/disable photo uploads and choose a maximum size of 1–10 MiB. Both the
  public form and the backend enforce the current policy. JPEG, PNG and WebP are
  allowed; existing photos remain readable to authorized feedback staff.
- Add/edit categories with required German, Italian and English labels, change
  their order, and deactivate/reactivate them. Keys are permanent. Deactivation
  removes a category from new submissions without breaking historical reports.
  At least one category must remain active; there are at most 30 active and 50
  total definitions, including retired ones. Category labels, including retired
  labels, remain public for anonymous discussion history; they are not drafts.
- Assign or remove an SVG icon. Source files are limited to 16 KiB, basic paths
  and shapes, 64 shapes/groups and eight nesting levels. Colours are normalized
  to `currentColor` and the viewBox fits the same 24px icon layout. Scripts,
  event handlers, CSS, text, HTML, images, external references, filters,
  animation and DTD/entities are rejected. Only validated shape JSON is saved
  and rendered, never raw SVG markup or a publicly served uploaded SVG file.
  Categories without an upload use an existing built-in icon or a neutral
  information icon.

Access is checked by the route, every Server Action, and the database RPCs.
The owner grants **Manage feedback** independently in User Management; it is
off by default. Stop, database and inbox permissions do not imply configuration
access. Feedback management does not grant access to private reports or user
management. Revocation and account deactivation apply to existing sessions. Configuration changes are serialized and audited without passwords,
report contents or SVG source. Public configuration reads expose only the
settings and category definitions.

The form rechecks configuration before sending. If a selected category has been
retired or an attached photo no longer meets policy, it retains the rest of the
form and asks the passenger to review and send again. Database checks also reject
outdated direct API calls. A policy change during the subsequent photo upload
can reject that photo; the saved report is retained and the acknowledgement
shows the existing upload warning. Submission-time test snapshots keep their
original category labels; portal/public history and acknowledgement text use
current configured labels.

Local verification (never writes to the hosted database):

```sh
node --test protected/scripts/*.test.mjs shared/*.test.mjs client/scripts/*.test.mjs
supabase/tests/run-security-boundaries.sh
DOCKER_HOST=unix:///var/run/docker.sock supabase/tests/run-stop-point-feedback.sh
DOCKER_HOST=unix:///var/run/docker.sock supabase/tests/run-feedback-test-results.sh
CHROMIUM_PATH=/usr/bin/chromium node protected/scripts/database-editing.e2e.mjs
CHROMIUM_PATH=/usr/bin/chromium node client/scripts/feedback-settings.e2e.mjs
npm --prefix client run build
npm --prefix protected run build
```

The PostgreSQL tests check Storage bucket limits and registration metadata; they
do not emulate Supabase Storage's HTTP size enforcement. The public browser test
uses an HTTP fixture and bypasses CSP in that test browser only; application CSP
remains unchanged. Verify an actual upload on a preview after applying the
migration, including a file just above the chosen size limit.


### Visual category ordering and delegated feedback management

Apply `supabase/migrations/20261111143000_feedback_order_and_permissions.sql`
**after** `20261111120000_manage_feedback_form.sql` and **before deploying the
updated protected app**. Existing members receive no new permission by default.
Only the fixed owner can grant **Manage feedback** through User Management,
when creating an account or editing an existing account. It can be the user's
only section. The owner retains all rights, including exclusive user management.
The earlier five-argument permissions RPC is retained for older deployments and
preserves the new permission rather than silently clearing it.

Numeric category-position fields are replaced by **Adjust order**. Its popup
uses the existing colours, typography and rounded controls. Users can drag by a
handle with a mouse/touch, use up/down buttons, or use arrow keys, Home and End
on the handle. Disabled categories are labelled and included so their position
is defined when reactivated. New categories append automatically; ordinary
label/icon edits preserve the latest saved order.

- **Save** writes the whole order in one transaction and closes the popup.
- **Reset** restores the order from when the popup opened, without a write.
- The top-right **X**, Escape and clicking the backdrop discard unsaved moves.
- If another person saves an order or adds a category meanwhile, the save is
  rejected. Reopening loads the current order. Saving locks configuration edits
  briefly, validates a complete permutation, and records one audit event.

The SVG guidelines appear above the category creation and editing sections.
They describe the enforced 16 KiB source limit, 64 shapes/groups, eight nesting
levels, proportional 24px monochrome display, and unsupported active/external
content. The upload sanitizer and database icon checks remain in effect for
users with delegated access.

`supabase/tests/run-security-boundaries.sh` includes permission isolation,
self-escalation and revocation checks, invalid/stale reorder rejection, and
preservation of order when editing categories. The portal browser suite covers
mouse/touch/keyboard movement, Reset/X/Escape, saving, concurrent changes, mobile
layout, unsaved-field retention and granting/revoking the new permission.

### Reply permission under Feedback

Apply `supabase/migrations/20261111160000_feedback_reply_permission.sql` after
all preceding migrations, before deploying the updated protected app. User
Management now nests **Reply to feedback** beneath the inbox permission.
Only the owner may grant it; new accounts default to no reply access. Removing
inbox access clears the reply permission, and deactivation overrides both.
The owner retains reply access. The formerly designated responder retains it
where an existing membership already permits inbox access.

Reply controls and Server Actions query the current database permission; the
reply RPC enforces the same requirement. Existing replies remain visible to
inbox readers and remain published when a responder loses access. Legacy
permission-update RPCs preserve the child grant while retaining inbox access
and clear it when removing that parent. No additional private key is needed.

### Change your own password

Every active portal account can open `/account/password` through the header's
password icon, the mobile menu or the footer, without User Management access.
The page follows the portal design and supports German, Italian and English.
It requires the current password, a different new password (12–1024 characters)
and confirmation. A separate non-persistent Supabase Auth client verifies the
current password and matching user ID, then discards its temporary session.
The existing signed-in client updates only its own password. No Auth Admin key,
user-ID form parameter, migration or email recovery redirect is used. All
password inputs are cleared after an attempt; errors never echo credentials.
This is a signed-in password-change flow; forgotten-password assistance remains
available through the account owner.
