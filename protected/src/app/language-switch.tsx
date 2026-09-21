import { setLanguage } from "./actions";
import { languages } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";

/** Submits to a server action, so the server-rendered portal re-renders translated. */
export function LanguageSwitch({ language, label }: { language: Language; label: string }) {
  return (
    <div className="language-switch" role="group" aria-label={label}>
      {languages.map((code) => (
        <form action={setLanguage} key={code}>
          <input type="hidden" name="language" value={code} />
          <button type="submit" aria-pressed={language === code}>{code.toUpperCase()}</button>
        </form>
      ))}
    </div>
  );
}
