"use client";

import Image from "next/image";
import Link from "next/link";
import instagram from "@/components/Insta.svg";
import linkedin from "@/components/linkedin.svg";
import youtube from "@/components/youtube.svg";
import arrowRight from "@/components/vectorarrowright.svg";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { LanguageSelector } from "@/components/language-selector";

const additionalFooterHrefs = [
  "https://www.suedtirolmobil.info/en/contact-us/terms-of-use",
  "https://www.suedtirolmobil.info/en/contact-us/privacy-and-cookie-policy",
  "https://www.suedtirolmobil.info/en/contact-us/complaints",
] as const;

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

  if (["/stops", "/how-it-works", "/about"].includes(pathname)) return (
    <footer className="site-footer site-footer-pages">
      <div className="footer-pages-inner">
        <div className="footer-pages-top">
          <div className="footer-company-column">
            <address className="footer-address">
              <strong>{t.footer.companyName}</strong>
              <div className="footer-address-details">
                <span>{t.footer.address}</span>
                <a href="tel:+390471312888">+39 0471 312 888</a>
                <a href="mailto:info@sta.bz.it">info@sta.bz.it</a>
                <span>{t.footer.vatLabel} 00586190217</span>
              </div>
              <a className="footer-contact" href={footerHrefs[2]}>{t.footer.links[2]}
                <span className="footer-contact-arrow" aria-hidden="true" style={{ maskImage: `url(${arrowRight.src})`, WebkitMaskImage: `url(${arrowRight.src})` }} />
              </a>
            </address>
            <div className="footer-socials">
              <a href="https://www.linkedin.com/company/sta-s%C3%BCdtiroler-transportstrukturen-ag/posts/" aria-label="LinkedIn"><Image src={linkedin} width={40} height={40} alt="" /></a>
              <a href="https://www.youtube.com/" aria-label="YouTube"><Image src={youtube} width={40} height={40} alt="" /></a>
              <a href="https://www.instagram.com/suedtirol.altoadige_mobility/" aria-label="Instagram"><Image src={instagram} width={40} height={40} alt="" /></a>
            </div>
          </div>
          <nav className="footer-page-links" aria-label={t.nav.navigation}>
            {[["/stops", t.nav.find], ["/how-it-works", t.nav.how], ["/about", t.nav.about]].map(([href, label]) => (
              <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>
            ))}
          </nav>
        </div>
        <div className="footer-pages-bottom">
          <div className="footer-links">
            {t.footer.links.slice(0, 2).map((link, index) => <a key={link} href={footerHrefs[index]}>{link}</a>)}
            {t.footer.additionalLinks.map((link, index) => <a key={link} href={additionalFooterHrefs[index]}>{link}</a>)}
          </div>
          <div className="footer-language-group"><span>{t.footer.languageLabel}</span><LanguageSelector className="footer-language" variant="menu" /></div>
        </div>
      </div>
    </footer>
  );

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
