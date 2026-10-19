"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { useLanguage } from "@/components/language-provider";

export function SiteHeader() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const current = (href: string) => (pathname === href ? "page" : undefined);

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMenuOpen(false); toggleRef.current?.focus(); }
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 1201px)");
    const resize = (event: MediaQueryListEvent) => { if (event.matches) setMenuOpen(false); };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    desktop.addEventListener("change", resize);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
      desktop.removeEventListener("change", resize);
    };
  }, [menuOpen]);

  // The reporting flow is a focused, self-contained dialog and deliberately
  // omits the main navigation to prevent accidental loss of entered data.
  if (pathname.startsWith("/feedback")) return null;

  return (
    <header className="site-header" ref={headerRef}>
      <div className="header-inner">
        <Link className="brand" href="/" aria-label={t.nav.home} onClick={() => setMenuOpen(false)}>
          <BrandLogo sub="" />
        </Link>

        <nav className="desktop-nav" aria-label={t.nav.navigation}>
          <Link href="/stops" aria-current={current("/stops")}>{t.nav.find}</Link>
          <Link href="/how-it-works" aria-current={current("/how-it-works")}>{t.nav.how}</Link>
          <Link href="/about" aria-current={current("/about")}>{t.nav.about}</Link>
        </nav>

        <Link className="header-cta" href="/stops">{t.nav.cta}</Link>
        <button ref={toggleRef} type="button" className="mobile-menu-toggle" aria-expanded={menuOpen}
          aria-controls="mobile-navigation" onClick={() => setMenuOpen(open => !open)}>
          <span>{t.nav.menu}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M4 5.75h16M4 12h16M4 18.25h16" />
          </svg>
        </button>
      </div>
      <nav id="mobile-navigation" className="mobile-navigation" aria-label={t.nav.navigation} hidden={!menuOpen}>
        <Link href="/stops" aria-current={current("/stops")} onClick={() => setMenuOpen(false)}>{t.nav.find}</Link>
        <Link href="/how-it-works" aria-current={current("/how-it-works")} onClick={() => setMenuOpen(false)}>{t.nav.how}</Link>
        <Link href="/about" aria-current={current("/about")} onClick={() => setMenuOpen(false)}>{t.nav.about}</Link>
        <Link className="mobile-nav-cta" href="/stops" onClick={() => setMenuOpen(false)}>{t.nav.cta}</Link>
      </nav>
    </header>
  );
}
