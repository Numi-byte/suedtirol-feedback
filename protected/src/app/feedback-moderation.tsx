import type { Language } from "@/lib/i18n";
import type { FeedbackRuntime } from "../../../shared/feedback-environment";
import { SettingsDialog } from "./feedback-settings/settings-dialog";
import { managementLabels } from "./feedback-settings/management-tabs";
import { moderateReport } from "./moderation-actions";
export function FeedbackModeration({
  id,
  status,
  visibility,
  notes,
  due,
  draft,
  runtime,
  owner,
  language,
}: {
  id: string;
  status: string;
  visibility: string;
  notes: string;
  due: string | null;
  draft: boolean;
  runtime: FeedbackRuntime;
  owner: boolean;
  language: Language;
}) {
  const t = (de: string, it: string, en: string) =>
    language === "de" ? de : language === "it" ? it : en;
  const labels = managementLabels[language];
  const restricted = runtime.kind === "production" && !owner;
  const vis: Record<string, string> = {
    hidden: t("Verborgen", "Nascosta", "Hidden"),
    pending: t("Zur Freigabe", "Da approvare", "Pending approval"),
    published: t("Öffentlich", "Pubblica", "Published"),
  };
  return (
    <div className="feedback-moderation">
      <div>
        <span className="environment-badge">
          {vis[visibility] ?? visibility}
        </span>
        {draft ? (
          <p>
            {t(
              "Antwortentwurf wartet auf Freigabe.",
              "Bozza di risposta in attesa di approvazione.",
              "Reply draft awaiting approval.",
            )}
          </p>
        ) : null}
        {due && Date.parse(due) <= Date.now() ? (
          <p className="verification-reminder">
            {t(
              "Erneute Prüfung fällig. Der Status wird nicht automatisch geändert.",
              "Verifica necessaria. Lo stato non cambia automaticamente.",
              "Verification due. Status is not changed automatically.",
            )}
          </p>
        ) : null}
        {notes ? <p>{notes}</p> : null}
      </div>
      <SettingsDialog
        title={t(
          "Status & Sichtbarkeit",
          "Stato e visibilità",
          "Status & visibility",
        )}
        action={moderateReport}
        labels={labels}
        closeLabel={labels.close}
        resetLabel={labels.reset}
      >
        <input
          type="hidden"
          name="environment_id"
          value={runtime.environment_id}
        />
        <input type="hidden" name="feedback_id" value={id} />
        <label>
          {t("Bearbeitungsstatus", "Stato operativo", "Operational status")}
          <select name="status" defaultValue={status}>
            {(["new", "in_review", "resolved", "dismissed"] as const).map(
              (s, i) => (
                <option value={s} key={s}>
                  {
                    [
                      t("Neu", "Nuova", "New"),
                      t("In Bearbeitung", "In elaborazione", "In review"),
                      t("Gelöst", "Risolta", "Resolved"),
                      t("Abgewiesen", "Respinta", "Dismissed"),
                    ][i]
                  }
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          {t(
            "Öffentliche Sichtbarkeit",
            "Visibilità pubblica",
            "Public visibility",
          )}
          <select name="visibility" defaultValue={restricted ? "" : visibility}>
            {restricted ? (
              <option value="">
                {t("Beibehalten", "Mantieni", "Keep current")}:{" "}
                {vis[visibility]}
              </option>
            ) : null}
            {Object.entries(vis)
              .filter(([key]) => !restricted || key !== "published")
              .map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <label>
          {t(
            "Interne Lösungs- und Prüfnotizen",
            "Note interne di risoluzione e verifica",
            "Internal resolution and verification notes",
          )}
          <textarea
            name="notes"
            maxLength={2000}
            rows={4}
            defaultValue={notes}
          />
        </label>
        <label className="management-check">
          <input type="checkbox" name="verified" />
          {t(
            "Inhalt geprüft; in 90 Tagen erneut erinnern.",
            "Contenuto verificato; promemoria tra 90 giorni.",
            "Content verified; remind again in 90 days.",
          )}
        </label>
        {runtime.kind === "production" ? (
          <p>
            {t(
              "Nur der Inhaber kann veröffentlichen. Bei Freigabe wird auch der aktuelle Antwortentwurf veröffentlicht. Status und Notizen ändern die Sichtbarkeit nicht automatisch.",
              "Solo il titolare può pubblicare e approvare la bozza di risposta. Stato e note non cambiano automaticamente la visibilità.",
              "Only the owner can publish, including the current reply draft. Status and notes do not automatically change visibility.",
            )}
          </p>
        ) : null}
        <button type="submit">{labels.save}</button>
      </SettingsDialog>
    </div>
  );
}
