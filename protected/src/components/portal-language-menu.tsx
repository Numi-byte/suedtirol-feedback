"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { setLanguage } from "@/app/actions";
import { languages, type Language } from "@/lib/i18n";
const names = { de: "Deutsch", it: "Italiano", en: "English" };
export function PortalLanguageMenu({ language, label }: { language: Language; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return <div className="portal-language-menu" ref={ref} onKeyDown={e => { if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
    <button ref={trigger} type="button" className="portal-language-trigger" aria-label={`${label}: ${names[language]}`} aria-expanded={open} onClick={() => setOpen(v => !v)}>
      <Image src="/icons/vector.png" alt="" width={16} height={16} /><span>{names[language]}</span><svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m4 6 4 4 4-4" /></svg>
    </button>
    {open ? <div className="portal-language-options">{languages.map(code => <form key={code} action={setLanguage} onSubmit={() => setOpen(false)}><input type="hidden" name="language" value={code} /><button type="submit" lang={code} aria-pressed={code === language}>{names[code]}</button></form>)}</div> : null}
  </div>;
}
