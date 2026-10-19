"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LanguageSelector } from "@/components/language-selector";
import { BrandLogo } from "@/components/brand-logo";
import { useLanguage } from "@/components/language-provider";

export function SiteHeader() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const current = (href: string) => (pathname === href ? "page" : undefined);

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!viewport) return;
    const original = viewport.content;
    const mobile = window.matchMedia("(max-width: 767px)");
    const update = () => {
      const extend = mobile.matches && (pathname === "/" || menuOpen);
      viewport.content = extend
        ? `${original.replace(/,?\s*viewport-fit=[^,]+/g, "")}, viewport-fit=cover`
        : original;
      document.body.classList.toggle("mobile-edge-to-edge", extend);
    };
    update();
    mobile.addEventListener("change", update);
    return () => {
      mobile.removeEventListener("change", update);
      viewport.content = original;
      document.body.classList.remove("mobile-edge-to-edge");
    };
  }, [pathname, menuOpen]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!menuOpen || !dialog) return;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 768px)");
    const resize = (event: MediaQueryListEvent) => { if (event.matches) setMenuOpen(false); };
    desktop.addEventListener("change", resize);
    return () => {
      desktop.removeEventListener("change", resize);
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, [menuOpen]);

  // The reporting flow is a focused, self-contained dialog and deliberately
  // omits the main navigation to prevent accidental loss of entered data.
  if (pathname.startsWith("/feedback")) return null;

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href="/" aria-label={t.nav.home} onClick={() => setMenuOpen(false)}>
          <BrandLogo sub="" />
        </Link>

        <nav className="desktop-nav" aria-label={t.nav.navigation}>
          <Link href="/stops" aria-current={current("/stops")}>{t.nav.find}</Link>
          <Link href="/how-it-works" aria-current={current("/how-it-works")}>{t.nav.how}</Link>
          <Link href="/about" aria-current={current("/about")}>{t.nav.about}</Link>
        </nav>

        <Link className="header-cta" href="/">{t.nav.cta}</Link>
        <button ref={toggleRef} type="button" className="mobile-menu-toggle" aria-expanded={menuOpen}
          aria-controls="mobile-menu-dialog" aria-haspopup="dialog" onClick={() => setMenuOpen(open => !open)}>
          <span>{t.nav.menu}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M4 5.75h16M4 12h16M4 18.25h16" />
          </svg>
        </button>
      </div>
      <dialog id="mobile-menu-dialog" ref={dialogRef} className="mobile-menu-dialog" aria-label={t.nav.menu} aria-modal="true"
        onKeyDown={event => {
          if (event.key !== "Tab") return;
          const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("select:not([disabled]), button:not([disabled]), a[href]")];
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}
        onCancel={event => { event.preventDefault(); setMenuOpen(false); }}
        onClose={() => setMenuOpen(false)}
        onClick={event => { if (event.target === event.currentTarget) setMenuOpen(false); }}>
        <div className="mobile-menu-sheet">
          <div className="mobile-menu-tools">
            <LanguageSelector />
            <button autoFocus type="button" className="mobile-menu-close" aria-label={t.nav.closeMenu} onClick={() => setMenuOpen(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <nav id="mobile-navigation" className="mobile-navigation" aria-label={t.nav.navigation}>
            {[
              { href: "/stops", label: t.nav.find },
              { href: "/how-it-works", label: t.nav.how },
              { href: "/about", label: t.nav.about },
              { href: "/", label: t.nav.cta, cta: true },
            ].map(item => <Link key={item.label} className={item.cta ? "mobile-nav-cta" : undefined}
              href={item.href} aria-current={!item.cta ? current(item.href) : undefined} onClick={() => setMenuOpen(false)}>
              <span>{item.label}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
            </Link>)}
          </nav>
        </div>
      </dialog>
    </header>
  );
}
