import { municipalityName } from "../../../shared/municipality";
import Link from "next/link";
import Image from "next/image";
import loginPhoto from "@/components/3e665714419485d3f8c4ee7c0026d022bef11c77.jpg";
import { archiveBusStop, createBusStop, restoreBusStop, signOut, updateBusStop, updateStopPointType } from "./actions";
import { ConfirmButton } from "./confirm-button";
import { FeedbackReplyForm } from "./feedback-reply-form";
import { LanguageSwitch } from "./language-switch";
import { LoginForm } from "./login-form";
import { StopDataImport } from "./stop-data-import";
import { BrandLogo } from "@/components/brand-logo";
import { dateLocales } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import { canReplyToFeedback } from "@/lib/feedback-reply-authorization";
import { getTranslations } from "@/lib/language";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { loadAllStopRows } from "@/lib/all-stop-rows";
import { loadPortalPage, requestedPage as parsePage, stopSearchFilter } from "@/lib/portal-pagination";
import { reportedIssueLabel, type FeedbackCategory } from "@/lib/reported-issues";
import { PortalNavigation, PortalLink, PortalSearchForm } from "./portal-navigation";

export const dynamic = "force-dynamic";

type FeedbackPhoto = { id: string; storage_path: string };
type FeedbackReply = { id: string; body: string; created_at: string; updated_at: string };
type Severity = "low" | "medium" | "high";
type Status = "new" | "in_review" | "resolved" | "dismissed";
type ReplyFilter = "all" | "replied" | "unreplied";

/**
 * PostgREST can embed the unique feedback reply as either a to-one object or
 * an array, depending on which relationship metadata is present in its schema
 * cache. Normalizing both shapes keeps the reply card and filters in sync.
 */
function getFeedbackReply(value: FeedbackReply | FeedbackReply[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function formatSubmittedAt(value: string, language: Language) {
  return new Intl.DateTimeFormat(dateLocales[language], { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

type BusStopRow = {
  id: string; name_de: string; name_it: string; name_en: string; municipality: string; municipality_de?: string; municipality_it?: string;
  stop_code: string | null; latitude: number; longitude: number;
  is_accessible: boolean; is_published: boolean; archived_at: string | null;
};

const STOPS_PER_PAGE = 10;
const FEEDBACK_PER_PAGE = 10;

function pageNumbers(currentPage: number, pageCount: number) {
  const firstPage = Math.max(1, Math.min(currentPage - 2, pageCount - 4));
  return Array.from({ length: Math.min(5, pageCount) }, (_, index) => firstPage + index);
}

export default async function PortalHomePage({ searchParams }: { searchParams: Promise<{ stop?: string; page?: string; q?: string; replies?: string; feedbackPage?: string; archivePage?: string }> }) {
  const { language, t } = await getTranslations();
  const { stop: selectedId, page: requestedStopPage, q, replies, feedbackPage: requestedFeedbackPage, archivePage: requestedArchivePage } = await searchParams;

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
  if (!user) return (
    <main className="login-page">
      <section className="login-intro">
        <Image className="login-photo" src={loginPhoto} alt="" fill priority placeholder="blur"
          sizes="(max-width: 900px) 100vw, 55vw" />
        <BrandLogo tone="dark" sub="portal" />
        <p>{t.login.eyebrow}</p>
        <h1>{t.login.headline[0]}<br />{t.login.headline[1]}</h1>
        <span className="login-lead">{t.login.lead}</span>
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

  const searchQuery = q?.trim() ?? "";
  const searchFilter = stopSearchFilter(searchQuery);
  const validSelectedId = selectedId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedId) ? selectedId : null;
  const stopFields = "id,name_de,name_it,name_en,municipality,municipality_de,municipality_it,stop_code,latitude,longitude,is_accessible,is_published,archived_at";
  const buildStopQuery = (head = false) => {
    let query = supabase.from("bus_stops").select(stopFields, { count: "exact", head }).is("archived_at", null);
    if (searchFilter) query = query.or(searchFilter);
    return query.order("created_at", { ascending: false }).order("id");
  };
  const buildArchiveQuery = (head = false) => supabase.from("bus_stops").select(stopFields, { count: "exact", head })
    .not("archived_at", "is", null).order("archived_at", { ascending: false }).order("id");
  const replyFilter: ReplyFilter = replies === "replied" || replies === "unreplied" ? replies : "all";
  const feedbackSelect = "id,severity,description,overall_rating,cleanliness_rating,safety_rating,accessibility_rating,information_rating,shelter_rating,has_shelter,has_seating,has_lighting,comment,email,consent_to_contact,language,status,created_at,bus_stops(name_de,name_it,name_en,municipality,municipality_de,municipality_it),stop_points(point_number,name_de,name_it),stop_feedback_categories(category_slug,feedback_categories(label_de,label_it,label_en)),stop_feedback_photos(id,storage_path),feedback_replies!left(id,body,created_at,updated_at)";
  const buildFeedbackQuery = (head = false) => {
    let query = supabase.from("stop_feedback").select(feedbackSelect, { count: "exact", head });
    if (replyFilter === "replied") query = query.not("feedback_replies", "is", null);
    if (replyFilter === "unreplied") query = query.is("feedback_replies", null);
    return query.order("created_at", { ascending: false }).order("id", { ascending: false });
  };

  // Independent requests run together. Only the visible page and selected
  // place's points are transferred, regardless of the size of the database.
  const [stopPage, archivePage, feedbackPage, activeCountResult, allFeedbackResult, newFeedbackResult, editingResult, editingPoints] = await Promise.all([
    loadPortalPage(parsePage(requestedStopPage), STOPS_PER_PAGE,
      (from, to) => buildStopQuery().range(from, to), () => buildStopQuery(true)),
    loadPortalPage(parsePage(requestedArchivePage), STOPS_PER_PAGE,
      (from, to) => buildArchiveQuery().range(from, to), () => buildArchiveQuery(true)),
    loadPortalPage(parsePage(requestedFeedbackPage), FEEDBACK_PER_PAGE,
      (from, to) => buildFeedbackQuery().range(from, to), () => buildFeedbackQuery(true)),
    searchFilter ? supabase.from("bus_stops").select("id", { count: "exact", head: true }).is("archived_at", null) : Promise.resolve({ count: null, error: null }),
    replyFilter !== "all" ? supabase.from("stop_feedback").select("id", { count: "exact", head: true }) : Promise.resolve({ count: null, error: null }),
    supabase.from("stop_feedback").select("id", { count: "exact", head: true }).eq("status", "new"),
    validSelectedId ? supabase.from("bus_stops").select(stopFields).eq("id", validSelectedId).is("archived_at", null).maybeSingle() : Promise.resolve({ data: null, error: null }),
    validSelectedId ? loadAllStopRows<{ id: string; point_number: string; name_de: string; name_it: string; transport_type: string }>((from, to) =>
      supabase.from("stop_points").select("id,point_number,name_de,name_it,transport_type", { count: "exact" })
        .eq("stop_place_id", validSelectedId).order("point_number").order("id").range(from, to)) : Promise.resolve([]),
  ]);
  for (const result of [activeCountResult, allFeedbackResult, newFeedbackResult, editingResult]) {
    if (result.error) throw new Error(result.error.message);
  }
  const stops = stopPage.rows;
  const archivedStops = archivePage.rows;
  const editing = editingResult.data as BusStopRow | null;
  const activeStopCount = activeCountResult.count ?? stopPage.count;
  const { currentPage, pageCount } = stopPage;
  const visibleFeedback = feedbackPage.rows;
  const feedbackCount = feedbackPage.count;
  const currentFeedbackPage = feedbackPage.currentPage;
  const feedbackPageCount = feedbackPage.pageCount;
  const allFeedbackCount = allFeedbackResult.count ?? feedbackCount;
  const newFeedbackCount = newFeedbackResult.count;
  const navigationHref = (updates: Record<string, string | null>, anchor?: string) => {
    const params = new URLSearchParams();
    if (validSelectedId) params.set("stop", validSelectedId);
    if (currentPage > 1) params.set("page", String(currentPage));
    if (searchQuery) params.set("q", searchQuery);
    if (replyFilter !== "all") params.set("replies", replyFilter);
    if (currentFeedbackPage > 1) params.set("feedbackPage", String(currentFeedbackPage));
    if (archivePage.currentPage > 1) params.set("archivePage", String(archivePage.currentPage));
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    return `/${params.size ? `?${params}` : ""}${anchor ? `#${anchor}` : ""}`;
  };
  const feedbackFilterHref = (filter: ReplyFilter) => navigationHref({ replies: filter === "all" ? null : filter, feedbackPage: null }, "feedback-inbox");
  const feedbackPageHref = (page: number) => navigationHref({ feedbackPage: page > 1 ? String(page) : null }, "feedback-inbox");
  const stopPageHref = (page: number) => navigationHref({ page: page > 1 ? String(page) : null }, "stop-database");
  const archivePageHref = (page: number) => navigationHref({ archivePage: page > 1 ? String(page) : null }, "archived-stops");

  const photoPaths = visibleFeedback.flatMap((entry) =>
    (entry.stop_feedback_photos as FeedbackPhoto[] | null ?? []).map((photo) => photo.storage_path),
  );
  const { data: signedPhotos } = photoPaths.length
    ? await supabase.storage.from("feedback-photos").createSignedUrls(photoPaths, 60 * 15)
    : { data: [] };
  const photoUrls = new Map<string, string>((signedPhotos ?? []).flatMap((photo, index) =>
    photo.signedUrl && photoPaths[index] ? [[photoPaths[index], photo.signedUrl]] : [],
  ));
  const canReply = canReplyToFeedback(user.id);

  return (
    <PortalNavigation loadingLabel={t.portal.loading}>
    <div className="portal-bar">
      <div className="portal-bar-inner">
        <BrandLogo sub="portal" />
        <div className="user-actions">
          <LanguageSwitch language={language} label={t.portal.language} />
          <span className="user-pill" title={user.email}>{user.email}</span>
          <form action={signOut}><button type="submit" className="sign-out">{t.portal.signOut}</button></form>
        </div>
      </div>
    </div>
    <main className="portal">
      <header><div><p>{t.portal.kicker}</p><h1>{t.portal.title}</h1></div></header>
      <div className="portal-grid">
        <section className="import-card">
          <StopDataImport places={t.importer} points={t.pointImporter} />
        </section>
        <section className="editor-card">
          <div className="card-heading">
            <span>{editing ? t.editorEdit.kicker : t.editor.kicker}</span>
            <h2>{editing ? t.editorEdit.title : t.editor.title}</h2>
            <p>{editing ? t.editorEdit.subtitle : t.editor.subtitle}</p>
          </div>
          {/* key remounts the form so the fields reset when the selection changes */}
          <form action={editing ? updateBusStop : createBusStop} key={editing?.id ?? "new"}>
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <div className="field-grid three"><label>{t.editor.nameDe}<input name="name_de" defaultValue={editing?.name_de ?? ""} /></label><label>{t.editor.nameIt}<input name="name_it" defaultValue={editing?.name_it ?? ""} required /></label><label>{t.editor.nameEn}<input name="name_en" defaultValue={editing?.name_en ?? ""} /></label></div>
            <div className="field-grid"><label>{t.editor.municipalityDe}<input name="municipality_de" defaultValue={editing?.municipality_de ?? ""} required /></label><label>{t.editor.municipalityIt}<input name="municipality_it" defaultValue={editing?.municipality_it ?? ""} required /></label></div>
            <div className="field-grid"><label>{t.editor.stopCode}<input name="stop_code" defaultValue={editing?.stop_code ?? ""} placeholder={t.editor.optional} /></label></div>
            <div className="field-grid"><label>{t.editor.latitude}<input name="latitude" type="number" min="-90" max="90" step="any" defaultValue={editing?.latitude ?? ""} placeholder="46.4983" required /></label><label>{t.editor.longitude}<input name="longitude" type="number" min="-180" max="180" step="any" defaultValue={editing?.longitude ?? ""} placeholder="11.3548" required /></label></div>
            <div className="checks"><label><input name="is_accessible" type="checkbox" defaultChecked={editing?.is_accessible ?? false} /> {t.editor.accessible}</label><label><input name="is_published" type="checkbox" defaultChecked={editing?.is_published ?? true} /> {t.editor.publish}</label></div>
            <button type="submit">{editing ? t.editorEdit.save : t.editor.save}</button>
          </form>
          {editing ? <div className="editor-actions">
            <Link className="editor-cancel" href={searchQuery ? `/?q=${encodeURIComponent(searchQuery)}` : "/"}>{t.editorEdit.cancel}</Link>
            <form action={archiveBusStop}>
              <input type="hidden" name="id" value={editing.id} />
              <ConfirmButton className="editor-archive" message={t.editorEdit.archiveConfirm}>{t.editorEdit.archive}</ConfirmButton>
            </form>
            <p className="editor-note">{t.editorEdit.archiveNote}</p>
          </div> : null}
        </section>
        {editing ? <section className="editor-card point-editor" id="stop-points-editor">
          <div className="card-heading"><h2>{t.pointEditor.title}</h2><p>{editing.name_de || editing.name_it}</p></div>
          {editingPoints.map(point => <form action={updateStopPointType} key={point.id}>
            <input type="hidden" name="point_id" value={point.id} /><input type="hidden" name="place_id" value={editing.id} />
            <h3>{point[`name_${language === "it" ? "it" : "de"}`]} · {t.pointEditor.point} {point.point_number}</h3>
            <label>{t.pointEditor.type}<select name="transport_type" defaultValue={point.transport_type}>
              <option value="bus">{t.pointEditor.bus}</option><option value="train">{t.pointEditor.train}</option><option value="cable_car">{t.pointEditor.cable_car}</option>
            </select></label>
            <button type="submit">{t.editorEdit.save}</button>
          </form>)}
          {!editingPoints.length ? <p>{t.pointEditor.empty}</p> : null}
        </section> : null}
        <section className="stops-card" id="stop-database">
          <div className="card-heading"><span>{t.stops.kicker}</span><h2>{activeStopCount} {t.stops.count}</h2></div>
          <PortalSearchForm className="database-search">
            <label htmlFor="database-stop-search">{t.stops.searchLabel}</label>
            <div><input id="database-stop-search" name="q" type="search" defaultValue={searchQuery} placeholder={t.stops.searchPlaceholder} autoComplete="off" /><button type="submit">{t.stops.search}</button></div>
          </PortalSearchForm>
          {searchQuery ? <p className="database-search-count" aria-live="polite">{stopPage.count} {t.stops.results}</p> : null}
          <div className="stop-list">
            {stops.map((stop) => (
              <PortalLink className="stop-row" href={navigationHref({ stop: stop.id })} key={stop.id} aria-current={stop.id === editing?.id ? "true" : undefined}>
                <div className="status-dot" data-published={stop.is_published} />
                <div>
                  <strong>{stop.name_de || stop.name_it}</strong>
                  <small>{stop.name_it} · {stop.name_en}</small>
                  <small>{municipalityName(stop, language)} · {stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}</small>
                </div>
              </PortalLink>
            ))}
            {!stops.length && <p className="empty">{searchQuery ? t.stops.emptySearch : t.stops.empty}</p>}
          </div>
          {pageCount > 1 ? <nav className="stop-pagination" aria-label={t.stops.paginationLabel}>
            {currentPage > 1
              ? <PortalLink href={stopPageHref(currentPage - 1)}>{t.stops.previous}</PortalLink>
              : <span className="disabled" aria-disabled="true">{t.stops.previous}</span>}
            <div className="page-numbers">
              {pageNumbers(currentPage, pageCount).map((page) => <PortalLink href={stopPageHref(page)} key={page} aria-current={page === currentPage ? "page" : undefined}>{page}</PortalLink>)}
            </div>
            {currentPage < pageCount
              ? <PortalLink href={stopPageHref(currentPage + 1)}>{t.stops.next}</PortalLink>
              : <span className="disabled" aria-disabled="true">{t.stops.next}</span>}
            <span className="page-summary">{t.stops.page} {currentPage} {t.stops.of} {pageCount}</span>
          </nav> : null}
          {archivedStops.length > 0 ? <div className="archived-list" id="archived-stops">
            <h3>{t.archived.title} · {archivePage.count} {t.archived.count}</h3>
            {archivedStops.map((stop) => (
              <div className="archived-row" key={stop.id}>
                <div><strong>{stop.name_de || stop.name_it}</strong><small>{municipalityName(stop, language)}</small></div>
                <form action={restoreBusStop}>
                  <input type="hidden" name="id" value={stop.id} />
                  <button type="submit" className="restore">{t.archived.restore}</button>
                </form>
              </div>
            ))}
            {archivePage.pageCount > 1 ? <nav className="stop-pagination" aria-label={t.archived.title}>
              {archivePage.currentPage > 1 ? <PortalLink href={archivePageHref(archivePage.currentPage - 1)}>{t.stops.previous}</PortalLink> : <span className="disabled" aria-disabled="true">{t.stops.previous}</span>}
              <span className="page-summary">{t.stops.page} {archivePage.currentPage} {t.stops.of} {archivePage.pageCount}</span>
              {archivePage.currentPage < archivePage.pageCount ? <PortalLink href={archivePageHref(archivePage.currentPage + 1)}>{t.stops.next}</PortalLink> : <span className="disabled" aria-disabled="true">{t.stops.next}</span>}
            </nav> : null}
          </div> : null}
        </section>
      </div>
      <section className="feedback-card" id="feedback-inbox">
        <div className="feedback-heading-row">
          <div className="card-heading"><span>{t.feedback.kicker}</span><h2>{t.feedback.title}</h2><p>{t.feedback.note}</p></div>
          <div className="feedback-summary" aria-label={t.feedback.summaryLabel}><strong>{allFeedbackCount ?? 0}</strong><span>{t.feedback.reports}</span><strong>{newFeedbackCount ?? 0}</strong><span>{t.feedback.fresh}</span></div>
        </div>
        <nav className="reply-filters" aria-label={t.feedback.filter.label}>
          {(["all", "replied", "unreplied"] as const).map((filter) => (
            <PortalLink href={feedbackFilterHref(filter)} key={filter} aria-current={replyFilter === filter ? "page" : undefined}>
              {t.feedback.filter[filter]}
            </PortalLink>
          ))}
        </nav>
        <div className="feedback-list">
          {visibleFeedback.map((entry) => {
            const stop = Array.isArray(entry.bus_stops) ? entry.bus_stops[0] : entry.bus_stops;
            const point = Array.isArray(entry.stop_points) ? entry.stop_points[0] : entry.stop_points;
            const categories = (entry.stop_feedback_categories as FeedbackCategory[] | null) ?? [];
            const photos = (entry.stop_feedback_photos as FeedbackPhoto[] | null) ?? [];
            const reply = getFeedbackReply(entry.feedback_replies as FeedbackReply | FeedbackReply[] | null);
            const isLegacyRating = entry.overall_rating !== null;
            const status = (entry.status ?? "new") as Status;
            const severity = entry.severity as Severity | null;
            return <article className="feedback-entry" key={entry.id}>
              <header>
                <div><strong>{stop?.name_de || stop?.name_it || t.feedback.unavailableStop}</strong><small>{point ? `${t.pointEditor.point} ${point.point_number} · ${point.name_de || point.name_it}` : t.pointEditor.legacy}</small><small>{municipalityName(stop, language)} · {stop?.name_it} · {stop?.name_en}</small></div>
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
                    <div className="category-tags">{categories.map((category) => <span key={category.category_slug}>{reportedIssueLabel(category, language, t.feedback.reportedIssue)}</span>)}</div>
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
                  <img src={photoUrl} alt={t.feedback.photoAlt} loading="lazy" decoding="async" />
                </a> : null;
              })}</div>}
              {canReply ? <FeedbackReplyForm
                key={`${entry.id}-${reply?.updated_at ?? "unanswered"}`}
                feedbackId={entry.id}
                reply={reply}
                labels={t.feedback.reply}
              /> : reply ? <div className="existing-reply"><span>{t.feedback.reply.answered}</span><p>{reply.body}</p></div> : null}
            </article>;
          })}
          {!visibleFeedback.length && <p className="empty feedback-empty">{replyFilter === "all" ? t.feedback.empty : t.feedback.filter.empty}</p>}
        </div>
        {feedbackPageCount > 1 ? <nav className="stop-pagination feedback-pagination" aria-label={t.feedback.paginationLabel}>
          {currentFeedbackPage > 1
            ? <PortalLink href={feedbackPageHref(currentFeedbackPage - 1)}>{t.stops.previous}</PortalLink>
            : <span className="disabled" aria-disabled="true">{t.stops.previous}</span>}
          <div className="page-numbers">
            {pageNumbers(currentFeedbackPage, feedbackPageCount).map((page) => <PortalLink href={feedbackPageHref(page)} key={page} aria-current={page === currentFeedbackPage ? "page" : undefined}>{page}</PortalLink>)}
          </div>
          {currentFeedbackPage < feedbackPageCount
            ? <PortalLink href={feedbackPageHref(currentFeedbackPage + 1)}>{t.stops.next}</PortalLink>
            : <span className="disabled" aria-disabled="true">{t.stops.next}</span>}
          <span className="page-summary">{t.stops.page} {currentFeedbackPage} {t.stops.of} {feedbackPageCount} · {feedbackCount} {t.feedback.reports}</span>
        </nav> : null}
      </section>
    </main>
    </PortalNavigation>
  );
}
