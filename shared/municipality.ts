export type MunicipalityNames = {
  municipality?: string | null;
  municipality_de?: string | null;
  municipality_it?: string | null;
};

/** English uses the Italian name. Legacy values remain a display fallback;
 * their language is unknown, so they must not be copied into translation fields. */
export function municipalityName(stop: MunicipalityNames | null | undefined, language: "de" | "it" | "en"): string {
  if (!stop) return "";
  const names = language === "de"
    ? [stop.municipality_de, stop.municipality_it, stop.municipality]
    : [stop.municipality_it, stop.municipality_de, stop.municipality];
  return names.find(name => name?.trim())?.trim() ?? "";
}
