"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { useLanguage } from "@/components/language-provider";
import { languages } from "@/lib/i18n";

const PhoneIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
    <path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5L17 13l4 1.5v3a2.5 2.5 0 0 1-2.8 2.5A16.5 16.5 0 0 1 3.5 5.8 2.5 2.5 0 0 1 6 3Z" />
  </svg>
);

export function SiteHeader() {
  const { language, setLanguage, t } = useLanguage();
  const pathname = usePathname();
  const current = (href: string) => (pathname === href ? "page" : undefined);

  return (
    <header className="site-header">
      <div className="utility-bar">
        <div className="utility-inner">
          <a className="utility-link" href="tel:+390471220880"><PhoneIcon /> {t.nav.service} +39 0471 220 880</a>
          <div className="language-switch" role="group" aria-label={t.nav.language}>
            {languages.map((code) => (
              <button key={code} type="button" aria-pressed={language === code} onClick={() => setLanguage(code)}>
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="header-inner">
        <Link className="brand" href="/" aria-label={t.nav.home}>
          <BrandLogo />
        </Link>

        <nav aria-label="Primary navigation">
          <Link href="/stops" aria-current={current("/stops")}>{t.nav.find}</Link>
          <Link href="/how-it-works" aria-current={current("/how-it-works")}>{t.nav.how}</Link>
          <Link href="/about" aria-current={current("/about")}>{t.nav.about}</Link>
        </nav>

        <Link className="header-cta" href="/stops">{t.nav.cta}</Link>
      </div>
    </header>
  );
}
