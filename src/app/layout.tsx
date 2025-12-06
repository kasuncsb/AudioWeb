import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ScrollStyles } from "./components/scrollstyles";
import "./globals.css";

// Use system fonts as fallback when Google Fonts are unavailable
// This ensures the app builds and works in all environments
const fontConfig = {
  geistSans: {
    variable: "--font-geist-sans",
    className: "font-sans",
  },
  geistMono: {
    variable: "--font-geist-mono", 
    className: "font-mono",
  },
  inter: {
    className: "font-sans",
  },
};

export const metadata: Metadata = {
  title: "AudioWeb - Play Audio Files Online",
  description: "A modern web-based music player for playing your favorite audio files directly in your browser. Supports multiple audio formats with an intuitive interface.",
  keywords: ["music player", "web audio player", "audio player", "music streaming", "browser music player", "online music player", "mp3 player"],
  authors: [{ name: "Kasun Chanaka" }],
  creator: "Kasun Chanaka",
  publisher: "Kasun Chanaka",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    type: "website",
  title: "AudioWeb",
    description: "A modern web-based music player for playing your favorite audio files directly in your browser.",
    siteName: "AudioWeb",
    url: "https://audioweb.vercel.app",
    images: [
      {
        url: "https://audioweb.vercel.app/images/aw-banner.png",
        width: 1280,
        height: 720,
  alt: "AudioWeb Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
  title: "AudioWeb",
    description: "A modern web-based music player for playing your favorite audio files directly in your browser.",
    images: ["https://audioweb.vercel.app/images/aw-banner.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="canonical" href="https://audioweb.vercel.app" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#14141c" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="AudioWeb" />
      </head>
      <body
        className={`${fontConfig.geistSans.variable} ${fontConfig.geistMono.variable} ${fontConfig.inter.className} antialiased`}
        style={{
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <ScrollStyles />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
