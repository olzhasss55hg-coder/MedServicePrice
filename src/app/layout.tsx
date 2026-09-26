import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AIChatWidget } from "@/components/AIChatWidget";
import { Navbar } from "@/components/layout/Navbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Footer } from "@/components/layout/Footer";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { CommandPalette } from "@/components/CommandPalette";
import { ToastProvider } from "@/components/ui/ToastContext";
import { PaywallProvider } from "@/components/PaywallContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["cyrillic", "latin"],
});

const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://medservice.kz";

export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl),
  title: {
    default: "MedServicePrice.kz - Клиникалар мен медициналық қызмет бағалары",
    template: "%s | MedServicePrice.kz",
  },
  description: "Қазақстандағы ең ірі клиникалар, дәрігерлер және талдау бағаларының агрегаторы. Бағаларды салыстыру, онлайн жазылу және 2GIS маршруттары.",
  keywords: [
    "медицина",
    "клиника",
    "дәрігер",
    "анализ",
    "баға",
    "Алматы",
    "Астана",
    "Шымкент",
    "МРТ",
    "УЗИ",
    "MedService",
    "MedServicePrice",
  ],
  authors: [{ name: "MedService Team", url: appBaseUrl }],
  creator: "MedService.kz",
  publisher: "MedService.kz",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "MedServicePrice.kz - Клиникалар мен медициналық қызмет бағалары",
    description: "Қазақстандағы ең ірі клиникалар, дәрігерлер және талдау бағаларының агрегаторы",
    url: appBaseUrl,
    siteName: "MedServicePrice.kz",
    locale: "kk_KZ",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MedServicePrice.kz - Медициналық бағалар агрегаторы",
    description: "Клиникалар мен дәрігерлер бағасын салыстырып, ең тиімдісін таңдаңыз.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground selection:bg-primary/20">
        <LanguageProvider>
          <ToastProvider>
            <PaywallProvider>
              <Navbar />
              <main className="flex-1 flex flex-col">
                {children}
              </main>
              <AIChatWidget />
              <CommandPalette />
              <Footer />
              <BottomNav />
            </PaywallProvider>
          </ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
