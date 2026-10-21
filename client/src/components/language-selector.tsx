"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import worldIcon from "@/components/vector.png";
import { languages, type Language } from "@/lib/i18n";

const languageNames: Record<Language, string> = { de: "Deutsch", it: "Italiano", en: "English" };

export function LanguageSelector({ className = "", variant = "select", value, onChange }: {
  className?: string; variant?: "select" | "menu"; value?: Language; onChange?: (language: Language) => void;
}) {
  const { language: siteLanguage, setLanguage, t } = useLanguage();
  const language = value ?? siteLanguage;
  const [open, setOpen] = useState(false);
  const optionsId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const chooseLanguage = (code: Language) => {
    setLanguage(code);
    onChange?.(code);
    // A language supplied in the URL must not undo the choice on reload.
    const url = new URL(window.location.href);
    if (!onChange && url.searchParams.has("lang")) {
      url.searchParams.set("lang", code);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    setOpen(false);
  };
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  if (variant === "menu") return (
    <div ref={containerRef} className={`language-selector language-menu ${className}`} onKeyDown={event => {
      if (event.key === "Escape" && open) {
        event.preventDefault(); event.stopPropagation(); setOpen(false); triggerRef.current?.focus();
      }
    }}>
      <button ref={triggerRef} type="button" className="language-selector-control language-menu-trigger"
        aria-label={`${t.nav.language}: ${languageNames[language]}`} aria-expanded={open} aria-controls={optionsId}
        onClick={() => setOpen(value => !value)}>
        <Image src={worldIcon} alt="" aria-hidden="true" width={16} height={16} />
        <span>{languageNames[language]}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m4 6 4 4 4-4" /></svg>
      </button>
      <div id={optionsId} className="language-menu-options" role="group" aria-label={t.nav.language} hidden={!open}>
        {languages.map(code => <button key={code} type="button" lang={code} aria-pressed={code === language}
          onClick={() => { chooseLanguage(code); triggerRef.current?.focus(); }}>{languageNames[code]}</button>)}
      </div>
    </div>
  );

  return (
    <label className={`language-selector ${className}`}>
      <span className="language-selector-control">
        <Image src={worldIcon} alt="" aria-hidden="true" width={16} height={16} />
        <select aria-label={t.nav.language} value={language}
          onChange={event => chooseLanguage(event.target.value as Language)}>
          {languages.map(code => <option key={code} value={code}>{languageNames[code]}</option>)}
        </select>
      </span>
    </label>
  );
}
