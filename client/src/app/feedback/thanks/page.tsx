import Link from "next/link";
import { CopySummary } from "../copy-summary";
import type { Language } from "@/lib/i18n";
import { buildFeedbackFormUrl, composeSummary } from "@/lib/feedback-handoff";
import type { Handoff } from "@/lib/feedback-handoff";

const copy = {
  de: {
    kicker: "Feedback gesendet",
    title: "Danke für deine Rückmeldung!",
    body: "Deine Meinung ist bei uns angekommen. Sie zählt und hilft uns dabei, die Haltestellen in Südtirol kontinuierlich zu verbessern. Vielen Dank dafür!",
    contactBefore: "Wenn du weitere Fragen, Anregungen oder Beschwerden hast, kannst du uns gerne über unser ",
    contactLink: "Feedbackformular",
    contactAfter: " kontaktieren.",
    summaryTitle: "Deine Angaben",
    copy: "Angaben kopieren", copied: "Kopiert",
    back: "Zurück zur Karte",
  },
  it: {
    kicker: "Riscontro inviato",
    title: "Grazie per il tuo riscontro!",
    body: "La tua opinione è arrivata. Conta e ci aiuta a migliorare costantemente le fermate in Alto Adige. Grazie di cuore!",
    contactBefore: "Se hai altre domande, suggerimenti o reclami, puoi contattarci tramite il nostro ",
    contactLink: "modulo di feedback",
    contactAfter: ".",
    summaryTitle: "I tuoi dati",
    copy: "Copia i dati", copied: "Copiato",
    back: "Torna alla mappa",
  },
  en: {
    kicker: "Feedback sent",
    title: "Thank you for your feedback!",
    body: "Your opinion has reached us. It counts and helps us keep improving the stops across South Tyrol. Thank you for that!",
    contactBefore: "If you have further questions, suggestions or complaints, you are welcome to contact us through our ",
    contactLink: "feedback form",
    contactAfter: ".",
    summaryTitle: "Your details",
    copy: "Copy details", copied: "Copied",
    back: "Back to the map",
  },
} as const;

const CheckIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m4 12.5 5.5 5.5L20 7" />
  </svg>
);

export default async function ThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; stop?: string; cats?: string; sev?: string; msg?: string }>;
}) {
  const params = await searchParams;
  const language = (["de", "it", "en"].includes(params.lang ?? "") ? params.lang : "de") as Language;
  const t = copy[language];

  const handoff: Handoff | null = params.stop
    ? {
        stop: params.stop,
        categories: (params.cats ?? "").split(",").filter(Boolean),
        severity: params.sev ?? "",
        description: params.msg ?? "",
      }
    : null;
  const summary = handoff ? composeSummary(handoff, language) : "";

  return (
    <main className="feedback-page">
      <section className="thanks">
        <div className="thanks-mark" aria-hidden="true"><CheckIcon /></div>
        <span>{t.kicker}</span>
        <h1>{t.title}</h1>
        <p>{t.body}</p>
        <p>
          {t.contactBefore}
          <a href={buildFeedbackFormUrl(handoff, language)} target="_blank" rel="noreferrer">{t.contactLink}</a>
          {t.contactAfter}
        </p>

        {summary ? (
          <div className="thanks-summary">
            <h2>{t.summaryTitle}</h2>
            <pre>{summary}</pre>
            <CopySummary summary={summary} label={t.copy} copiedLabel={t.copied} />
          </div>
        ) : null}

        <Link className="thanks-back" href="/">{t.back}</Link>
      </section>
    </main>
  );
}
