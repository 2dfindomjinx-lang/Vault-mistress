import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vault-mistress.vercel.app"),
  title: {
    default: "Vault Mistress · Principessa's Court",
    template: "%s · Vault Mistress",
  },
  description: "Enter Principessa's Court: devotion, loyalty, challenges, collections, and rewards under her command.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    description: "Enter Principessa's Court: devotion, loyalty, challenges, collections, and rewards under her command.",
    images: [
      {
        alt: "Vault Mistress — Enter Principessa's Court",
        height: 630,
        url: "/social/vault-mistress-og.png",
        width: 1200,
      },
    ],
    siteName: "Vault Mistress",
    title: "Vault Mistress · Principessa's Court",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    description: "Enter Principessa's Court: devotion, loyalty, challenges, collections, and rewards under her command.",
    images: ["/social/vault-mistress-og.png"],
    title: "Vault Mistress · Principessa's Court",
  },
};

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
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
