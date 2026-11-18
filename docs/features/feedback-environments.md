# Feedback environments, dataset versions and campaigns

The feature activates **per physical Supabase project**. Applying the migrations does not classify the existing project, publish data, start campaigns, backfill provenance, schedule cleanup or delete records. Infrastructure provisioning and hosted migration execution remain operator actions.

## Physical boundaries

Use separate Supabase projects for production, staging and testing, each with its own client/protected Vercel deployments, Auth accounts, permissions, Storage and private keys. A preview using the production Supabase URL is not an isolated test environment.

Each database has exactly one `feedback_environment` identity. Owner initialization permanently fixes its type and project reference. Operational foreign keys carry this identity, including exact point-to-place and report-to-point/place relationships. Campaigns and dataset/form versions are also scoped to that environment. Historical evaluation rows retain unknown provenance as NULL.

Both apps send deployment-configured `x-feedback-environment` and `x-feedback-project` headers. After initialization, PostgreSQL checks them alongside the user's current permissions. Headers select a boundary; they do not grant permissions. Server actions compare submitted identities with the fixed deployment identity. Cookies, URLs and form fields cannot select another backend. A database copied to another project fails the project-reference binding: do not clone production into testing.

Supabase Storage uses a separate database context and does not promise PostgREST's `request.headers` setting. Its access is authorized by this physical project's signed JWT and local inbox grant, or the exact upload capability issued for a report in this environment. When a PostgREST context is present, mismatched environment headers are still rejected. This keeps ordinary photo uploads and private signed URLs compatible without trusting a client-supplied environment as permission.

The optional environment navigation opens independently authenticated portals. It forwards no session, tokens, keys or accounts.

## Staged rollout and preservation plan

1. **Inventory and back up.** Use the project's normal database and private Storage backup procedures. Record counts of `bus_stops`, `stop_points`, `stop_feedback`, `feedback_replies`, `stop_feedback_photos`, `feedback_upload_capabilities` and `feedback_test_results`. Save an evaluation copy before infrastructure changes. If the existing database mixes testing and real reports, review ownership manually. Dates, comments and stop names are never used to guess assignments.
2. **Apply the complete additive migration set**, after existing migrations and before deploying these app changes:
   - `20261118140000_feedback_environment_foundation.sql`
   - `20261118143000_feedback_campaigns_and_versions.sql`
   - `20261118150000_feedback_exports_cleanup_and_publication.sql`
   - `20261118153000_feedback_export_audit.sql`
   - `20261118160000_feedback_runtime_lock_order.sql`
   - `20261118163000_feedback_storage_context.sql`

   Use a maintenance window: new indexes, composite foreign-key validation and column changes take database locks. Recheck the inventory counts. Existing databases stay `unconfigured` with legacy submission/visibility behavior until explicitly initialized. Operational rows receive only their current physical project's boundary identity. Historical evaluation environment/campaign/dataset/form fields remain NULL. Existing reports, replies, photos and public reply bodies are preserved. Nothing is deleted or retroactively captured.
3. **Provision physically separate projects and deployments.** Decide explicitly which project holds production. Retain real operational records there. Populate fresh non-production projects from stop source files/EFA using the existing imports; copy neither production discussions/contact details nor membership grants. Run all migrations on each project. Provision the fixed owner UUID `bdee91d9-c969-4bd4-b336-8f7e780ead3e` in each project's Auth using the private supported Auth Admin `createUser({ id, email, password, email_confirm: true })` API, with separate credentials. Do not insert directly into Auth tables. Grant staff rights separately through each portal's User Management.
4. **Bind both deployments before initialization.** Read the identity with this read-only SQL:

   ```sql
   select id, kind, label, project_ref from public.feedback_environment;
   ```

   Configure and rebuild **both apps** for that environment:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PROJECT_PUBLISHABLE_KEY
   NEXT_PUBLIC_FEEDBACK_ENVIRONMENT_ID=UUID_FROM_THIS_DATABASE
   NEXT_PUBLIC_FEEDBACK_PROJECT_REF=YOUR_PROJECT_REF
   ```

   Hosted project references are also derived from the actual URL and must match. Local/self-hosted deployments must specify the reference explicitly. Never reuse production build-time values in a testing/preview deployment.
5. **Initialize as owner** in Feedback Management → Environments & campaigns. Initialization is disabled until the deployment identity matches. Choose the type deliberately. Older/unbound app builds then lose access. Public queries/submissions are paused until a dataset or campaign is activated; prepare and activate the first version before directing visitors there.
6. **Exercise testing first.** Save a dataset version, create/activate a campaign, submit a report, verify all snapshot tags and hidden discussion, close the campaign, export evaluation results, confirm the saved CSV as owner, and schedule a small cleanup. Verify actual Storage removal and retained snapshots before routine scheduling.
7. **Publish production as owner.** Prepare stops using the existing database/import screens, save a named version, and publish it with the current form version. Review legacy discussions manually if needed. Deploy the production client/protected pair together after staging verification.

During the additive/unconfigured stage, app rollback can leave the additive schema intact. **After initialization, an older app build is intentionally blocked.** Pause production publication or close the campaign and fix forward with a compatible build. Do not disable boundaries, remove snapshots or reset the identity as a rollback shortcut. Restore backups only into their original boundary or an isolated recovery project never connected to a public deployment.

## Optional environment navigation

Set `FEEDBACK_ENVIRONMENT_PORTALS` only in protected server settings:

```json
[
  {"id":"11111111-1111-4111-8111-111111111111","kind":"production","label":"Produktion","project_ref":"production-project","url":"https://production-portal.example.org"},
  {"id":"22222222-2222-4222-8222-222222222222","kind":"testing","label":"Testing","project_ref":"testing-project","url":"https://testing-portal.example.org"}
]
```

IDs, project references and HTTPS origins must be distinct. Configure origin-only URLs; the app supplies the management path. Missing navigation links do not weaken the local database boundary.

## Versions and lifecycle

- Dataset versions freeze active stop places and linked points, including publication flags and bilingual names. Immutable snapshots do not depend on mutable source rows. JSON downloads contain stop data without reports, staff grants or credentials. They are backup/review files; existing CSV/EFA imports populate another environment.
- Activation applies a saved version atomically. Excluded places are archived, never deleted. Excluded points remain linked to historical reports but disappear from public lookup/search. A conflicting historical parent relationship fails and rolls back activation.
- Published stop data and form configuration are frozen. Close the campaign or, as owner, pause production publication before editing, then save another version. A version publishes its stored flags: mark desired stops for publication before taking the snapshot. Production preparation/publication is owner controlled.
- Non-production campaign lifecycle is **draft → active → closed → archived**; a draft can also close unused. Only one campaign is active. Database start/end checks stop submissions outside the window, even before manual closure. Cleanup is scheduled after closure/export; campaign end never silently deletes anything.
- Each campaign binds one dataset and form version. A form changed since drafting requires a new campaign. All UI-created campaigns require an evaluation export. Only the owner can waive this requirement through the backend.
- Submission-time provenance is bound in the database transaction. Stale form/campaign/version context is rejected and the public form asks for review. Production reports carry dataset/form versions but do not enter the test evaluation table.
- The deferred snapshot trigger captures structured results and translated category labels atomically. A separate append-only submission ledger records expected capture. Capture failure rolls back submission; disabled capture prevents test submissions; incomplete capture blocks cleanup.
- Historical results appear under Evaluation → Unassigned historical results. Unknown provenance stays blank. Exclusion/reinclusion annotations require a reason, are stored separately and audited, and never rewrite snapshots.

Managed stop-list caches include environment/dataset identity and check that identity before/after pagination. Managed deployments do not serve a stale CDN list from a prior version. A previously open map/form cannot bypass a closed campaign.

## Evaluation and operational CSVs

Evaluation CSVs read immutable `feedback_test_results` plus separate exclusions. They include every result in the selected campaign, including excluded results, original labels and version IDs. Unknown legacy provenance stays blank and is labeled `historical_unassigned`. Report descriptions, contact details, photos and reply bodies are absent.

Operational CSVs remain on the feedback/stop-place/stop-point pages. Campaign operational links restrict reports/replies to that campaign. They contain current private report fields, reply drafts/approved reply fields, status/visibility and potentially personal information. Section permissions and private/no-store responses apply. An operational download never satisfies the evaluation export requirement.

Evaluation generation records a receipt and SHA-256 digest. All pages are prepared before offering a file. Query/time/size/count/fingerprint failures mark the attempt failed or leave it pending/unconfirmed; either blocks required cleanup. The **latest** attempt must succeed, match current results/exclusions and be confirmed by the owner after saving/checking the CSV. HTTP cannot prove that a file was saved, so generation alone is insufficient. A later submission, exclusion change or failed export invalidates older confirmation. Save evaluation files externally according to the evaluation's retention requirements.

CSV generation is bounded to 100,000 rows, 32 MiB and 40–45 seconds, with streamed responses. Dataset snapshots accept up to 20,000 places and 100,000 points; JSON export is bounded to 16 MiB and 100,000 rows per entity. Oversized evaluation campaigns cannot pass the required export gate through this bounded UI; plan campaign sizes accordingly rather than expecting a partial export to authorize cleanup. Failures return errors, not partial successful downloads. Receipts/audit survive campaign cleanup. Operational exports remain current reads across pages; evaluation export fingerprints detect concurrent result/annotation changes.

## Scheduled cleanup

Only the owner can schedule/cancel/reschedule cleanup, after reviewing counts, entering the exact campaign name and choosing a time at least 15 minutes ahead. A job names one closed/archived campaign in the local staging/testing project. Untagged/historical records are ineligible.

Configure private **protected server** settings only where cleanup should run:

```dotenv
SUPABASE_SERVICE_ROLE_KEY=PRIVATE_KEY_FOR_THIS_NON_PRODUCTION_PROJECT
CRON_SECRET=RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS
```

When ready, schedule an authenticated GET to `/api/maintenance/feedback-cleanup`, e.g. with Vercel Cron. Add this to that protected deployment's Vercel configuration, adjusting frequency to the plan:

```json
{"crons":[{"path":"/api/maintenance/feedback-cleanup","schedule":"0 * * * *"}]}
```

Vercel sends `Authorization: Bearer <CRON_SECRET>`; external schedulers must do the same. Missing/short secrets are rejected. Worker RPCs are granted only to `service_role`; normal owner/staff JWTs cannot invoke them. The worker cannot create authorization jobs or choose a different backend. Check that the protected IP firewall allows the scheduler to reach this path; the application secret remains required. No hosted scheduler is enabled by this commit.

Execution rechecks environment, closure, capture health, complete snapshots and current required export confirmation. The worker claims a short lease, hides campaign discussions and revokes upload capabilities. Consistent transaction locks order submissions, capability checks, registration and cleanup. Before removing any files, cleanup waits at least two minutes for in-flight uploads to settle; actual continuation also depends on the scheduler interval/lease expiry. New exports and exclusion changes are frozen during running cleanup. Retained submission receipts and revocation timestamps act as tombstones: a Storage metadata trigger rejects late inserts/moves for revoked campaign report paths, including after operational report deletion and even for an internal Storage writer. The trigger does not delete or modify unrelated Storage data.

Registered and unregistered uploaded photos are removed through the Storage API in bounded batches. The application never deletes `storage.objects` via SQL. Only after Storage is empty for that campaign does one transaction delete its reports and cascade replies/photo metadata/category links. Snapshots, exclusions, submission receipts, versions and audit remain. Failed Storage/DB operations retain results and mark the job failed for owner review/rescheduling; already-removed photos stay removed. Large jobs resume after lease expiry. Concurrent workers cannot share an unexpired lease.

Production rejects campaign cleanup and direct/cascaded report deletion. Age reminders never delete records or automatically change status/visibility. A production personal-data retention policy would require a separate reviewed feature.

## Moderation, permissions and audit

The inbox's Status & visibility popup uses the existing design. Status (`new`, `in_review`, `resolved`, `dismissed`), internal resolution notes and visibility (`hidden`, `pending`, `published`) are independent. New production reports await approval; test discussions start hidden. Status changes preserve reviewer metadata. A verification reminder becomes due after 90 days; marking verified starts another 90 days.

Inbox rights permit moderation. The existing subordinate reply right controls drafting. Production reply edits retain the previous approved public body until owner approval. Moderators can hide content; only the owner can publish production discussions, replies and datasets. Public APIs/counts include only published discussions and approved reply text. Feedback Management permits campaigns, evaluation exports and reasoned exclusions; saving or downloading full stop datasets additionally requires Database Management. Dataset metadata remains available for campaign selection. Destructive operations require the owner. These permissions are enforced by PostgreSQL and the backend.

`feedback_management_audit` records environment, actor, action, identifiers and safe metadata for publication, versions/campaigns, exclusions, exports and cleanup, including the authorizing owner's ID. Ordinary users cannot write/delete audit records. Existing user/configuration audit tables remain. Passwords, contact details, descriptions and photo bytes are not copied into this audit.

## Verification

Run against disposable local services only:

```sh
bash supabase/tests/run-security-boundaries.sh
DOCKER_HOST=unix:///var/run/docker.sock bash supabase/tests/run-stop-point-feedback.sh
DOCKER_HOST=unix:///var/run/docker.sock bash supabase/tests/run-feedback-test-results.sh
node --test protected/scripts/*.test.mjs shared/*.test.mjs client/scripts/*.test.mjs
CHROMIUM_PATH=/usr/bin/chromium node protected/scripts/database-editing.e2e.mjs
CHROMIUM_PATH=/usr/bin/chromium node client/scripts/feedback-settings.e2e.mjs
npm --prefix protected run build
npm --prefix client run build
```

PostgreSQL tests exercise real API roles, environment mismatches/revocation, immutable versions/provenance, preservation, capture/export failures, exclusions, owner publication/deletion guards, approved reply drafts, native Storage contexts, late-upload rejection, cleanup settling and retained results. Two-session tests check configuration/activation lock ordering and exclusive worker leases. Browser tests use synthetic local services for dialogs/reset/cancellation, mobile layout, version downloads, owner/staff moderation, capped export pagination/failures and stale/closed campaign forms. The cleanup HTTP worker is exercised with waiting/blocked jobs and successful/failed Storage removal. Read-only preflight checks confirmed the existing hosted API and Storage accept the environment headers. These checks do not provision hosted projects or replace a hosted testing-project Storage/Cron smoke test after migration.
