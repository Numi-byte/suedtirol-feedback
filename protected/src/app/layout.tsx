import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = { title: "südtirolmobil feedback portal", description: "Internal feedback administration portal." };

export const viewport: Viewport = { themeColor: "#0069b4" };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
