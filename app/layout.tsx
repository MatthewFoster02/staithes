import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { siteUrl } from "@/lib/seo/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Per-page generateMetadata calls override these. metadataBase is set
// here so relative OG/Twitter image URLs resolve correctly.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Staithes",
    template: "%s · Staithes",
  },
  description: "A short-stay holiday rental",
};

// Root layout intentionally minimal: just html/body/fonts. Each area
// of the app provides its own header/footer chrome via a nested
// layout — guest pages via app/(guest)/layout.tsx, admin pages via
// app/admin/layout.tsx — so they can look completely different
// without leaking style across the boundary.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
