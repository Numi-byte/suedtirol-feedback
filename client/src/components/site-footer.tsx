"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import worldIcon from "@/components/vector.png";
import { languages, type Language } from "@/lib/i18n";

const companyName = "Südtiroler Transportstrukturen AG";
const languageNames: Record<Language, string> = {
  de: "Deutsch",
  it: "Italiano",
  en: "English",
};
const footerHrefs = [
  "https://www.sta.bz.it/de/impressum/",
  "https://www.suedtirolmobil.info/de/service-und-kontakt/privacy",
  "https://www.suedtirolmobil.info/de/service-und-kontakt",
] as const;

/**
 * The home screen is a fixed app shell around the map, so its footer is pinned
 * to the bottom of the viewport and kept to a single compact row. Every other
 * route scrolls, and gets the full footer at the end of the document.
 */
export function SiteFooter() {
  const { language, setLanguage, t } = useLanguage();
  const pathname = usePathname();
  const pinned = pathname === "/";

  if (pathname.startsWith("/feedback")) return null;

  const languagePicker = (
    <label className="footer-language">
      <span>Language</span>
      <span className="footer-language-select">
        <Image src={worldIcon} alt="" aria-hidden="true" width={16} height={16} />
        <select
          aria-label={t.nav.language}
          value={language}
          onChange={(event) => setLanguage(event.target.value as Language)}
        >
          {languages.map((code) => <option key={code} value={code}>{languageNames[code]}</option>)}
        </select>
      </span>
    </label>
  );

  return (
    <footer className={`site-footer${pinned ? " site-footer-pinned" : ""}`}>
      <div className="footer-inner">
        {!pinned && (
          <address className="footer-address">
            <strong>{companyName}</strong>
            <span>Gerbergasse 60, 39100 Bozen Italien</span>
            <a href="tel:+390471312888">+39 0471 312 888</a>
            <a href="mailto:info@sta.bz.it">info@sta.bz.it</a>
            <span>Mwst. Nr. 00586190217</span>
            <a className="footer-contact" href={footerHrefs[2]}>{t.footer.links[2]} <span aria-hidden="true">›</span></a>
          </address>
        )}
        {pinned && <p className="footer-company">{companyName}</p>}
        {pinned && (
          <p className="footer-service">
            <span>{t.nav.service}:</span>{" "}
            <a href="tel:+390471220880">+39 0471 220 880</a>
          </p>
        )}
        <div className="footer-meta">
          <div className="footer-links">
            {t.footer.links.slice(0, 2).map((link, index) => <a key={link} href={footerHrefs[index]}>{link}</a>)}
          </div>
          {languagePicker}
        </div>
      </div>
    </footer>
  );
}
