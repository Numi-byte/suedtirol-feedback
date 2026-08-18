import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { getLanguage } from "@/lib/language";
import "./globals.css";

export const metadata: Metadata = { title: "südtirolmobil feedback portal", description: "Internal feedback administration portal." };

export const viewport: Viewport = { themeColor: "#005980" };

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const language = await getLanguage();
  return <html lang={language}><body>{children}</body></html>;
}
