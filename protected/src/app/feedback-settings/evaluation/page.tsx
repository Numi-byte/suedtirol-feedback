import Link from "next/link";
import { managementPageContext, ManagementPage } from "../management-page";
import { managementLabels } from "../management-tabs";
import { SettingsDialog } from "../settings-dialog";
import { saveEvaluationExclusion } from "../campaign-actions";
import { feedbackUuid } from "../../../../../shared/feedback-environment";
export const dynamic = "force-dynamic";
type Exclusion = { excluded: boolean; reason: string };
type Result = {
  feedback_id: string;
  submitted_at: string;
  stop_place_name_de: string;
  stop_point_name_de: string;
  category_labels_de: string[];
  severity: string;
  environment_id: string | null;
  campaign_id: string | null;
  dataset_version_id: string | null;
  form_version_id: string | null;
  feedback_evaluation_exclusions: Exclusion | Exclusion[] | null;
};
export default async function EvaluationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await managementPageContext();
  const { runtime, client, language } = context;
  if (!runtime)
    return (
      <ManagementPage context={context} current="evaluation">
        {null}
      </ManagementPage>
    );
  const t = (de: string, it: string, en: string) =>
    language === "de" ? de : language === "it" ? it : en;
  const labels = managementLabels[language];
  const query = await searchParams;
  const campaign =
    typeof query.campaign === "string" && feedbackUuid.test(query.campaign)
      ? query.campaign
      : null;
  const rawPage = Number(query.page ?? 1);
  const page =
    Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 10000 ? rawPage : 1;
  let request = client
    .from("feedback_test_results")
    .select(
      "feedback_id,submitted_at,stop_place_name_de,stop_point_name_de,category_labels_de,severity,environment_id,campaign_id,dataset_version_id,form_version_id,feedback_evaluation_exclusions(excluded,reason)",
      { count: "exact" },
    );
  request = campaign
    ? request.eq("campaign_id", campaign)
    : request.is("campaign_id", null);
  const [results, campaignInfo] = await Promise.all([
    request
      .order("submitted_at", { ascending: false })
      .order("feedback_id")
      .range((page - 1) * 25, page * 25 - 1)
      .returns<Result[]>(),
    campaign
      ? client
          .from("feedback_campaigns")
          .select("name,state")
          .eq("id", campaign)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const suffix = campaign ? `campaign=${campaign}&` : "";
  return (
    <ManagementPage context={context} current="evaluation">
      <section className="editor-card">
        <div className="management-heading">
          <h2>
            {campaignInfo.data?.name ??
              t(
                "Historische Ergebnisse ohne Zuordnung",
                "Risultati storici senza assegnazione",
                "Unassigned historical results",
              )}
          </h2>
          <a
            className="management-download"
            href={`/feedback-settings/evaluation-export?environment=${runtime.environment_id}&campaign=${campaign ?? "legacy"}`}
          >
            {t(
              "Auswertungs-CSV herunterladen",
              "Scarica CSV di valutazione",
              "Download evaluation CSV",
            )}
          </a>
        </div>
        <p>
          {t(
            "Unveränderliche Momentaufnahmen der Abgabe. Ausschlüsse ändern keine Ergebnisse; sie werden mit Begründung getrennt gespeichert und im Export mitgeführt. Personenbezogene Freitexte, Fotos und Antworten gehören nur zum operativen Export.",
            "Snapshot immutabili al momento dell’invio. Le esclusioni sono annotazioni separate, incluse nell’export. Testi personali, foto e risposte appartengono solo all’export operativo.",
            "Immutable submission snapshots. Exclusions are stored separately with reasons and included in the export. Personal free text, photos and replies belong only to operational records.",
          )}
        </p>
        {campaign ? (
          <Link href="/feedback-settings/evaluation">
            {t(
              "Historische Ergebnisse anzeigen",
              "Mostra risultati storici",
              "View historical results",
            )}
          </Link>
        ) : (
          <p className="management-notice">
            {t(
              "Keine nachträglichen Kampagnen-, Datensatz- oder Formularzuordnungen. Fehlende Herkunftsdaten bleiben leer.",
              "Nessuna assegnazione retroattiva a campagne o versioni. I metadati sconosciuti restano vuoti.",
              "No retroactive campaign or version assignments. Unknown provenance stays empty.",
            )}
          </p>
        )}
        {results.error || campaignInfo.error ? (
          <p role="alert">{labels.failed}</p>
        ) : (
          <>
            <p>
              {results.count ?? 0} {t("Ergebnisse", "risultati", "results")}
            </p>
            <div className="evaluation-results">
              {results.data?.map((r) => {
                const x = Array.isArray(r.feedback_evaluation_exclusions)
                  ? r.feedback_evaluation_exclusions[0]
                  : r.feedback_evaluation_exclusions;
                return (
                  <article key={r.feedback_id} className="evaluation-result">
                    <div>
                      <strong>
                        {r.stop_place_name_de} · {r.stop_point_name_de}
                      </strong>
                      <small>
                        {new Intl.DateTimeFormat(language, {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Europe/Berlin",
                        }).format(new Date(r.submitted_at))}{" "}
                        (Europe/Berlin)
                      </small>
                      <p>
                        {r.category_labels_de.join(" · ")} · {r.severity}
                      </p>
                      <code className="management-id">{r.feedback_id}</code>
                      {x ? (
                        <p>
                          {x.excluded
                            ? t("Ausgeschlossen", "Escluso", "Excluded")
                            : t("Eingeschlossen", "Incluso", "Included")}
                          : {x.reason}
                        </p>
                      ) : null}
                    </div>
                    <SettingsDialog
                      title={t(
                        "Bewertung kennzeichnen",
                        "Annota valutazione",
                        "Annotate result",
                      )}
                      closeLabel={labels.close}
                      resetLabel={labels.reset}
                      labels={labels}
                      action={saveEvaluationExclusion}
                    >
                      <input
                        type="hidden"
                        name="environment_id"
                        value={runtime.environment_id}
                      />
                      <input
                        type="hidden"
                        name="feedback_id"
                        value={r.feedback_id}
                      />
                      <label className="management-check">
                        <input
                          type="checkbox"
                          name="excluded"
                          defaultChecked={x?.excluded ?? false}
                        />
                        {t(
                          "Von der Auswertung ausschließen",
                          "Escludi dalla valutazione",
                          "Exclude from evaluation",
                        )}
                      </label>
                      <label>
                        {t(
                          "Begründung (auch bei Wiederaufnahme)",
                          "Motivazione (anche per reinclusione)",
                          "Reason (also when including again)",
                        )}
                        <textarea
                          name="reason"
                          rows={3}
                          maxLength={1000}
                          required
                          defaultValue={x?.reason ?? ""}
                        />
                      </label>
                      <button type="submit">{labels.save}</button>
                    </SettingsDialog>
                  </article>
                );
              })}
            </div>
            <nav
              className="management-actions"
              aria-label={t(
                "Ergebnisseiten",
                "Pagine risultati",
                "Result pages",
              )}
            >
              {page > 1 ? (
                <Link href={`?${suffix}page=${page - 1}`}>
                  {t("Zurück", "Indietro", "Previous")}
                </Link>
              ) : null}
              <span>
                {page} / {Math.max(1, Math.ceil((results.count ?? 0) / 25))}
              </span>
              {page * 25 < (results.count ?? 0) ? (
                <Link href={`?${suffix}page=${page + 1}`}>
                  {t("Weiter", "Avanti", "Next")}
                </Link>
              ) : null}
            </nav>
          </>
        )}
      </section>
    </ManagementPage>
  );
}
