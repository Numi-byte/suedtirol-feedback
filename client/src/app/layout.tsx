import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "südtirolmobil feedback",
  description: "Bewerte deine Haltestelle in Südtirol – Sauberkeit, Sicherheit, Barrierefreiheit und Information.",
};

export const viewport: Viewport = { themeColor: "#0069b4" };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
