import { cookies } from "next/headers";
import { translations } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";

export const LANGUAGE_COOKIE = "suedtirolmobil-portal-language";

/**
 * The portal renders on the server, so the chosen language lives in a cookie
 * rather than in client state. Falls back to German.
 */
export async function getLanguage(): Promise<Language> {
  const stored = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  return stored === "it" || stored === "en" || stored === "de" ? stored : "de";
}

export async function getTranslations() {
  const language = await getLanguage();
  return { language, t: translations[language] };
}
