import Link from "next/link";
import { managementPageContext, ManagementPage } from "../management-page";
import { managementLabels } from "../management-tabs";
import { configuredEnvironmentPortals } from "@/lib/feedback-environments";
import { getFeedbackEnvironmentHeaders } from "@/lib/supabase/config";
import { UserForm } from "../../users/user-form";
import { SettingsDialog } from "../settings-dialog";
import { LocalDateFields } from "../local-date-fields";
import {
  initializeEnvironment,
  snapshotDataset,
  createCampaign,
  transitionCampaign,
  publishProduction,
  pausePublication,
  scheduleCleanup,
  cancelCleanup,
  confirmEvaluationExport,
} from "../campaign-actions";
import { feedbackUuid } from "../../../../../shared/feedback-environment";
export const dynamic = "force-dynamic";
type Campaign = {
  id: string;
  name: string;
  purpose: string;
  state: string;
  dataset_id: string;
  form_version_id: string;
  starts_at: string | null;
  ends_at: string | null;
  require_export: boolean;
};
type Dataset = {
  id: string;
  label: string;
  content_hash: string;
  created_at: string;
};
type Receipt = {
  id: string;
  status: string;
  csv_sha256: string | null;
  confirmed_at: string | null;
  result_count: number;
};
type Job = {
  id: string;
  state: string;
  scheduled_at: string;
  last_error: string | null;
};
export default async function EnvironmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await managementPageContext();
  const { client, language, runtime, owner, access } = context;
  const t = (de: string, it: string, en: string) =>
    language === "de" ? de : language === "it" ? it : en;
  const labels = managementLabels[language];
  if (!runtime)
    return (
      <ManagementPage context={context} current="environments">
        {null}
      </ManagementPage>
    );
  const env = (
    <input type="hidden" name="environment_id" value={runtime.environment_id} />
  );
  const dialogProps = {
    closeLabel: labels.close,
    resetLabel: labels.reset,
    labels,
  };
  const dates = {
    start: t("Beginn (optional)", "Inizio (facoltativo)", "Start (optional)"),
    end: t("Ende (optional)", "Fine (facoltativa)", "End (optional)"),
    timezone: t(
      "Zeitzone dieses Geräts",
      "Fuso orario del dispositivo",
      "Device time zone",
    ),
  };
  let portals: ReturnType<typeof configuredEnvironmentPortals>;
  let portalError = false;
  try {
    portals = configuredEnvironmentPortals();
  } catch {
    portalError = true;
    portals = [];
  }
  const query = await searchParams;
  const rawPage = Number(query.page ?? 1);
  const page =
    Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 10000 ? rawPage : 1;
  const rawDatasetPage = Number(query.datasetPage ?? 1);
  const datasetPage =
    Number.isInteger(rawDatasetPage) &&
    rawDatasetPage >= 1 &&
    rawDatasetPage <= 10000
      ? rawDatasetPage
      : 1;
  const [datasets, campaigns, audit] = await Promise.all([
    client
      .from("feedback_stop_datasets")
      .select("id,label,content_hash,created_at")
      .order("created_at", { ascending: false })
      .order("id")
      .range((datasetPage - 1) * 50, datasetPage * 50)
      .returns<Dataset[]>(),
    client
      .from("feedback_campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * 25, page * 25)
      .returns<Campaign[]>(),
    owner
      ? client
          .from("feedback_management_audit")
          .select("id,action,object_type,object_id,actor_id,created_at")
          .order("id", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const list = campaigns.data?.slice(0, 25) ?? [];
  const datasetList = datasets.data?.slice(0, 50) ?? [];
  const selectedId =
    typeof query.campaign === "string" && feedbackUuid.test(query.campaign)
      ? query.campaign
      : list[0]?.id;
  const selected = selectedId
    ? (
        await client
          .from("feedback_campaigns")
          .select("*")
          .eq("id", selectedId)
          .maybeSingle<Campaign>()
      ).data
    : null;
  const datasetPageHref = (value: number) =>
    `?page=${page}&datasetPage=${value}${selected ? `&campaign=${selected.id}` : ""}`;
  const [previewResult, exportResult, jobResult] = selected
    ? await Promise.all([
        client.rpc("get_feedback_cleanup_preview", {
          p_environment: runtime.environment_id,
          p_campaign: selected.id,
        }),
        client
          .from("feedback_evaluation_exports")
          .select("id,status,csv_sha256,confirmed_at,result_count")
          .eq("campaign_id", selected.id)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle<Receipt>(),
        client
          .from("feedback_cleanup_jobs")
          .select("id,state,scheduled_at,last_error")
          .eq("campaign_id", selected.id)
          .maybeSingle<Job>(),
      ])
    : [
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
      ];
  const preview = previewResult.data as {
    reports: number;
    replies: number;
    photos: number;
    upload_permissions: number;
    preserved_results: number;
    blocker: string | null;
  } | null;
  const receipt = exportResult.data;
  const job = jobResult.data;
  const format = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(language, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Europe/Berlin",
        }).format(new Date(value))
      : "—";
  const stateNames: Record<string, string> = {
    draft: t("Entwurf", "Bozza", "Draft"),
    active: t("Aktiv", "Attiva", "Active"),
    closed: t("Abgeschlossen", "Chiusa", "Closed"),
    archived: t("Archiviert", "Archiviata", "Archived"),
  };
  return (
    <ManagementPage context={context} current="environments">
      <section className="editor-card environment-overview">
        <div className="management-heading">
          <h2>{t("Umgebung", "Ambiente", "Environment")}</h2>
          <span className="environment-badge" data-kind={runtime.kind}>
            {runtime.kind}
          </span>
        </div>
        <p>
          {t(
            "Jede Umgebung verwendet ein eigenes Supabase-Projekt und eigene Zugriffsrechte. Beim Wechsel öffnet sich das zugehörige Portal; dort ist eine Anmeldung erforderlich.",
            "Ogni ambiente utilizza un progetto Supabase e permessi separati. Il cambio apre il relativo portale con il proprio accesso.",
            "Each environment uses its own Supabase project and permissions. Switching opens its portal, where you must sign in.",
          )}
        </p>
        <code className="management-id">{runtime.environment_id}</code>
        {portals.length ? (
          <nav
            className="reply-filters"
            aria-label={t(
              "Umgebung wechseln",
              "Cambia ambiente",
              "Switch environment",
            )}
          >
            {portals.map((p) => (
              <a
                href={p.url}
                key={p.id}
                aria-current={
                  p.id === runtime.environment_id ? "page" : undefined
                }
              >
                {p.label}
              </a>
            ))}
          </nav>
        ) : null}
        {portalError ? (
          <p role="alert">
            {t(
              "Die Portal-Konfiguration enthält keine gültige Trennung der Projekte.",
              "La configurazione dei portali non separa correttamente i progetti.",
              "Portal configuration does not define valid separate projects.",
            )}
          </p>
        ) : null}
        {runtime.kind === "unconfigured" ? (
          <>
            <p className="management-notice">
              {t(
                "Noch nicht aktiviert. Bestehende Daten bleiben unverändert. Die Umgebungsart wird einmalig festgelegt und kann danach nicht geändert werden. Produktion benötigt ein separates Projekt.",
                "Non ancora attivato. I dati esistenti restano invariati. Il tipo è definitivo; la produzione richiede un progetto separato.",
                "Not activated. Existing data is preserved. The environment type is permanent; production requires a separate project.",
              )}
            </p>
            {owner ? (
              <SettingsDialog
                {...dialogProps}
                title={t(
                  "Umgebung einrichten",
                  "Configura ambiente",
                  "Configure environment",
                )}
                action={initializeEnvironment}
                disabled={
                  getFeedbackEnvironmentHeaders()["x-feedback-environment"] !==
                  runtime.environment_id
                }
              >
                {env}
                <label>
                  {t("Bezeichnung", "Nome", "Label")}
                  <input name="label" maxLength={100} required />
                </label>
                <label>
                  {t("Art", "Tipo", "Type")}
                  <select name="kind" required>
                    <option value="testing">Testing</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </select>
                </label>
                <p>
                  {t(
                    "Vorher diese Umgebungs-ID in beiden Bereitstellungen hinterlegen (NEXT_PUBLIC_FEEDBACK_ENVIRONMENT_ID). Die Projektzuordnung wird serverseitig geprüft.",
                    "Prima configurare questo ID in entrambi i deployment (NEXT_PUBLIC_FEEDBACK_ENVIRONMENT_ID).",
                    "First configure this identity in both deployments (NEXT_PUBLIC_FEEDBACK_ENVIRONMENT_ID). The project binding is checked by the backend.",
                  )}
                </p>
                <button type="submit">{labels.save}</button>
              </SettingsDialog>
            ) : null}
          </>
        ) : (
          <div className="runtime-versions">
            <p>
              {t(
                "Veröffentlichter Datensatz",
                "Dataset pubblicato",
                "Published dataset",
              )}
              : <code>{runtime.dataset_version_id ?? "—"}</code>
            </p>
            <p>
              {t("Formularversion", "Versione modulo", "Form version")}:{" "}
              <code>{runtime.form_version_id ?? "—"}</code>
            </p>
            <p>
              {t("Kampagne", "Campagna", "Campaign")}:{" "}
              {runtime.campaign_name ?? "—"}
            </p>
            <p>
              {runtime.accepting_submissions
                ? t(
                    "Neue Meldungen möglich",
                    "Invio abilitato",
                    "Accepting submissions",
                  )
                : t(
                    "Neue Meldungen pausiert",
                    "Invio sospeso",
                    "Submissions paused",
                  )}
            </p>
          </div>
        )}
      </section>
      {runtime.kind !== "unconfigured" ? (
        <>
          <section className="editor-card">
            <div className="management-heading">
              <h2>
                {t(
                  "Datensatz-Versionen",
                  "Versioni dataset",
                  "Dataset versions",
                )}
              </h2>
              {access.database ? (
                <SettingsDialog
                  {...dialogProps}
                  title={t(
                    "Version speichern",
                    "Salva versione",
                    "Save version",
                  )}
                  action={snapshotDataset}
                >
                  {env}
                  <p>
                    {t(
                      "Speichert den aktuellen Haltestellenbestand samt verknüpften Haltepunkten als unveränderliche Version.",
                      "Salva una versione immutabile delle fermate e dei punti collegati.",
                      "Save the current stop places and linked stop points as an immutable version.",
                    )}
                  </p>
                  <label>
                    {t("Versionsname", "Nome versione", "Version name")}
                    <input name="label" maxLength={120} required />
                  </label>
                  <button type="submit">{labels.save}</button>
                </SettingsDialog>
              ) : null}
            </div>
            {datasets.error ? (
              <p role="alert">{labels.failed}</p>
            ) : (
              <ul className="dataset-version-list">
                {datasetList.map((d) => (
                  <li key={d.id}>
                    <div>
                      <strong>{d.label}</strong>
                      <small>{format(d.created_at)}</small>
                      <code>{d.id}</code>
                    </div>
                    {access.database ? (
                      <a
                        className="management-download"
                        href={`/feedback-settings/dataset-export?environment=${runtime.environment_id}&dataset=${d.id}`}
                      >
                        {t(
                          "Datensatz herunterladen",
                          "Scarica dataset",
                          "Download dataset",
                        )}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {!datasetList.length ? (
              <p>
                {t(
                  "Noch keine Version gespeichert.",
                  "Nessuna versione salvata.",
                  "No saved versions yet.",
                )}
              </p>
            ) : null}
            <nav
              className="management-actions"
              aria-label={t(
                "Datensatz-Seiten",
                "Pagine dataset",
                "Dataset pages",
              )}
            >
              {datasetPage > 1 ? (
                <Link href={datasetPageHref(datasetPage - 1)}>
                  {t(
                    "Neuere Versionen",
                    "Versioni più recenti",
                    "Newer versions",
                  )}
                </Link>
              ) : null}
              {(datasets.data?.length ?? 0) > 50 ? (
                <Link href={datasetPageHref(datasetPage + 1)}>
                  {t(
                    "Ältere Versionen",
                    "Versioni precedenti",
                    "Older versions",
                  )}
                </Link>
              ) : null}
            </nav>
            {runtime.kind === "production" && owner && datasetList.length ? (
              <div className="management-actions">
                <SettingsDialog
                  {...dialogProps}
                  title={t(
                    "In Produktion veröffentlichen",
                    "Pubblica in produzione",
                    "Publish to production",
                  )}
                  action={publishProduction}
                >
                  {env}
                  <label>
                    {t("Datensatz", "Dataset", "Dataset")}
                    <select name="dataset_id" required>
                      {datasetList.map((d) => (
                        <option value={d.id} key={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="management-check">
                    <input
                      type="checkbox"
                      name="confirm_publication"
                      required
                    />
                    {t(
                      "Diese Version und das aktuelle Formular für die Produktion veröffentlichen.",
                      "Pubblicare questa versione e il modulo corrente in produzione.",
                      "Publish this dataset and the current form to production.",
                    )}
                  </label>
                  <button type="submit">{labels.save}</button>
                </SettingsDialog>
                {runtime.dataset_version_id ? (
                  <UserForm action={pausePublication} labels={labels}>
                    {env}
                    <button type="submit">
                      {t(
                        "Veröffentlichung pausieren",
                        "Sospendi pubblicazione",
                        "Pause publication",
                      )}
                    </button>
                  </UserForm>
                ) : null}
              </div>
            ) : null}
          </section>
          {runtime.kind !== "production" ? (
            <>
              <section className="editor-card">
                <div className="management-heading">
                  <h2>
                    {t("Testkampagnen", "Campagne di test", "Test campaigns")}
                  </h2>
                  <SettingsDialog
                    {...dialogProps}
                    title={t(
                      "Kampagne hinzufügen",
                      "Aggiungi campagna",
                      "Add campaign",
                    )}
                    action={createCampaign}
                    disabled={!datasetList.length}
                  >
                    {env}
                    <label>
                      {t("Name", "Nome", "Name")}
                      <input name="name" maxLength={120} required />
                    </label>
                    <label>
                      {t("Zweck", "Scopo", "Purpose")}
                      <select name="purpose">
                        <option value="evaluation">
                          {t(
                            "Offizielle Auswertung",
                            "Valutazione ufficiale",
                            "Official evaluation",
                          )}
                        </option>
                        <option value="practice">
                          {t("Übung", "Esercitazione", "Practice")}
                        </option>
                      </select>
                    </label>
                    <label>
                      {t(
                        "Datensatz-Version",
                        "Versione dataset",
                        "Dataset version",
                      )}
                      <select name="dataset_id" required>
                        {datasetList.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <LocalDateFields labels={dates} />
                    <p>
                      {t(
                        "Das aktuelle Formular wird versioniert. Testdiskussionen sind zunächst verborgen. Vor der Bereinigung ist ein bestätigter Auswertungsexport erforderlich.",
                        "Il modulo corrente viene versionato. Discussioni nascoste per impostazione iniziale; la pulizia richiede un export confermato.",
                        "The current form is versioned. Test discussions start hidden; cleanup requires a confirmed evaluation export.",
                      )}
                    </p>
                    <button type="submit">{labels.save}</button>
                  </SettingsDialog>
                </div>
                {campaigns.error ? (
                  <p role="alert">{labels.failed}</p>
                ) : (
                  <nav
                    className="campaign-list"
                    aria-label={t("Kampagnen", "Campagne", "Campaigns")}
                  >
                    {list.map((c) => (
                      <Link
                        key={c.id}
                        href={`?page=${page}&datasetPage=${datasetPage}&campaign=${c.id}`}
                        aria-current={
                          c.id === selected?.id ? "page" : undefined
                        }
                      >
                        <strong>{c.name}</strong>
                        <span>{stateNames[c.state]}</span>
                      </Link>
                    ))}
                  </nav>
                )}
                <div className="management-actions">
                  {page > 1 ? (
                    <Link href={`?page=${page - 1}&datasetPage=${datasetPage}`}>
                      {t("Zurück", "Indietro", "Previous")}
                    </Link>
                  ) : null}
                  {(campaigns.data?.length ?? 0) > 25 ? (
                    <Link href={`?page=${page + 1}&datasetPage=${datasetPage}`}>
                      {t("Weiter", "Avanti", "Next")}
                    </Link>
                  ) : null}
                </div>
                {!list.length ? (
                  <p>
                    {t(
                      "Keine Kampagnen vorhanden. Historische Ergebnisse werden keiner Kampagne zugeordnet.",
                      "Nessuna campagna. I risultati storici restano senza assegnazione.",
                      "No campaigns. Historical results remain unassigned.",
                    )}
                  </p>
                ) : null}
              </section>
              {selected ? (
                <section className="editor-card campaign-details">
                  <div className="management-heading">
                    <h2>{selected.name}</h2>
                    <span className="environment-badge">
                      {stateNames[selected.state]}
                    </span>
                  </div>
                  <p>
                    {t("Beginn / Ende", "Inizio / fine", "Start / end")}:{" "}
                    {format(selected.starts_at)} / {format(selected.ends_at)}{" "}
                    (Europe/Berlin)
                  </p>
                  <p>
                    {t("Datensatz", "Dataset", "Dataset")}:{" "}
                    <code>{selected.dataset_id}</code>
                  </p>
                  <p>
                    {t("Formular", "Modulo", "Form")}:{" "}
                    <code>{selected.form_version_id}</code>
                  </p>
                  <div className="management-actions">
                    {(selected.state === "draft"
                      ? ["active", "closed"]
                      : selected.state === "active"
                        ? ["closed"]
                        : selected.state === "closed"
                          ? ["archived"]
                          : []
                    ).map((state) => (
                      <UserForm
                        key={state}
                        action={transitionCampaign}
                        labels={labels}
                      >
                        {env}
                        <input
                          type="hidden"
                          name="campaign_id"
                          value={selected.id}
                        />
                        <input type="hidden" name="state" value={state} />
                        <button type="submit">
                          {state === "active"
                            ? t("Aktivieren", "Attiva", "Activate")
                            : state === "closed"
                              ? t("Abschließen", "Chiudi", "Close")
                              : t("Archivieren", "Archivia", "Archive")}
                        </button>
                      </UserForm>
                    ))}
                    <Link
                      href={`/feedback-settings/evaluation?campaign=${selected.id}`}
                    >
                      {t(
                        "Auswertung öffnen",
                        "Apri valutazione",
                        "Open evaluation",
                      )}
                    </Link>
                    {access.feedback ? (
                      <a
                        href={`/exports?table=feedback&environment=${runtime.environment_id}&campaign=${selected.id}`}
                      >
                        {t("Operative CSV", "CSV operativo", "Operational CSV")}
                      </a>
                    ) : null}
                  </div>
                  {preview ? (
                    <>
                      <dl className="cleanup-summary">
                        {(
                          [
                            [
                              t("Meldungen", "Segnalazioni", "Reports"),
                              preview.reports,
                            ],
                            [
                              t("Antworten", "Risposte", "Replies"),
                              preview.replies,
                            ],
                            [t("Fotos", "Foto", "Photos"), preview.photos],
                            [
                              t(
                                "Upload-Rechte",
                                "Permessi upload",
                                "Upload permissions",
                              ),
                              preview.upload_permissions,
                            ],
                            [
                              t(
                                "Ergebnisse bleiben erhalten",
                                "Risultati conservati",
                                "Results preserved",
                              ),
                              preview.preserved_results,
                            ],
                          ] as const
                        ).map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                      {preview.blocker ? (
                        <p className="management-notice">{preview.blocker}</p>
                      ) : null}
                    </>
                  ) : previewResult.error ? (
                    <p role="alert">{labels.failed}</p>
                  ) : null}
                  {receipt ? (
                    <div className="evaluation-receipt">
                      <p>
                        {t(
                          "Letzter Auswertungsexport",
                          "Ultimo export di valutazione",
                          "Latest evaluation export",
                        )}
                        : {receipt.status} · {receipt.result_count}{" "}
                        {t("Ergebnisse", "risultati", "results")}
                      </p>
                      {receipt.csv_sha256 ? (
                        <code className="management-id">
                          SHA-256: {receipt.csv_sha256}
                        </code>
                      ) : null}
                      {owner &&
                      receipt.status === "completed" &&
                      !receipt.confirmed_at ? (
                        <UserForm
                          labels={labels}
                          action={confirmEvaluationExport}
                        >
                          {env}
                          <input
                            type="hidden"
                            name="export_id"
                            value={receipt.id}
                          />
                          <input
                            type="hidden"
                            name="sha256"
                            value={receipt.csv_sha256 ?? ""}
                          />
                          <label className="management-check">
                            <input type="checkbox" name="saved_copy" required />
                            {t(
                              "CSV heruntergeladen, geprüft und sicher gespeichert.",
                              "CSV scaricato, verificato e salvato.",
                              "I downloaded, checked and safely saved the CSV.",
                            )}
                          </label>
                          <button type="submit">
                            {t(
                              "Gespeicherten Export bestätigen",
                              "Conferma export salvato",
                              "Confirm saved export",
                            )}
                          </button>
                        </UserForm>
                      ) : null}
                    </div>
                  ) : null}
                  {job ? (
                    <div className="cleanup-job">
                      <p>
                        {t("Bereinigung", "Pulizia", "Cleanup")}: {job.state} ·{" "}
                        {format(job.scheduled_at)} (Europe/Berlin)
                      </p>
                      {job.last_error ? (
                        <p role="alert">{job.last_error}</p>
                      ) : null}
                      {owner &&
                      ["pending", "blocked", "failed"].includes(job.state) ? (
                        <UserForm labels={labels} action={cancelCleanup}>
                          {env}
                          <input type="hidden" name="job_id" value={job.id} />
                          <button type="submit">
                            {t(
                              "Bereinigung abbrechen",
                              "Annulla pulizia",
                              "Cancel cleanup",
                            )}
                          </button>
                        </UserForm>
                      ) : null}
                    </div>
                  ) : null}
                  {owner && ["closed", "archived"].includes(selected.state) ? (
                    <SettingsDialog
                      {...dialogProps}
                      title={t(
                        "Bereinigung planen",
                        "Pianifica pulizia",
                        "Schedule cleanup",
                      )}
                      action={scheduleCleanup}
                      disabled={
                        !preview ||
                        !!preview.blocker ||
                        job?.state === "running" ||
                        job?.state === "completed"
                      }
                    >
                      {env}
                      <input
                        type="hidden"
                        name="campaign_id"
                        value={selected.id}
                      />
                      <p>
                        {t(
                          "Entfernt ausschließlich Meldungen, Antworten, Fotos und Upload-Rechte dieser Testkampagne. Auswertungsergebnisse und Versionen bleiben erhalten. Mindestens 15 Minuten Vorlauf.",
                          "Rimuove solo segnalazioni, risposte, foto e permessi della campagna. Risultati e versioni conservati. Preavviso minimo 15 minuti.",
                          "Removes only this test campaign’s reports, replies, photos and upload permissions. Evaluation results and versions remain. Schedule at least 15 minutes ahead.",
                        )}
                      </p>
                      <LocalDateFields
                        cleanup
                        labels={{
                          ...dates,
                          start: t("Zeitpunkt", "Data e ora", "Scheduled time"),
                        }}
                      />
                      <label>
                        {t(
                          "Kampagnennamen zur Bestätigung eingeben",
                          "Inserisci il nome della campagna",
                          "Enter the campaign name to confirm",
                        )}
                        : {selected.name}
                        <input name="confirmation" required maxLength={120} />
                      </label>
                      <button type="submit">{labels.save}</button>
                    </SettingsDialog>
                  ) : null}
                </section>
              ) : null}
            </>
          ) : (
            <section className="editor-card">
              <h2>
                {t(
                  "Meldungen im Betrieb",
                  "Segnalazioni operative",
                  "Production reports",
                )}
              </h2>
              <p>
                {t(
                  "Bearbeitungsstatus und öffentliche Sichtbarkeit werden getrennt verwaltet. Nach 90 Tagen erinnert die Ansicht an eine erneute Prüfung. Meldungen werden niemals allein wegen ihres Alters gelöscht.",
                  "Stato operativo e visibilità pubblica sono separati. Un promemoria dopo 90 giorni richiede una verifica; nessuna eliminazione per anzianità.",
                  "Operational status and public visibility are separate. A verification reminder becomes due after 90 days. Age alone never deletes reports.",
                )}
              </p>
              <Link href="/">
                {t("Rückmeldungen öffnen", "Apri segnalazioni", "Open reports")}
              </Link>
            </section>
          )}
          {owner ? (
            <section className="editor-card">
              <h2>
                {t(
                  "Letzte Verwaltungsaktionen",
                  "Ultime azioni di gestione",
                  "Recent management actions",
                )}
              </h2>
              {audit.error ? (
                <p role="alert">{labels.failed}</p>
              ) : (
                <ul className="management-audit">
                  {audit.data?.map((a) => (
                    <li key={a.id}>
                      <time dateTime={a.created_at}>
                        {format(a.created_at)}
                      </time>
                      <span>
                        {a.action} · {a.object_type}
                      </span>
                      <code>{a.actor_id ?? "Scheduler"}</code>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </>
      ) : null}
    </ManagementPage>
  );
}
