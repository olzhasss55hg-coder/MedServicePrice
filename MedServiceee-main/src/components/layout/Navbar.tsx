"use client"

import Link from "next/link"
import { Search, Heart, User, Menu, LogOut, Network, Command, Stethoscope } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "@/i18n/LanguageContext"
import { API_URL } from "@/lib/api"
import { Badge } from "@/components/ui/Badge"

export function Navbar() {
  const { t, locale, setLocale } = useTranslation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = window.setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/api/auth/me`, { credentials: "include" });
         setIsAuthenticated(response.ok);
         if (response.ok) {
           const user = await response.json() as { plan?: string };
           setPlan(user.plan || "free");
         } else {
           setPlan(null);
         }
      } catch {
        setIsAuthenticated(false);
        setPlan(null);
      }
    }, 0);
    return () => window.clearTimeout(checkAuth);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
    } catch {
    } finally {
      setIsAuthenticated(false);
      setPlan(null);
      router.push("/");
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
      <div className="container mx-auto max-w-[1440px] px-4 h-20 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-teal-700/20">
              M
            </div>
            <span className="font-bold text-xl tracking-tight hidden sm:inline-block text-slate-900">
              MedService<span className="text-teal-600">Price</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/search" className="hover:text-teal-600 transition-colors">{t('navbar.services')}</Link>
            <Link href="/clinics" className="hover:text-teal-600 transition-colors">{t('navbar.clinics')}</Link>
            <Link href="/symptom-checker" className="inline-flex items-center gap-1.5 text-teal-700 font-semibold bg-teal-50 px-2.5 py-1 rounded-xl border border-teal-200/60 hover:bg-teal-100 transition-colors">
              <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
              {locale === 'kk' ? 'Симптом Чекер' : 'Симптом Чекер'}
            </Link>
            <Link href="/promotions" className="hover:text-teal-600 transition-colors">{t('navbar.promotions')}</Link>
            <Link href="/about" className="hover:text-teal-600 transition-colors">{t('navbar.about')}</Link>
            <Link href="/decision-map" className="inline-flex items-center gap-1.5 hover:text-teal-600 transition-colors">
              <Network className="w-4 h-4" /> {t('navbar.decisionMap')}
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3 mr-2">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
              className="hidden xl:inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:border-teal-500/40 hover:text-teal-600 transition-colors"
              aria-label="Search"
            >
              <Command className="w-3.5 h-3.5" /> <span>{t('navbar.searchCommand')}</span><kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
            </button>
            <Link href="/search">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-black/5">
                <Search className="w-5 h-5 text-slate-700" />
              </Button>
            </Link>
            <Link href="/favorites">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-black/5 text-rose-500 hover:text-rose-600 hover:bg-rose-50">
                <Heart className="w-5 h-5" />
              </Button>
            </Link>
          </div>
          
          <div className="flex gap-1 ml-2 mr-2 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setLocale('ru')}
              className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${locale === 'ru' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              RU
            </button>
            <button
              onClick={() => setLocale('kk')}
              className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${locale === 'kk' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              KK
            </button>
          </div>

          <Link href="/for-clinics" className="hidden sm:flex">
            <Button variant="outline" className="rounded-xl border-slate-200 text-slate-700 font-semibold text-xs h-9">
              {t('navbar.forClinics')}
            </Button>
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Link href="/profile">
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-black/5" aria-label="Профиль">
                  <User className="w-5 h-5 text-slate-700" />
                </Button>
              </Link>
              {plan === "premium" && <Badge variant="ai" className="hidden sm:inline-flex bg-amber-500 text-slate-950 font-bold">PREMIUM</Badge>}
              {plan === "pro" && <Badge variant="ai" className="hidden sm:inline-flex bg-teal-600 text-white font-bold">PRO</Badge>}
              <Button onClick={handleLogout} variant="outline" className="rounded-xl border-slate-200 hover:bg-slate-100 text-xs h-9 font-semibold">
                <LogOut className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
                <span>{t('navbar.logout')}</span>
              </Button>
            </div>
          ) : (
            <Link href="/login">
              <Button className="rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs h-9 shadow-md shadow-teal-600/20">
                <User className="w-3.5 h-3.5 mr-1.5" />
                {t('navbar.login')}
              </Button>
            </Link>
          )}
          
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <Menu className="w-6 h-6" />
          </Button>
        </div>
      </div>
      
      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-20 left-0 w-full bg-white border-b border-slate-200 shadow-xl py-4 px-6 flex flex-col gap-4 z-40">
          <Link href="/search" className="text-base font-semibold text-slate-800" onClick={() => setIsMobileMenuOpen(false)}>{t('navbar.services')}</Link>
          <Link href="/clinics" className="text-base font-semibold text-slate-800" onClick={() => setIsMobileMenuOpen(false)}>{t('navbar.clinics')}</Link>
          <Link href="/symptom-checker" className="text-base font-semibold text-teal-600 flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
            <Stethoscope className="w-4 h-4" /> AI Симптом Чекер
          </Link>
          <Link href="/promotions" className="text-base font-semibold text-slate-800" onClick={() => setIsMobileMenuOpen(false)}>{t('navbar.promotions')}</Link>
          <Link href="/about" className="text-base font-semibold text-slate-800" onClick={() => setIsMobileMenuOpen(false)}>{t('navbar.about')}</Link>
          <Link href="/decision-map" className="text-base font-semibold text-slate-800" onClick={() => setIsMobileMenuOpen(false)}>{t('navbar.decisionMap')}</Link>
          <Link href="/for-clinics" className="text-base font-semibold text-slate-800 sm:hidden" onClick={() => setIsMobileMenuOpen(false)}>{t('navbar.forClinics')}</Link>
        </div>
      )}
    </header>
  )
}
