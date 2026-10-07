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
