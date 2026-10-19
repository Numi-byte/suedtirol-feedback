import type { Language } from "./i18n";

export function stopPointName(point: { name_de: string; name_it: string }, language: Language) {
  return (language === "de" ? point.name_de || point.name_it : point.name_it || point.name_de).trim();
}

export function pointFeedbackHref(pointId: string, language: Language) {
  return `/feedback?${new URLSearchParams({ point: pointId, lang: language })}`;
}
