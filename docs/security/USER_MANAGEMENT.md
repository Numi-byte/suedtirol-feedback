# Owner-only user management

The only user-management owner is Auth user `bdee91d9-c969-4bd4-b336-8f7e780ead3e`. Ownership is fixed by UUID in the application and database; it cannot be assigned through user metadata, section permissions or this interface. Changing the owner's email keeps its UUID/ownership. The owner cannot deactivate itself or remove its section access through the portal.

## Deploy

1. Apply `supabase/migrations/20261105120000_owner_user_management.sql` after the existing migrations. This preserves all current staff members' existing section access. No migration was applied to the hosted project by the agent.
2. In **the protected Vercel project only**, add `SUPABASE_SERVICE_ROLE_KEY` as a sensitive server environment variable. Use the Supabase project's service-role key or supported secret API key. The server variable name stays `SUPABASE_SERVICE_ROLE_KEY`. Match its project to `NEXT_PUBLIC_SUPABASE_URL`. Never prefix it with `NEXT_PUBLIC_`, add it to the client project, commit its value, paste it into chat, or include it in page props/logs. Add it to the required Vercel environments and redeploy the protected app. No private admin key is currently configured in this cloud workspace; local tests use a synthetic key against a loopback Auth fixture.
3. Log in as the specified owner and open **Benutzerverwaltung** (`/users`). Other staff do not get this menu or route. Without the private key, the owner can list accounts and change permissions after the migration; account creation and email/password controls remain disabled with a setup message.
4. Validate in staging with an owner, an import-only user, a database-only user and an inactive user before production rollout. Keep public staff signup disabled and secure the owner account with MFA in Supabase. This change does not add a new MFA enrollment/challenge interface.

The publishable key continues to be used for ordinary session-bound reads/writes. The private server key is instantiated only after authenticating and checking the exact owner, and is used only for Supabase Auth Admin create/update calls. Passwords go through HTTPS Server Actions, are validated server-side (12–1024 characters), are never returned or listed, and are cleared from the form after each attempt. Existing passwords cannot be retrieved. Creation confirms the email administratively and does not invoke an invitation/email-delivery workflow; the owner supplies the initial credentials securely to the intended user.

## Permissions and lifecycle

- **Haltestellen verwalten:** CSV/EFA import RPCs, bounded to the existing validated batch sizes. These run with definer rights after the import permission check so import-only users do not need direct database-edit privileges.
- **Datenbank verwalten:** stop and stop-point reads/creation/editing/archive/restore through the database section. Direct table writes require this permission too.
- **Rückmeldungen:** private feedback/contact/photo/snapshot reads and feedback workflow actions. It is **off by default for new accounts**. The existing two-account restriction on authoring public replies is retained in addition to feedback access.
- **Portalzugang aktiv:** deactivation makes all section checks false for ordinary users, including existing JWT sessions. It removes portal privileges rather than deleting the Auth identity or historic records. Already-issued signed photo links can remain usable until their existing 15-minute expiry. The Auth account can still exist and use any intentionally public APIs; it cannot access the protected portal or private tables. Reactivation restores only the selected section permissions.

No non-owner can manage accounts, even if every section permission is granted. Users with access to only one section are redirected to an allowed landing page; unauthorized menu entries are hidden. Application checks, direct-table RLS and RPC checks enforce the same sections. The owner always retains all sections and user management.

The paginated owner list shows Auth accounts (25 per page, searchable by email), including identities not yet granted portal access. This lets the owner recover partial creations. Auth creation and permission assignment are separate operations: if permission assignment fails or is unconfirmed, the UI explicitly reports that the account exists and directs the owner to check/save its permissions rather than blindly creating it again. Auth identity creation by itself never grants portal rights. Account and credential changes record management events containing actor/target UUIDs, event type and timestamp; email/password values are excluded. Supabase's own Auth audit trail remains relevant for Auth API operations. A completion audit failure is shown as a warning rather than falsely claiming the Auth change was rolled back.

Deletion is deliberately not included: Auth users may own stops/replies and historic records. Deactivate accounts to revoke access while retaining those references. Authority transfer, destructive deletion and public signup are separate workflows.

## Validation

- Production build, type checking and lint for the protected app.
- Node tests of permission parsing/landing, server input validation, default feedback denial, Auth Admin create/update orchestration, partial failure reporting, blank-password preservation and owner lockout protection.
- `bash supabase/tests/run-security-boundaries.sh` now also runs the user-management SQL suite against a disposable local PostgreSQL database. It checks owner-only listing/mutation, inability to self-escalate, section isolation, imports without direct editing rights, deactivation and audit writes.
- Existing feedback/snapshot/municipality SQL regressions still pass.
- `CHROMIUM_PATH=/usr/bin/chromium node protected/scripts/database-editing.e2e.mjs` includes owner creation, section assignment, deactivation/reactivation, email/password changes, absent browser key/password values, unauthorized URLs, forged owner-action replay rejection and the existing state-preserving stop-editing regression. All account writes in these browser tests target synthetic local Auth/REST servers; none target hosted Supabase.
