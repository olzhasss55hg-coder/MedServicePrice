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

const inter = Inter({
  variable: "--font-inter",
  subsets: ["cyrillic", "latin"],
});

export const metadata: Metadata = {
  title: "MedServicePrice.kz - Клиникалар мен медициналық қызмет бағалары",
  description: "Қазақстандағы ең ірі клиникалар, дәрігерлер және талдау бағаларының агрегаторы",
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
            <Navbar />
            <main className="flex-1 flex flex-col">
              {children}
            </main>
            <AIChatWidget />
            <CommandPalette />
            <Footer />
            <BottomNav />
          </ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
