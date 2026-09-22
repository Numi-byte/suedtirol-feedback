"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { useLanguage } from "@/components/language-provider";

export function SiteHeader() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const current = (href: string) => (pathname === href ? "page" : undefined);

  // The reporting flow is a focused, self-contained dialog and deliberately
  // omits the main navigation to prevent accidental loss of entered data.
  if (pathname.startsWith("/feedback")) return null;

  return (
    <header className="site-header">
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
