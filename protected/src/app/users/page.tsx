import { redirect } from "next/navigation";
import { getTranslations } from "@/lib/language";
import { createClient } from "@/lib/supabase/server";
import { hasAuthAdminKey } from "@/lib/supabase/admin";
import { getPortalAccess, portalHome, PORTAL_OWNER_ID } from "@/lib/portal-access";
import { userManagementCopy } from "@/lib/user-management-copy";
import { PortalHeader, PortalFooter } from "@/components/portal-shell";
import { PortalNavigation, PortalLink } from "../portal-navigation";
import { createUser, updateAccess, updateCredentials } from "./actions";
import { UserForm } from "./user-form";

export const dynamic = "force-dynamic";
type ManagedUser = { user_id: string; email: string | null; is_active: boolean; can_manage_stops: boolean; can_manage_database: boolean; can_view_feedback: boolean; can_manage_feedback: boolean; is_owner: boolean };
export default async function UsersPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  const access = await getPortalAccess(client);
  if (!user || user.id !== PORTAL_OWNER_ID || !access.users) redirect(portalHome(access) ?? "/");
  const { language } = await getTranslations();
  const copy = userManagementCopy[language];
  const query = await searchParams;
  const search = (query.q ?? "").trim().slice(0,200);
  const requested = Number(query.page ?? 1);
  const page = Number.isInteger(requested) && requested >= 1 && requested <= 10000 ? requested : 1;
  const { data, error } = await client.rpc("list_portal_users", { p_page: page, p_search: search });
  const users = (data ?? []) as ManagedUser[];
  const adminReady = hasAuthAdminKey();
  const pageHref = (value: number) => `/users?${new URLSearchParams({ ...(search ? { q: search } : {}), page: String(value) })}`;
  const permissions = (values?: ManagedUser) => <div className="checks user-permissions">
    <label><input type="checkbox" name="active" defaultChecked={values?.is_active ?? true} />{copy.active}</label>
    <label><input type="checkbox" name="stops" defaultChecked={values?.can_manage_stops ?? true} />{copy.stops}</label>
    <label><input type="checkbox" name="database" defaultChecked={values?.can_manage_database ?? true} />{copy.database}</label>
    <label><input type="checkbox" name="feedback" defaultChecked={values?.can_view_feedback ?? false} />{copy.feedback}</label>
    <label><input type="checkbox" name="feedback_settings" defaultChecked={values?.can_manage_feedback ?? false} />{copy.feedbackSettings}</label>
  </div>;
  return <PortalNavigation loadingLabel={copy.saving}>
    <PortalHeader language={language} email={user.email ?? ""} access={access} />
    <main className="portal portal-users"><header><h1>{copy.title}</h1><p>{copy.intro}</p></header>
      {!adminReady ? <p className="user-config-note" role="status">{copy.keyMissing}</p> : null}
      <section className="editor-card user-create"><h2>{copy.create}</h2>
        <UserForm action={createUser} labels={copy} resetOnSuccess disabled={!adminReady}>
          <label>{copy.email}<input name="email" type="email" maxLength={320} autoComplete="off" required /></label>
          <label>{copy.password}<input name="password" type="password" minLength={12} maxLength={1024} autoComplete="new-password" required /></label>
          {permissions()}<button type="submit">{copy.create}</button>
        </UserForm>
      </section>
      <form className="database-search users-search" method="get" action="/users">
        <label htmlFor="users-search">{copy.search}</label><div><input id="users-search" name="q" type="search" defaultValue={search} maxLength={200} /><button type="submit">{copy.searchButton}</button></div>
      </form>
      {error ? <p role="alert">{copy.loadError}</p> : null}
      <div className="managed-users">{users.slice(0,25).map(account => <section className="editor-card managed-user" key={account.user_id}>
        <div className="database-heading"><h2>{account.email || account.user_id}</h2><span>{account.is_owner ? copy.owner : account.is_active ? copy.enabled : copy.disabled}</span></div>
        {account.is_owner ? <p>{copy.ownerNote}</p> : <UserForm action={updateAccess} labels={copy}>
          <input type="hidden" name="user_id" value={account.user_id} /><h3>{copy.access}</h3>{permissions(account)}<button type="submit">{copy.saveAccess}</button>
        </UserForm>}
        <details className="user-credentials"><summary>{copy.credentials}</summary>
          <UserForm action={updateCredentials} labels={copy} disabled={!adminReady}>
            <input type="hidden" name="user_id" value={account.user_id} />
            <label>{copy.email}<input name="email" type="email" maxLength={320} defaultValue={account.email ?? ""} autoComplete="off" required /></label>
            <label>{copy.newPassword}<input name="password" type="password" minLength={12} maxLength={1024} autoComplete="new-password" /></label>
            <button type="submit">{copy.saveCredentials}</button>
          </UserForm>
        </details>
      </section>)}</div>
      {!error && !users.length ? <p>{copy.empty}</p> : null}
      <nav className="stop-pagination" aria-label={copy.title}>
        {page > 1 ? <PortalLink href={pageHref(page-1)}>{copy.previous}</PortalLink> : null}
        <span>{page}</span>{users.length > 25 && page < 10000 ? <PortalLink href={pageHref(page+1)}>{copy.next}</PortalLink> : null}
      </nav>
    </main><PortalFooter language={language} access={access} />
  </PortalNavigation>;
}
