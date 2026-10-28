"use client";

import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { LanguageSelector } from "@/components/language-selector";

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
  const { t } = useLanguage();
  const pathname = usePathname();
  const pinned = pathname === "/";

  if (pathname.startsWith("/feedback")) return null;

  return (
    <footer className={`site-footer${pinned ? " site-footer-pinned" : ""}`}>
      <div className="footer-inner">
        {!pinned && (
          <address className="footer-address">
            <strong>{t.footer.companyName}</strong>
            <span>{t.footer.address}</span>
            <a href="tel:+390471312888">+39 0471 312 888</a>
            <a href="mailto:info@sta.bz.it">info@sta.bz.it</a>
            <span>{t.footer.vatLabel} 00586190217</span>
            <a className="footer-contact" href={footerHrefs[2]}>{t.footer.links[2]} <span aria-hidden="true">›</span></a>
          </address>
        )}
        {pinned && <p className="footer-company">{t.footer.companyName}</p>}
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
          <LanguageSelector className="footer-language" variant="menu" />
        </div>
      </div>
    </footer>
  );
}
