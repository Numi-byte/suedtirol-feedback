import Link from "next/link";
import { archiveBusStop, createBusStop, restoreBusStop, signOut, updateBusStop } from "./actions";
import { ConfirmButton } from "./confirm-button";
import { LanguageSwitch } from "./language-switch";
import { LoginForm } from "./login-form";
import { BrandLogo } from "@/components/brand-logo";
import { dateLocales } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import { getTranslations } from "@/lib/language";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CategoryLabels = { label_de: string; label_it: string; label_en: string };
type FeedbackCategory = { category_slug: string; feedback_categories: CategoryLabels[] };
type FeedbackPhoto = { id: string; storage_path: string };
type Severity = "low" | "medium" | "high";
type Status = "new" | "in_review" | "resolved" | "dismissed";

function formatSubmittedAt(value: string, language: Language) {
  return new Intl.DateTimeFormat(dateLocales[language], { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

/** The seeded categories carry all three labels, so show the one in use. */
function categoryLabel(category: FeedbackCategory, language: Language) {
  const labels = category.feedback_categories[0];
  return labels?.[`label_${language}` as keyof CategoryLabels] ?? category.category_slug;
}

const RouteLines = () => (
  <svg className="route-lines" viewBox="0 0 420 300" fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 230h110l80-80h130l60-60" />
      <path d="M70 30v90l80 80v100" opacity=".6" />
    </g>
    <g fill="currentColor">
      <circle cx="130" cy="230" r="16" />
      <circle cx="340" cy="150" r="16" />
    </g>
  </svg>
);

type BusStopRow = {
  id: string; name_de: string; name_it: string; name_en: string; municipality: string;
  stop_code: string | null; latitude: number; longitude: number;
  is_accessible: boolean; is_published: boolean; archived_at: string | null;
};

export default async function PortalHomePage({ searchParams }: { searchParams: Promise<{ stop?: string }> }) {
  const { language, t } = await getTranslations();
  const { stop: selectedId } = await searchParams;

  if (!hasSupabaseConfig()) {
    return (
      <main className="portal-message">
        <p>{t.setup.kicker}</p>
        <h1>{t.setup.title}</h1>
        <span>
          {t.setup.body[0]} <code>.env.local.example</code> {t.setup.body[1]} <code>.env.local</code> {t.setup.body[2]}
        </span>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: allStops } = user ? await supabase.from("bus_stops").select("id,name_de,name_it,name_en,municipality,stop_code,latitude,longitude,is_accessible,is_published,archived_at").order("created_at", { ascending: false }) : { data: [] };
  const stops = ((allStops ?? []) as BusStopRow[]).filter((stop) => !stop.archived_at);
  const archivedStops = ((allStops ?? []) as BusStopRow[]).filter((stop) => stop.archived_at);
  const editing = selectedId ? stops.find((stop) => stop.id === selectedId) ?? null : null;
  const { data: feedback } = user ? await supabase
    .from("stop_feedback")
    .select("id,severity,description,overall_rating,cleanliness_rating,safety_rating,accessibility_rating,information_rating,shelter_rating,has_shelter,has_seating,has_lighting,comment,email,consent_to_contact,language,status,created_at,bus_stops(name_de,name_it,name_en,municipality),stop_feedback_categories(category_slug,feedback_categories(label_de,label_it,label_en)),stop_feedback_photos(id,storage_path)")
    .order("created_at", { ascending: false })
    .limit(250) : { data: [] };

  const photoPaths = (feedback ?? []).flatMap((entry) =>
    (entry.stop_feedback_photos as FeedbackPhoto[] | null ?? []).map((photo) => photo.storage_path),
  );
  const { data: signedPhotos } = photoPaths.length
    ? await supabase.storage.from("feedback-photos").createSignedUrls(photoPaths, 60 * 15)
    : { data: [] };
  const photoUrls = new Map<string, string>((signedPhotos ?? []).flatMap((photo, index) =>
    photo.signedUrl && photoPaths[index] ? [[photoPaths[index], photo.signedUrl]] : [],
  ));
  const newFeedbackCount = (feedback ?? []).filter((entry) => entry.status === "new").length;

  if (!user) return (
    <main className="login-page">
      <section className="login-intro">
        <BrandLogo tone="dark" sub="portal" />
        <p>{t.login.eyebrow}</p>
        <h1>{t.login.headline[0]}<br />{t.login.headline[1]}</h1>
        <span className="login-lead">{t.login.lead}</span>
        <RouteLines />
      </section>
      <section className="login-panel"><div className="login-card">
        <div className="login-card-top">
          <p>{t.login.kicker}</p>
          <LanguageSwitch language={language} label={t.portal.language} />
        </div>
        <h2>{t.login.welcome}</h2><span>{t.login.panelLead}</span>
        <LoginForm labels={t.login} />
        <small>{t.login.restricted}</small>
      </div></section>
    </main>
  );

  return (
    <>
    <div className="portal-bar">
      <div className="portal-bar-inner">
        <BrandLogo sub="portal" />
        <div className="user-actions">
          <LanguageSwitch language={language} label={t.portal.language} />
          <span className="user-pill">{user.email}</span>
          <form action={signOut}><button type="submit" className="sign-out">{t.portal.signOut}</button></form>
        </div>
      </div>
    </div>
    <main className="portal">
      <header><div><p>{t.portal.kicker}</p><h1>{t.portal.title}</h1></div></header>
      <div className="portal-grid">
        <section className="editor-card">
          <div className="card-heading">
            <span>{editing ? t.editorEdit.kicker : t.editor.kicker}</span>
            <h2>{editing ? t.editorEdit.title : t.editor.title}</h2>
            <p>{editing ? t.editorEdit.subtitle : t.editor.subtitle}</p>
          </div>
          {/* key remounts the form so the fields reset when the selection changes */}
          <form action={editing ? updateBusStop : createBusStop} key={editing?.id ?? "new"}>
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <div className="field-grid three"><label>{t.editor.nameDe}<input name="name_de" defaultValue={editing?.name_de ?? ""} required /></label><label>{t.editor.nameIt}<input name="name_it" defaultValue={editing?.name_it ?? ""} required /></label><label>{t.editor.nameEn}<input name="name_en" defaultValue={editing?.name_en ?? ""} required /></label></div>
            <div className="field-grid"><label>{t.editor.municipality}<input name="municipality" defaultValue={editing?.municipality ?? ""} required /></label><label>{t.editor.stopCode}<input name="stop_code" defaultValue={editing?.stop_code ?? ""} placeholder={t.editor.optional} /></label></div>
            <div className="field-grid"><label>{t.editor.latitude}<input name="latitude" type="number" min="-90" max="90" step="any" defaultValue={editing?.latitude ?? ""} placeholder="46.4983" required /></label><label>{t.editor.longitude}<input name="longitude" type="number" min="-180" max="180" step="any" defaultValue={editing?.longitude ?? ""} placeholder="11.3548" required /></label></div>
            <div className="checks"><label><input name="is_accessible" type="checkbox" defaultChecked={editing?.is_accessible ?? false} /> {t.editor.accessible}</label><label><input name="is_published" type="checkbox" defaultChecked={editing?.is_published ?? true} /> {t.editor.publish}</label></div>
            <button type="submit">{editing ? t.editorEdit.save : t.editor.save}</button>
          </form>
          {editing ? <div className="editor-actions">
            <Link className="editor-cancel" href="/">{t.editorEdit.cancel}</Link>
            <form action={archiveBusStop}>
              <input type="hidden" name="id" value={editing.id} />
              <ConfirmButton className="editor-archive" message={t.editorEdit.archiveConfirm}>{t.editorEdit.archive}</ConfirmButton>
            </form>
            <p className="editor-note">{t.editorEdit.archiveNote}</p>
          </div> : null}
        </section>
        <section className="stops-card">
          <div className="card-heading"><span>{t.stops.kicker}</span><h2>{stops.length} {t.stops.count}</h2></div>
          <div className="stop-list">
            {stops.map((stop) => (
              <Link className="stop-row" href={`/?stop=${stop.id}`} key={stop.id} aria-current={stop.id === editing?.id ? "true" : undefined}>
                <div className="status-dot" data-published={stop.is_published} />
                <div>
                  <strong>{stop.name_de}</strong>
                  <small>{stop.name_it} · {stop.name_en}</small>
                  <small>{stop.municipality} · {stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}</small>
                </div>
              </Link>
            ))}
            {!stops.length && <p className="empty">{t.stops.empty}</p>}
          </div>
          {archivedStops.length > 0 ? <div className="archived-list">
            <h3>{t.archived.title} · {archivedStops.length} {t.archived.count}</h3>
            {archivedStops.map((stop) => (
              <div className="archived-row" key={stop.id}>
                <div><strong>{stop.name_de}</strong><small>{stop.municipality}</small></div>
                <form action={restoreBusStop}>
                  <input type="hidden" name="id" value={stop.id} />
                  <button type="submit" className="restore">{t.archived.restore}</button>
                </form>
              </div>
            ))}
          </div> : null}
        </section>
      </div>
      <section className="feedback-card">
        <div className="feedback-heading-row">
          <div className="card-heading"><span>{t.feedback.kicker}</span><h2>{t.feedback.title}</h2><p>{t.feedback.note}</p></div>
          <div className="feedback-summary" aria-label={t.feedback.summaryLabel}><strong>{feedback?.length ?? 0}</strong><span>{t.feedback.reports}</span><strong>{newFeedbackCount}</strong><span>{t.feedback.fresh}</span></div>
        </div>
        <div className="feedback-list">
          {feedback?.map((entry) => {
            const stop = Array.isArray(entry.bus_stops) ? entry.bus_stops[0] : entry.bus_stops;
            const categories = (entry.stop_feedback_categories as FeedbackCategory[] | null) ?? [];
            const photos = (entry.stop_feedback_photos as FeedbackPhoto[] | null) ?? [];
            const isLegacyRating = entry.overall_rating !== null;
            const status = (entry.status ?? "new") as Status;
            const severity = entry.severity as Severity | null;
            return <article className="feedback-entry" key={entry.id}>
              <header>
                <div><strong>{stop?.name_de ?? t.feedback.unavailableStop}</strong><small>{stop?.municipality} · {stop?.name_it} · {stop?.name_en}</small></div>
                <div className="feedback-meta"><span className="status-badge" data-status={status}>{t.status[status] ?? status}</span><time dateTime={entry.created_at}>{formatSubmittedAt(entry.created_at, language)}</time></div>
              </header>
              <div className="feedback-entry-body">
                <div>
                  <h3>{isLegacyRating ? t.feedback.ratingResponse : t.feedback.reportedIssue}</h3>
                  {isLegacyRating ? <>
                    <p><span className="score">{entry.overall_rating}/5</span> {t.feedback.overall}</p>
                    <p className="rating-details">{t.feedback.cleanliness} {entry.cleanliness_rating ?? "–"}/5 · {t.feedback.safety} {entry.safety_rating ?? "–"}/5 · {t.feedback.accessibility} {entry.accessibility_rating ?? "–"}/5 · {t.feedback.information} {entry.information_rating ?? "–"}/5 · {t.feedback.shelter} {entry.shelter_rating ?? "–"}/5</p>
                    <p className="rating-details">{t.feedback.shelter} {entry.has_shelter ? "✓" : "–"} · {t.feedback.seating} {entry.has_seating ? "✓" : "–"} · {t.feedback.lighting} {entry.has_lighting ? "✓" : "–"}</p>
                  </> : <>
                    <div className="category-tags">{categories.map((category) => <span key={category.category_slug}>{categoryLabel(category, language)}</span>)}</div>
                    <p><span className="severity-dot" data-severity={severity} />{t.feedback.severity}: <strong>{severity ? t.severity[severity] : t.feedback.notSet}</strong></p>
                  </>}
                </div>
                <div><h3>{t.feedback.description}</h3><p className="comment">{entry.description || entry.comment || t.feedback.noDescription}</p></div>
                <div><h3>{t.feedback.submission}</h3><p>{t.feedback.languageLabel}: {entry.language.toUpperCase()}</p><p>{entry.consent_to_contact && entry.email ? <>{t.feedback.contact}: <a href={`mailto:${entry.email}`}>{entry.email}</a></> : t.feedback.noContact}</p></div>
              </div>
              {photos.length > 0 && <div className="feedback-photos">{photos.map((photo) => {
                const photoUrl = photoUrls.get(photo.storage_path);
                return photoUrl ? <a href={photoUrl} target="_blank" rel="noreferrer" key={photo.id}>
                  {/* Signed storage URLs use the deployment's Supabase hostname. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl} alt={t.feedback.photoAlt} />
                </a> : null;
              })}</div>}
            </article>;
          })}
          {!feedback?.length && <p className="empty feedback-empty">{t.feedback.empty}</p>}
        </div>
      </section>
    </main>
    </>
  );
}
