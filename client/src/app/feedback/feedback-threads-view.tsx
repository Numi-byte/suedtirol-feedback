"use client";

import { useLanguage } from "@/components/language-provider";

import { feedbackCategoryLabel, type FeedbackCategoryConfig } from "../../../../shared/feedback-form-config";

const copy = {
  de: { eyebrow: "Rückmeldungen", title: "Öffentliche Beiträge", intro: "Die Auswahl anderer Fahrgäste – anonym und ohne persönliche Angaben.", anonymous: "Anonymer Beitrag", issue: "Gemeldetes Problem", reply: "Antwort des Teams", waiting: "Noch keine Antwort", empty: "Für diesen Haltepunkt gibt es noch keine Beiträge." },
  it: { eyebrow: "Riscontri", title: "Contributi pubblici", intro: "Le selezioni di altri passeggeri, anonime e senza dati personali.", anonymous: "Contributo anonimo", issue: "Problema segnalato", reply: "Risposta del team", waiting: "Nessuna risposta per ora", empty: "Non ci sono ancora contributi per questo punto di fermata." },
  en: { eyebrow: "Feedback", title: "Public posts", intro: "Selections from other passengers, anonymous and without personal details.", anonymous: "Anonymous post", issue: "Reported issue", reply: "Team reply", waiting: "No reply yet", empty: "There are no posts for this stop point yet." },
} as const;

type Language = keyof typeof copy;
export type Thread = { feedback_id: string; submitted_at: string; category_slugs: string[]; reply_body: string | null; replied_at: string | null };

export function FeedbackThreadsView({ threads, language, categories }: { categories: FeedbackCategoryConfig[]; threads: Thread[]; language?: string }) {
  const { language: siteLanguage } = useLanguage();
  const lang: Language = language === "de" || language === "it" || language === "en" ? language : siteLanguage;
  const t = copy[lang];
  const labels = new Map(categories.map(category=>[category.slug,feedbackCategoryLabel(category,lang)]));
  const locale = lang === "de" ? "de-DE" : lang === "it" ? "it-IT" : "en-GB";

  return <section className="feedback-threads" id="feedback-threads" aria-labelledby="feedback-threads-title">
    <header><span>{t.eyebrow}</span><h2 id="feedback-threads-title">{t.title}</h2><p>{t.intro}</p></header>
    <div className="thread-list">
      {threads.map((thread) => <article className="thread" key={thread.feedback_id}>
        <div className="thread-post">
          <div className="anonymous-avatar" aria-hidden="true">A</div>
          <div><div className="thread-meta"><strong>{t.anonymous}</strong><time dateTime={thread.submitted_at}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Europe/Rome" }).format(new Date(thread.submitted_at))}</time></div>
          <div className="thread-categories">{thread.category_slugs.map((slug) => <span key={slug}>{labels.get(slug) ?? t.issue}</span>)}</div></div>
        </div>
        {thread.reply_body ? <div className="thread-reply"><span aria-hidden="true">↳</span><div><strong>{t.reply}</strong><p>{thread.reply_body}</p>{thread.replied_at ? <time dateTime={thread.replied_at}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Europe/Rome" }).format(new Date(thread.replied_at))}</time> : null}</div></div> : <p className="thread-waiting">{t.waiting}</p>}
      </article>)}
      {!threads.length ? <p className="threads-empty">{t.empty}</p> : null}
    </div>
  </section>;
}
