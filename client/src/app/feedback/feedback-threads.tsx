import { createClient } from "@/lib/supabase/server";

const labels: Record<string, Record<string, string>> = {
  weather_protection: { de: "Witterungsschutz fehlt", it: "Manca la protezione dalle intemperie", en: "Weather protection is missing" },
  seating: { de: "Sitzplatz fehlt", it: "Mancano posti a sedere", en: "Seating is missing" },
  safe_sidewalk: { de: "Sicherer Gehweg fehlt", it: "Manca un percorso pedonale sicuro", en: "Safe footpath is missing" },
  safe_crossing: { de: "Sichere Querung fehlt", it: "Manca un attraversamento sicuro", en: "Safe road crossing is missing" },
  passenger_information: { de: "Fahrgastinformation fehlt", it: "Mancano informazioni ai passeggeri", en: "Passenger information is missing" },
  lighting: { de: "Beleuchtung fehlt", it: "Manca l’illuminazione", en: "Lighting is missing" },
  accessibility: { de: "Barrierefreiheit fehlt", it: "Accessibilità insufficiente", en: "Accessibility is inadequate" },
  shading: { de: "Beschattung fehlt", it: "Manca l’ombreggiatura", en: "Shade is missing" },
  bicycle_parking: { de: "Fahrradabstellplatz fehlt", it: "Manca il parcheggio per biciclette", en: "Bicycle parking is missing" },
  waste_bin: { de: "Mülleimer fehlt", it: "Manca il cestino", en: "Waste bin is missing" },
};

const copy = {
  de: { eyebrow: "Rückmeldungen", title: "Öffentliche Beiträge", intro: "Die Auswahl anderer Fahrgäste – anonym und ohne persönliche Angaben.", anonymous: "Anonymer Beitrag", reply: "Antwort des Teams", waiting: "Noch keine Antwort", empty: "Für diese Haltestelle gibt es noch keine Beiträge." },
  it: { eyebrow: "Riscontri", title: "Contributi pubblici", intro: "Le selezioni di altri passeggeri, anonime e senza dati personali.", anonymous: "Contributo anonimo", reply: "Risposta del team", waiting: "Nessuna risposta per ora", empty: "Non ci sono ancora contributi per questa fermata." },
  en: { eyebrow: "Feedback", title: "Public posts", intro: "Selections from other passengers, anonymous and without personal details.", anonymous: "Anonymous post", reply: "Team reply", waiting: "No reply yet", empty: "There are no posts for this stop yet." },
} as const;

type Language = keyof typeof copy;
type Thread = { feedback_id: string; submitted_at: string; category_slugs: string[]; reply_body: string | null; replied_at: string | null };

export async function FeedbackThreads({ stopId, language }: { stopId: string; language: string }) {
  if (!stopId) return null;
  const lang = (["de", "it", "en"].includes(language) ? language : "de") as Language;
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_public_feedback_threads", { p_bus_stop_id: stopId });
  const threads = (data ?? []) as Thread[];
  const t = copy[lang];
  const locale = lang === "de" ? "de-DE" : lang === "it" ? "it-IT" : "en-GB";

  return <section className="feedback-threads" id="feedback-threads" aria-labelledby="feedback-threads-title">
    <header><span>{t.eyebrow}</span><h2 id="feedback-threads-title">{t.title}</h2><p>{t.intro}</p></header>
    <div className="thread-list">
      {threads.map((thread) => <article className="thread" key={thread.feedback_id}>
        <div className="thread-post">
          <div className="anonymous-avatar" aria-hidden="true">A</div>
          <div><div className="thread-meta"><strong>{t.anonymous}</strong><time dateTime={thread.submitted_at}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(thread.submitted_at))}</time></div>
          <div className="thread-categories">{thread.category_slugs.map((slug) => <span key={slug}>{labels[slug]?.[lang] ?? slug}</span>)}</div></div>
        </div>
        {thread.reply_body ? <div className="thread-reply"><span aria-hidden="true">↳</span><div><strong>{t.reply}</strong><p>{thread.reply_body}</p>{thread.replied_at ? <time dateTime={thread.replied_at}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(thread.replied_at))}</time> : null}</div></div> : <p className="thread-waiting">{t.waiting}</p>}
      </article>)}
      {!threads.length ? <p className="threads-empty">{t.empty}</p> : null}
    </div>
  </section>;
}
