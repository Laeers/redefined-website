import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import ThemeScript from "@/components/ThemeScript";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Redefined Roleplay",
    template: "%s · Redefined Roleplay",
  },
  description:
    "Dansk FiveM ESX-server. Whitelist-only. RP i fokus, solid bande-RP og fede ulovlige jobs.",
  metadataBase: new URL("https://redefinedrp.dk"),
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: "/logo.png",
    shortcut: "/logo.png",
  },
  openGraph: {
    title: "Redefined Roleplay",
    description: "Dansk FiveM ESX — whitelist-only. RP, bande-RP og illegal jobs i fokus.",
    url: "https://redefinedrp.dk",
    siteName: "Redefined Roleplay",
    locale: "da_DK",
    type: "website",
    images: [
      {
        url: "/logo.png",
        alt: "Redefined Roleplay",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Redefined Roleplay",
    description:
      "Dansk FiveM ESX — whitelist-only. RP, bande-RP og illegal jobs i fokus.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="da"
      className={`${inter.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased">
        <ThemeScript />
        <Providers>
          <Navbar />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
