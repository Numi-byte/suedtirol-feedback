"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useTransition, type ComponentProps, type ReactNode } from "react";

const NavigationContext = createContext<{ pending: boolean; navigate: (href: string, scroll?: boolean) => void } | null>(null);

export function PortalNavigation({ children, loadingLabel }: { children: ReactNode; loadingLabel: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigate = (href: string, scroll = true) => startTransition(() => router.push(href, { scroll }));
  return <NavigationContext.Provider value={{ pending, navigate }}>
    {pending ? <div className="portal-loading-indicator" role="status"><span className="button-spinner" aria-hidden="true" />{loadingLabel}</div> : null}
    <div className="portal-navigation" aria-busy={pending}>{children}</div>
  </NavigationContext.Provider>;
}

/** Modified clicks still use the normal link behaviour, including new tabs. */
export function PortalLink({ href, scroll, ...props }: Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> & { href: string }) {
  const navigation = useContext(NavigationContext);
  return <Link {...props} href={href} scroll={scroll} prefetch={false} aria-disabled={navigation?.pending || undefined}
    onNavigate={event => {
      if (!navigation) return;
      event.preventDefault();
      if (props["aria-current"] === "page") {
        const anchor = new URL(href, window.location.href).hash.slice(1);
        if (anchor) document.getElementById(anchor)?.scrollIntoView({ block: "start" });
        return;
      }
      if (!navigation.pending) navigation.navigate(href, scroll);
    }} />;
}

export function PortalSearchForm({ children, className }: { children: ReactNode; className?: string }) {
  const navigation = useContext(NavigationContext);
  return <form className={className} method="get" onSubmit={event => {
    if (!navigation) return;
    event.preventDefault();
    if (navigation.pending) return;
    const query = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    const url = new URL(window.location.href);
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    url.searchParams.delete("page");
    url.searchParams.delete("stop");
    url.hash = "stop-database";
    navigation.navigate(`${url.pathname}${url.search}${url.hash}`);
  }}>{children}</form>;
}
