"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/actions";
import { PortalLink } from "@/app/portal-navigation";
import { BrandLogo } from "./brand-logo";
import { PortalLanguageMenu } from "./portal-language-menu";
import { passwordCopy } from "@/lib/password-copy";
import { portalShellCopy } from "@/lib/portal-shell-copy";
import type { Language } from "@/lib/i18n";
import { portalHome, portalLinks, type PortalAccess } from "@/lib/portal-access";
const legal = ["https://www.sta.bz.it/de/impressum/", "https://www.suedtirolmobil.info/de/service-und-kontakt/privacy", "https://www.suedtirolmobil.info/en/contact-us/terms-of-use", "https://www.suedtirolmobil.info/en/contact-us/privacy-and-cookie-policy", "https://www.suedtirolmobil.info/en/contact-us/complaints"];
export function PortalHeader({ language, email, access }: { language: Language; email: string; access: PortalAccess }) {
  const links = portalLinks(access);
  const copy = portalShellCopy[language]; const pathname = usePathname();
  const [open, setOpen] = useState(false); const dialog = useRef<HTMLDialogElement>(null); const close = useRef<HTMLButtonElement>(null);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open || !dialog.current) return;
    const current = dialog.current; current.showModal(); close.current?.focus();
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 1440px)"); const resized = () => { if (desktop.matches) setOpen(false); }; desktop.addEventListener("change", resized);
    return () => { current.close(); document.body.style.overflow = overflow; desktop.removeEventListener("change", resized); };
  }, [open]);

  return <header className="portal-site-header"><div className="portal-header-inner">
    <Link href={portalHome(access) ?? "/"} aria-label={copy.home} className="portal-brand"><BrandLogo sub="portal" /></Link>
    <nav className="portal-desktop-nav" aria-label={copy.menu}>{links.map(({ href, section }) => <PortalLink href={href} key={href} aria-current={pathname === href ? "page" : undefined}>{copy[section]}</PortalLink>)}</nav>
    <form action={signOut} className="portal-desktop-signout" title={email}><PortalLink className="portal-password-link" href="/account/password" aria-label={passwordCopy[language].title} title={passwordCopy[language].title}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></svg></PortalLink><button className="portal-signout" type="submit">{copy.signOut}</button></form>
    <button type="button" className="portal-menu-toggle" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(true)}>{copy.menu}<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button>
    <dialog ref={dialog} className="portal-menu-dialog" aria-label={copy.menu} onCancel={e => { e.preventDefault(); setOpen(false); }} onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="portal-menu-tools"><PortalLanguageMenu language={language} label={copy.footer.languageLabel} /><button ref={close} type="button" className="portal-menu-close" aria-label={copy.close} onClick={() => setOpen(false)}>×</button></div>
      <nav>{links.map(({ href, section }) => <PortalLink key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => setOpen(false)}>{copy[section]}<span aria-hidden="true">›</span></PortalLink>)}</nav>
      <PortalLink className="portal-menu-password" href="/account/password" onClick={() => setOpen(false)}>{passwordCopy[language].title}</PortalLink>
      <span className="portal-menu-email">{email}</span><form action={signOut}><button className="portal-signout" type="submit">{copy.signOut}</button></form>
    </dialog>
  </div></header>;
}
export function PortalFooter({ language, access }: { language: Language; access: PortalAccess }) {
  const links = portalLinks(access);
  const copy = portalShellCopy[language]; const footer = copy.footer;
  return <footer className="portal-site-footer"><div className="portal-footer-inner">
    <div className="portal-footer-top"><div className="portal-footer-company"><address><strong>{footer.companyName}</strong><div><span>{footer.address}</span><a href="tel:+390471312888">+39 0471 312 888</a><a href="mailto:info@sta.bz.it">info@sta.bz.it</a><span>{footer.vatLabel} 00586190217</span></div><a className="portal-footer-contact" href="https://www.suedtirolmobil.info/de/service-und-kontakt">{footer.links[2]}<span aria-hidden="true" /></a></address>
    <div className="portal-footer-socials">{[["linkedin.svg", "LinkedIn", "https://www.linkedin.com/company/sta-s%C3%BCdtiroler-transportstrukturen-ag/posts/"], ["youtube.svg", "YouTube", "https://www.youtube.com/"], ["Insta.svg", "Instagram", "https://www.instagram.com/suedtirol.altoadige_mobility/"]].map(([icon, name, href]) => <a href={href} aria-label={name} key={name}><Image src={`/icons/${icon}`} alt="" width={40} height={40} /></a>)}</div></div>
    <nav className="portal-footer-nav" aria-label={footer.navigationTitle}><h2>{footer.navigationTitle}</h2>{links.map(({ href, section }) => <PortalLink href={href} key={href}>{copy[section]}</PortalLink>)}<PortalLink href="/account/password">{passwordCopy[language].title}</PortalLink></nav></div>
    <div className="portal-footer-bottom"><div className="portal-footer-legal">{[...footer.links.slice(0, 2), ...footer.additionalLinks].map((label, i) => <a href={legal[i]} key={label}>{label}</a>)}</div><div className="portal-footer-language"><span>{footer.languageLabel}</span><PortalLanguageMenu language={language} label={footer.languageLabel} /></div><Image src="/icons/provincelogo.svg" alt="Autonome Provinz Bozen – Südtirol / Provincia autonoma di Bolzano – Alto Adige" width={96} height={24} /></div>
  </div></footer>;
}
