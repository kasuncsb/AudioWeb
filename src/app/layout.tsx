import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import DomainMigrationBanner from "./components/DomainMigrationBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://aw.kasunc.uk"),
  title: "AudioWeb - Play Audio Files Online",
  applicationName: "AudioWeb",
  description: "A modern web-based music player for playing your favorite audio files directly in your browser. Supports multiple audio formats with an intuitive interface.",
  keywords: [
    "music player",
    "web audio player",
    "audio player",
    "online music player",
    "browser FLAC player",
    "local web audio player",
    "zero upload music player",
    "milkdrop visualizer online",
    "play mp3 in browser",
    "play flac online",
    "browser based 10 band equalizer",
    "winamp alternative browser",
    "open source web music player",
    "audio player with visualizer"
  ],
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
    url: "https://aw.kasunc.uk",
    images: [
      {
        url: "https://aw.kasunc.uk/images/aw-banner.png",
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
    images: ["https://aw.kasunc.uk/images/aw-banner.png"],
  },
  alternates: {
    canonical: "https://aw.kasunc.uk",
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
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "AudioWeb",
    alternateName: "AudioWeb Music Player",
    url: "https://aw.kasunc.uk/",
  };

  const appJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AudioWeb",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web Browser",
    url: "https://aw.kasunc.uk/",
    description: "A modern web-based music player for playing your favorite audio files directly in your browser.",
  };

  return (
    <html lang="en">
      <head>
        <link rel="canonical" href="https://aw.kasunc.uk" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="application-name" content="AudioWeb" />
        <meta name="theme-color" content="#14141c" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="AudioWeb" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.className} antialiased`}
      >
        <DomainMigrationBanner />
        {children}
      </body>
    </html>
  );
}
