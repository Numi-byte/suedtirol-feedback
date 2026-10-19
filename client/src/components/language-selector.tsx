"use client";

import Image from "next/image";
import { useLanguage } from "@/components/language-provider";
import worldIcon from "@/components/vector.png";
import { languages, type Language } from "@/lib/i18n";

const languageNames: Record<Language, string> = { de: "Deutsch", it: "Italiano", en: "English" };

export function LanguageSelector({ className = "" }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();
  return (
    <label className={`language-selector ${className}`}>
      <span className="language-selector-control">
        <Image src={worldIcon} alt="" aria-hidden="true" width={16} height={16} />
        <select aria-label={t.nav.language} value={language}
          onChange={event => setLanguage(event.target.value as Language)}>
          {languages.map(code => <option key={code} value={code}>{languageNames[code]}</option>)}
        </select>
      </span>
    </label>
  );
}
