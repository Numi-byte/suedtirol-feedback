"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { useLanguage } from "@/components/language-provider";

/**
 * The home screen is a fixed app shell around the map, so its footer is pinned
 * to the bottom of the viewport and kept to a single compact row. Every other
 * route scrolls, and gets the full footer at the end of the document.
 */
export function SiteFooter() {
  const { t } = useLanguage();
  const pinned = usePathname() === "/";

  if (pinned) {
    return (
      <footer className="site-footer site-footer-pinned">
        <div className="footer-inner">
          <p>{t.footer.note}</p>
          <div className="footer-links">
            {t.footer.links.map((link) => <Link key={link} href="/about">{link}</Link>)}
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div>
          <BrandLogo tone="dark" />
          <p className="footer-note">{t.footer.note}</p>
        </div>
        <div className="footer-links">
          {t.footer.links.map((link) => <Link key={link} href="/about">{link}</Link>)}
        </div>
      </div>
    </footer>
  );
}
