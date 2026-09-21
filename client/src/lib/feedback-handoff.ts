import type { Language } from "@/lib/i18n";

/**
 * The südtirolmobil contact form the thank-you page points to.
 * Only the German URL was supplied; the Italian and English pages of that site
 * use their own slugs, so add them here once they are known.
 */
export const FEEDBACK_FORM_URL: Record<Language, string> = {
  de: "https://www.suedtirolmobil.info/de/service-und-kontakt/feedback",
  it: "https://www.suedtirolmobil.info/de/service-und-kontakt/feedback",
  en: "https://www.suedtirolmobil.info/de/service-und-kontakt/feedback",
};

/**
 * Query parameter names that form accepts for pre-filling. That page is on
 * another site and could not be inspected from here, so nothing is appended
 * until the real names are known: sending invented parameters would look like
 * it works while silently doing nothing.
 *
 * Fill in what the form uses and the details travel with the link, e.g.
 *   { subject: "tx_powermail_pi1[field][subject]", message: "tx_powermail_pi1[field][message]" }
 */
export const FEEDBACK_FORM_PARAMS: { subject?: string; message?: string } = {};

/** Canonical category labels, matching the feedback_categories seed rows. */
const CATEGORY_LABELS: Record<string, Record<Language, string>> = {
  weather_protection: { de: "Witterungsschutz fehlt", it: "Manca la protezione dalle intemperie", en: "Weather protection is missing" },
  seating: { de: "Sitzplatz fehlt", it: "Mancano posti a sedere", en: "Seating is missing" },
  safe_sidewalk: { de: "Sicherer Gehweg zur Haltestelle fehlt", it: "Manca un percorso pedonale sicuro verso la fermata", en: "Safe footpath to the stop is missing" },
  safe_crossing: { de: "Keine sichere Querung der Straße zur Haltestelle", it: "Manca un attraversamento sicuro verso la fermata", en: "Safe road crossing to the stop is missing" },
  passenger_information: { de: "Fahrgastinformation fehlt oder ist mangelhaft", it: "Le informazioni ai passeggeri mancano o sono insufficienti", en: "Passenger information is missing or inadequate" },
  lighting: { de: "Beleuchtung fehlt", it: "Manca l’illuminazione", en: "Lighting is missing" },
  accessibility: { de: "Barrierefreiheit nicht gegeben", it: "La fermata non è accessibile", en: "Accessibility is inadequate" },
  shading: { de: "Beschattung fehlt", it: "Manca l’ombreggiatura", en: "Shade is missing" },
  bicycle_parking: { de: "Fahrradabstellplatz fehlt", it: "Manca il parcheggio per biciclette", en: "Bicycle parking is missing" },
  waste_bin: { de: "Abfallbehälter fehlt", it: "Manca il cestino dei rifiuti", en: "Waste bin is missing" },
};

const SEVERITY_LABELS: Record<string, Record<Language, string>> = {
  low: { de: "gering", it: "bassa", en: "low" },
  medium: { de: "mittel", it: "media", en: "medium" },
  high: { de: "hoch", it: "alta", en: "high" },
};

const SUMMARY_LABELS: Record<Language, { stop: string; categories: string; severity: string; description: string; subject: string }> = {
  de: { stop: "Haltestelle", categories: "Kategorien", severity: "Problemstärke", description: "Beschreibung", subject: "Rückmeldung zur Haltestelle" },
  it: { stop: "Fermata", categories: "Categorie", severity: "Urgenza", description: "Descrizione", subject: "Riscontro sulla fermata" },
  en: { stop: "Stop", categories: "Categories", severity: "Severity", description: "Description", subject: "Feedback on the stop" },
};

export type Handoff = { stop: string; categories: string[]; severity: string; description: string };

/** The submitted details as one block of text, ready to paste into any form. */
export function composeSummary(handoff: Handoff, language: Language) {
  const labels = SUMMARY_LABELS[language];
  const lines = [`${labels.stop}: ${handoff.stop}`];
  if (handoff.categories.length) {
    lines.push(`${labels.categories}: ${handoff.categories.map((slug) => CATEGORY_LABELS[slug]?.[language] ?? slug).join(", ")}`);
  }
  if (handoff.severity) lines.push(`${labels.severity}: ${SEVERITY_LABELS[handoff.severity]?.[language] ?? handoff.severity}`);
  if (handoff.description) lines.push(`${labels.description}: ${handoff.description}`);
  return lines.join("\n");
}

export function feedbackFormSubject(handoff: Handoff, language: Language) {
  return `${SUMMARY_LABELS[language].subject}: ${handoff.stop}`;
}

export function buildFeedbackFormUrl(handoff: Handoff | null, language: Language) {
  const url = new URL(FEEDBACK_FORM_URL[language]);
  if (handoff) {
    if (FEEDBACK_FORM_PARAMS.subject) url.searchParams.set(FEEDBACK_FORM_PARAMS.subject, feedbackFormSubject(handoff, language));
    if (FEEDBACK_FORM_PARAMS.message) url.searchParams.set(FEEDBACK_FORM_PARAMS.message, composeSummary(handoff, language));
  }
  return url.toString();
}
