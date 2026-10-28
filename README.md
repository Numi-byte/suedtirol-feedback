# Südtirol Feedback

Two independent Next.js applications backed by the same hosted Supabase Cloud project:

- `client/` — public feedback application on port 3000
- `protected/` — internal administration portal on port 3001
- `supabase/` — versioned database assets (migrations are planned for Phase 2)

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

## Checks

Run `npm run lint`, `npm run typecheck`, and `npm run build` from the repository root.

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
