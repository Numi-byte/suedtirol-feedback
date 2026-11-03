# Security and resilience review

Reviewed 2026-11-03. Deployment target supplied by the owner: Vercel, with hosted Supabase shared by both apps.

**Status: hardening implemented and locally tested; production safety is not certified.** At the initial review the database migration had not been applied. The owner subsequently reported applying it; the limited live checks below verify selected anonymous-access boundaries, not the entire migration ledger. Hosting configuration, live grants/schema drift, Auth configuration, backups, traffic expectations and subscription limits were not accessible through connected management tools. No production writes, imports, penetration tests or load tests were performed.

## Findings and remediation

| Priority | Finding | Resolution / remaining action |
| --- | --- | --- |
| Critical dependency advisories | Both apps locked Next.js 15.5.23, with reported image-optimizer RCE and Server Actions DoS advisories (including GHSA-2464-fhr4-w9xw and GHSA-p3m5-59mp-jv5r). Not every reported exploit applies to every deployment. | Upgraded both apps to 15.5.28, patched compatible transitive dependencies, and imposed a patched Next.js minimum. A scoped PostCSS 8.x override removes Next's vulnerable nested copy. Clean npm installs and production builds verified. |
| High | Authentication was treated as staff authorization in RLS, private Storage reads and several RPCs. A regular Supabase user could read reports/contact details and edit stops. Exploitability depends on which accounts exist and whether signups are enabled. | New owner-managed `portal_staff` allowlist, restrictive RLS, explicit grants and RPC checks. Application page and every administrative action also check membership, failing closed on errors/missing migration. Requires the new migration. |
| High | Public discussion report UUIDs were sufficient to upload and register arbitrary additional photos on someone else's report. Unbounded attachments could inflate storage and inbox responses. | One exact upload path requires a separate random UUID capability, private to the submitting browser and database, valid for 15 minutes. Registration is serialized, limited to one photo and idempotent. Existing private photos remain readable to staff; older clients must refresh to upload new photos. Requires migration and client deployment. |
| High, OPEN operational gap | Anonymous submissions go directly to Supabase. A bot can bypass all browser validation and any Vercel-only rate limit and create reports/storage costs. | DB validates categories, text lengths and published point ownership; uploads are limited to one object per report, with the existing 10 MiB bucket limit. This does **not** stop report floods. Add verified challenge + shared durable rate limits at a trusted Supabase write gateway, then remove direct anonymous RPC/Storage write access. See below. |
| Medium | Every public map request repeated paginated aggregate reads; an upstream returning endless pages could monopolize a function. Discussion aggregation joined all historical reports before limiting the output. | Anonymous-only cached map snapshot, one refresh shared by simultaneous requests per process, 10-second per-call timeouts, a 30-second pagination budget, 1,000-page/100,000-row limits, generic 503 errors with retry hints and cache headers on point reads. Threads select the newest 100 reports before category aggregation. Large-scale capacity still needs measurement. |
| Medium | No application security headers; raw upstream errors returned from the public stop API. | CSP, clickjacking protection, MIME sniffing protection, referrer and permissions policies, production HSTS, disabled `X-Powered-By`, and generic public API errors. CSP allows Next's inline bootstrap scripts; it is a baseline, not a strict nonce-based XSS defense. |
| Medium | An authenticated EFA import could buffer an unexpectedly large upstream feed; search filters could grow with arbitrary query text. | EFA response streaming capped at 20 MiB before parsing, existing 60-second fetch deadline retained, search bounded to 200 characters/10 terms. Individual imported batches remain capped at 250 rows. Long imports may still exceed the chosen Vercel plan's function deadline and should move to background jobs if needed. |
| Moderate development dependencies, OPEN | 14 npm findings per app remain in the ESLint/minimatch development dependency chain. All stem from glob amplification advisory GHSA-g3hv-75wg-m249. | No high/critical findings remain. The dev-only minimatch API upgrade is outside compatible patches of the current lint toolchain; do not blindly force npm's suggested downgrades or override across incompatible majors. Upgrade/test the lint toolchain separately. These packages should not be executed against attacker-controlled projects. |

## Reviewed boundaries

- Both apps use the publishable Supabase key, not a privileged server key. Such keys are intended to be public; database grants, RLS and RPC logic are the boundary.
- Private descriptions, contact addresses and photos are omitted from public discussion RPC output. Public output is limited to categories, report IDs/timestamps and staff replies. React renders free text without HTML injection; Leaflet stop labels use `textContent`. No dynamic SQL or arbitrary URL fetch path was found in the reviewed application flows. EFA uses a fixed destination.
- Administrative Server Actions authenticate independently; Next's default same-origin checks and body limit are retained. No wildcard `allowedOrigins` was added. Reply permission remains restricted to the two previously designated author UUIDs, with staff membership additionally required in SQL.
- Permanent table deletion/truncation and direct private-table mutation grants are removed from app roles. Staff archive stops; reports retain their foreign-key and snapshot protections. Category definitions are read-only to app roles.
- Storage still enforces the existing private bucket, image MIME allowlist and 10 MiB object limit. MIME/extension checks do not prove safe image content or remove EXIF metadata. Do not enable raw HTML/SVG uploads or public bucket access. Consider quarantined scanning/re-encoding and stripping metadata for stricter privacy requirements.
- A pattern scan of the current tracked tree found no recognized private keys, `sb_secret_` keys or JWT service-role keys. This is not a full Git-history secret scan or proof that no other secret format exists. Local credential values were never logged.
- Local SQL tests use PostgreSQL 17 with minimal Auth/Storage stubs. They validate grants/RLS/RPC logic, but do not simulate Supabase Auth, PostgREST, Storage HTTP MIME validation, the Vercel firewall or distributed infrastructure.

## Deployment order — required

1. Review `20261103120000_harden_staff_and_photo_access.sql` in staging with a recent sanitized schema/data copy. The migration seeds **only the two existing designated reply accounts**, and only if they exist in `auth.users`. Review other legitimate administrators explicitly. Do not infer approval from email domain, signup, `user_metadata`, or historic stop creation.
2. Apply the reviewed migration through the normal Supabase migration process as the database owner. The migration is transactional and uses no destructive data backfill. Existing report/photo contents are retained. Allowlist entries must be managed by a trusted database operator, never by an app role. For an independently verified staff UUID, the owner can run `insert into public.portal_staff(user_id) values ('<verified-user-uuid>') on conflict do nothing;`. Removing that row revokes future database access but does not invalidate already issued signed photo URLs (currently 15 minutes).
3. Deploy **both** applications with their own updated lockfiles (`npm ci`) and the same real public project configuration. The app denies staff access until the new RPC/membership exists. The old public client's report submissions remain callable via default arguments, but its photo path will be rejected; refresh old clients. Do not roll back the database permissions merely to accommodate an old client.
4. Verify in staging with one approved staff account, one ordinary account and anonymous access: login, stop editing/import, private inbox/photo access, new report with and without a photo, public point isolation, and denied unauthorized direct RPC calls. Verify response headers and that external map tiles, login, signed photos and language switching work in an actual browser.
5. Promote through the normal Vercel production deployment process only after those checks pass. This review pushes source to `work`; it does not apply hosted migrations or explicitly promote a Vercel deployment. Existing automatic Git deployment hooks, if configured by the owner, may run on push.

## Vercel and Supabase controls still needed

- **Vercel:** configure Firewall/WAF and bot protection on both deployments; rate-limit login POSTs and public read endpoints using trusted platform client identity. Avoid in-memory IP counters as the sole control across serverless instances. Protect preview deployments containing real data, keep the two project roots/install commands correct, set spend alerts, and review function duration/memory/concurrency limits for the actual plan. A first login throttle to tune in staging is 10 attempts per minute per client, with monitoring for shared-network false positives.
- **Supabase write abuse:** Vercel firewall rules do not protect `*.supabase.co/rest/v1/rpc/create_stop_point_feedback` or Storage uploads. A trusted Edge Function/write gateway should verify a CAPTCHA/Turnstile token server-side, enforce atomic per-client and global budgets in a durable store, bound request bodies, issue the upload capability, and reject saturation before doing database work. Only that trusted path should retain write access once implemented. Provider secrets must be entered securely, not committed. Do not treat CORS, hidden URLs, a public API key, the upload token or client validation as bot protection.
- **Auth:** verify public signup is disabled for the staff project, require strong passwords and MFA for staff, enable relevant Auth rate limits/challenges, review active accounts and revoke unused sessions. The allowlist prevents a newly registered account from becoming staff, but login flood protection remains necessary. Confirm recovery/redirect URLs are restricted to owned production/preview origins. The code does not yet require an MFA `aal2` claim.
- **Database/Storage:** verify the live migration ledger and effective grants/policies match this repository, review any additional views/RPCs/default grants, set appropriate statement/API timeouts and row caps, and monitor CPU, disk, query latency, connections and Storage growth. Keep pooled HTTP access; never create a new direct database connection per browser request. Add scheduled owner-only cleanup for expired `feedback_upload_capabilities` (indexed by expiry), and a separate audited process for unregistered orphan uploads after an adequate grace period. Do not delete registered evidence by inference.
- **Recovery/privacy:** enable appropriate backups/PITR for the selected Supabase plan, test restoring to a separate project, define retention for contact data/photos and structured test results, and maintain an incident procedure. Snapshots are linked to report IDs, so are not irreversibly anonymous.

## Validation and capacity limits

Local validation: clean lockfile installs and builds/typechecks/lint passed for both apps (lint retains one existing PostCSS-config warning per app). All 11 Node test files passed. Production-only npm audits report zero vulnerabilities in both apps; full audits retain 14 moderate dev-tool findings per app. Both production home pages returned HTTP 200, invalid point IDs returned 400, and all baseline security headers were present with no X-Powered-By header. SQL tests run against disposable databases for the entire migration chain. New tests cover ordinary-account isolation, staff revocation, direct RPC authorization, private objects, guessed/expired/wrong-extension upload capabilities, idempotent registration, report length/category limits, and atomic snapshot capture. A local concurrency test verifies that 100 simultaneous refresh callers issue one upstream refresh per process; this is **not** an end-to-end load test.

No peak traffic target was provided. No requests-per-second guarantee, database sizing conclusion, distributed rate-limit verification or collapse-resistance claim can be made from these tests. Before launch, use a separate staging Vercel deployment and Supabase project with representative data and non-personal fixtures. Measure warm/cold public reads, feedback bursts with/without photos, simultaneous staff browsing/imports, cache expiry and upstream failure recovery. Increase load gradually to the agreed target, record p95/p99 latency/errors/DB CPU/connections/storage costs, and verify backpressure/recovery. Do not run this against the production project without a separately agreed test window and budget.

Commands from the repository root:

```sh
node --test client/scripts/*.test.mjs protected/scripts/*.test.mjs shared/*.test.mjs
bash supabase/tests/run-security-boundaries.sh
bash supabase/tests/run-stop-point-feedback.sh
bash supabase/tests/run-feedback-test-results.sh
npm run build
npm run typecheck
npm run lint
npm audit --prefix client --omit=dev
npm audit --prefix protected --omit=dev
```

Stop development servers before builds because they share `.next`. ESLint now ignores generated `.next`, `out` and `next-env.d.ts` artifacts; source-file rules remain enabled. Shared code remains part of TypeScript checks. Run Docker tests only against the local disposable daemon.

## Post-migration live verification — 2026-11-03

The owner reported applying the migration and supplied two Vercel preview URLs. With the existing public Supabase key, read-only checks confirmed:

- `is_portal_staff()` returns HTTP 200 and `false` for anonymous requests.
- Zero-row requests against `stop_feedback`, `portal_staff` and `feedback_upload_capabilities` return HTTP 401 with PostgreSQL permission code `42501`. No private report contents or credential values were fetched or logged.
- The published-stop RPC returns HTTP 200 with one requested public row.
- Public point-detail and discussion RPCs return HTTP 200 with empty results for the all-zero nonexistent UUID.
- The API-schema endpoint denies anonymous schema discovery (HTTP 401), so its response was not used to claim that every deployed function signature matches the source.

Both supplied Vercel preview URLs were blocked by this cloud environment's egress proxy (CONNECT 403), before reaching Vercel. This is not evidence of a Vercel application failure. Their two exact hostnames were added to the environment configuration draft while preserving the three existing custom domains. Saving the draft does not activate network access or publish the environment.

Still unverified: preview commit/version, deployed HTTP headers, browser rendering, real staff and ordinary-account authorization, login/session lifecycle, a complete photo/report submission, distributed abuse protection and sustained capacity. No live accounts, reports, photos or configuration in Vercel/Supabase were changed by these checks. After network access is activated, test the previews first; use approved test fixtures in staging for write flows. Next implementation priority is a trusted, rate-limited and challenge-verified submission gateway that also closes direct anonymous write bypasses. MFA enforcement, operational monitoring/backups, staging capacity tests and the dev-tool advisory upgrade follow.
