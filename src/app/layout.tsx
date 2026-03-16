import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import "@/styles/hud-animations.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "WorldWideView | Geospatial Intelligence",
  description: "Next-generation, open-source geospatial intelligence platform.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Load CesiumJS base styles (optional, but helps with UI widgets if used later) */}
        <link rel="stylesheet" href="/cesium/Widgets/widgets.css" />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Analytics />
        <Script
          src="https://analytics.worldwideview.dev/script.js"
          data-website-id="2c8f6c09-2651-4a2a-af99-b8cee1612b9a"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
