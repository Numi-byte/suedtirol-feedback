import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPortalAccess, portalHome } from "@/lib/portal-access";
import { getLanguage } from "@/lib/language";
import { passwordCopy } from "@/lib/password-copy";
import { PortalHeader, PortalFooter } from "@/components/portal-shell";
import { PortalNavigation } from "../../portal-navigation";
import { UserForm } from "../../users/user-form";
import { changePassword } from "./actions";
export const dynamic = "force-dynamic";
export default async function PasswordPage() {
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  const access = await getPortalAccess(client);
  if (error || !user || !portalHome(access)) redirect("/");
  const language = await getLanguage();
  const copy = passwordCopy[language];
  return (
    <PortalNavigation loadingLabel={copy.saving}>
      <PortalHeader
        language={language}
        email={user.email ?? ""}
        access={access}
      />
      <main className="portal password-page">
        <header>
          <h1>{copy.title}</h1>
        </header>
        <section className="editor-card password-card">
          <p>{copy.intro}</p>
          <p>{user.email}</p>
          <UserForm action={changePassword} labels={copy} resetOnSuccess>
            <label>
              {copy.current}
              <input
                name="current_password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={1024}
              />
            </label>
            <label>
              {copy.password}
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={1024}
              />
            </label>
            <label>
              {copy.confirm}
              <input
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={1024}
              />
            </label>
            <p>{copy.hint}</p>
            <button type="submit">{copy.save}</button>
          </UserForm>
        </section>
      </main>
      <PortalFooter language={language} access={access} />
    </PortalNavigation>
  );
}
