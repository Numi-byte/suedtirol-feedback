import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getPortalAccess,
  portalHome,
  PORTAL_OWNER_ID,
} from "@/lib/portal-access";
import { getTranslations } from "@/lib/language";
import { parseFeedbackRuntime } from "../../../../shared/feedback-environment";
import { PortalHeader, PortalFooter } from "@/components/portal-shell";
import { PortalNavigation } from "../portal-navigation";
import { FeedbackManagementTabs, managementLabels } from "./management-tabs";
import type { ReactNode } from "react";

export async function managementPageContext() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  const access = await getPortalAccess(client);
  if (!user || !access.feedbackSettings) redirect(portalHome(access) ?? "/");
  const { language } = await getTranslations();
  const context = await client.rpc("get_feedback_runtime_context");
  let runtime = null;
  try {
    if (context.error) throw context.error;
    runtime = parseFeedbackRuntime(context.data);
  } catch {}
  return {
    client,
    user,
    access,
    language,
    runtime,
    owner: user.id === PORTAL_OWNER_ID,
  };
}
export function ManagementPage({
  context,
  current,
  children,
}: {
  context: Awaited<ReturnType<typeof managementPageContext>>;
  current: "environments" | "evaluation";
  children: ReactNode;
}) {
  const { user, access, language, runtime } = context;
  return (
    <PortalNavigation loadingLabel={managementLabels[language].saving}>
      <PortalHeader
        language={language}
        email={user.email ?? ""}
        access={access}
      />
      <main className="portal feedback-settings-page feedback-workspace">
        <header>
          <h1>
            {language === "de"
              ? "Feedback verwalten"
              : language === "it"
                ? "Gestione feedback"
                : "Manage feedback"}
          </h1>
          {runtime ? (
            <span className="environment-badge" data-kind={runtime.kind}>
              {runtime.label} · {runtime.kind}
            </span>
          ) : null}
        </header>
        <FeedbackManagementTabs language={language} current={current} />
        {runtime ? (
          children
        ) : (
          <p role="alert">
            {language === "de"
              ? "Die Umgebungsverwaltung ist noch nicht verfügbar. Zuerst die Migrationen und die Zuordnung der Bereitstellung prüfen."
              : language === "it"
                ? "Gestione ambienti non disponibile. Verificare le migrazioni e la configurazione del deployment."
                : "Environment management is unavailable. Check the migrations and deployment binding first."}
          </p>
        )}
      </main>
      <PortalFooter language={language} access={access} />
    </PortalNavigation>
  );
}
