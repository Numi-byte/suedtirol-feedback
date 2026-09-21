"use client";

import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/language-provider";

const companyName = "STA – Südtiroler Transportstrukturen AG";
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

  if (pinned) {
    return (
      <footer className="site-footer site-footer-pinned">
        <div className="footer-inner">
          <p className="footer-company">{companyName}</p>
          <div className="footer-links">
            {t.footer.links.map((link, index) => <a key={link} href={footerHrefs[index]}>{link}</a>)}
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <p className="footer-company">{companyName}</p>
        <div className="footer-links">
          {t.footer.links.map((link, index) => <a key={link} href={footerHrefs[index]}>{link}</a>)}
        </div>
      </div>
    </footer>
  );
}
