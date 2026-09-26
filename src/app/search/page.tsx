"use client";

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Search, SlidersHorizontal, MapPin, Star, Loader2, ArrowRight, Heart, X, Check, Lock, Crown, Zap, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { ClinicCard } from "@/components/ClinicCard"
import { useTranslation } from "@/i18n/LanguageContext"
import { buildApiUrl, getSearchSessionId } from "@/lib/api"
import { usePaywall } from "@/components/PaywallContext"

interface Clinic {
  id: string
  name: string
  city: string
  address: string
  source_url?: string | null
  rating?: number
  has_online_booking?: boolean
  has_active_promotion?: boolean
  latitude?: number | null
  longitude?: number | null
}

interface Service {
  id: string
  name_raw: string
  category: string
}

interface SearchResult {
  service: Service
  avg_price: number
  min_price: number
  clinics_count: number
  best_offer_clinic: Clinic
  best_offer_price: number
  last_updated_at?: string
}

function SearchPageContent() {
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams()
  const router = useRouter()
  const { quota, openPaywall, refreshQuota } = usePaywall();
  const isKz = locale === "kk";

  const initialQuery = searchParams.get("q") || ""
  const initialCity = searchParams.get("city") || "Алматы"

  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [city, setCity] = useState(initialCity)
  const [results, setResults] = useState<SearchResult[]>([])
  const [limitBlocked, setLimitBlocked] = useState(false)
  const [favorites, setFavorites] = useState<Record<string, SearchResult>>(() => {
    if (typeof window === "undefined") return {}
    const saved = localStorage.getItem("favorites")
    if (!saved) return {}
    try {
      return JSON.parse(saved) as Record<string, SearchResult>
    } catch {
      return {}
    }
  })

  const toggleFavorite = (result: SearchResult) => {
    const id = result.service.id
    setFavorites(prev => {
      const newFavs = { ...prev }
      if (newFavs[id]) {
        delete newFavs[id]
      } else {
        newFavs[id] = result
      }
      localStorage.setItem("favorites", JSON.stringify(newFavs))
      return newFavs
    })
  }

  // Price filter states
  const [minPriceInput, setMinPriceInput] = useState("")
  const [maxPriceInput, setMaxPriceInput] = useState("")
  const [minPrice, setMinPrice] = useState<number | null>(null)
  const [maxPrice, setMaxPrice] = useState<number | null>(null)

  const [minRating, setMinRating] = useState<number | null>(null)
  const [onlineBooking, setOnlineBooking] = useState<boolean | null>(null)
  const [specialty, setSpecialty] = useState("")
  const [language, setLanguage] = useState("")
  const [hasPromotion, setHasPromotion] = useState<boolean | null>(null)
  const [sortBy, setSortBy] = useState<string>("")
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(initialQuery)
      setCity(initialCity)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [initialQuery, initialCity])

  const fetchResults = async (q: string, c: string, minR: number | null, onB: boolean | null, sBy: string, minP: number | null, maxP: number | null, selectedSpecialty: string, selectedLanguage: string, selectedPromotion: boolean | null) => {
    setLoading(true)
    setError("")
    const sessionId = getSearchSessionId()

    try {
      let path = `/api/search?city=${encodeURIComponent(c || "Алматы")}`
      if (q && q.trim().length > 0) {
        path += `&q=${encodeURIComponent(q.trim())}`
      }
      if (minR !== null) path += `&min_rating=${minR}`
      if (onB !== null) path += `&online_booking=${onB}`
      if (sBy) path += `&sort_by=${sBy}`
      if (minP !== null) path += `&min_price=${minP}`
      if (maxP !== null) path += `&max_price=${maxP}`
      if (selectedSpecialty) path += `&specialty=${encodeURIComponent(selectedSpecialty)}`
      if (selectedLanguage) path += `&language=${encodeURIComponent(selectedLanguage)}`
      if (selectedPromotion !== null) path += `&has_promotion=${selectedPromotion}`

      const url = buildApiUrl(path)
      const res = await fetch(url, {
        headers: {
          "X-Search-Session": sessionId,
        },
        credentials: "include",
      })

      if (res.status === 402) {
        setLimitBlocked(true)
        setResults([])
        openPaywall("limit_reached")
        void refreshQuota()
        return
      }

      if (!res.ok) {
        throw new Error("Ошибка при поиске")
      }

      const rem = res.headers.get("X-Search-Remaining")
      const unlim = res.headers.get("X-Search-Unlimited")
      if (unlim === "true") {
        setLimitBlocked(false)
      } else if (rem !== null && parseInt(rem, 10) <= 0) {
        setLimitBlocked(true)
      } else {
        setLimitBlocked(false)
      }

      const data = await res.json()
      setResults(data)
      void refreshQuota()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchResults(searchQuery, city, minRating, onlineBooking, sortBy, minPrice, maxPrice, specialty, language, hasPromotion)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [searchQuery, city, minRating, onlineBooking, sortBy, minPrice, maxPrice, specialty, language, hasPromotion])

  const handleSearch = () => {
    if (limitBlocked || (quota && !quota.is_unlimited && quota.search_limit !== null && quota.searches_used >= quota.search_limit)) {
      openPaywall("limit_reached")
      return
    }
    router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}&city=${encodeURIComponent(city)}`)
  }

  const applyPriceFilter = () => {
    setMinPrice(minPriceInput ? parseInt(minPriceInput) : null)
    setMaxPrice(maxPriceInput ? parseInt(maxPriceInput) : null)
  }

  const filteredResults = results;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className="bg-background min-h-screen pt-4 pb-24">
      <div className="container mx-auto max-w-[1440px] px-4">

        {/* Mobile Search & Filter Toggle */}
        <div className="lg:hidden mb-4">
          <div className="flex items-center justify-between mb-2">
            {quota?.is_unlimited ? (
              <button
                onClick={() => openPaywall("manual")}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 border border-teal-200 text-teal-700 shadow-sm"
              >
                <Zap className="w-3.5 h-3.5 text-teal-600" />
                <span>{quota.plan === "premium" || quota.plan === "vip" ? "⭐ VIP Тариф (Шексіз іздеу)" : "⚡ Standard (Шексіз іздеу)"}</span>
              </button>
            ) : (
              <button
                onClick={() => openPaywall("manual")}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${
                  (quota?.searches_used || 0) >= 18
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : (quota?.searches_used || 0) >= 10
                    ? "bg-amber-50 border-amber-200 text-amber-700"
                    : "bg-slate-100 border-slate-200 text-slate-700"
                }`}
              >
                <Search className="w-3.5 h-3.5 text-primary" />
                <span>{isKz ? `Тегін іздеу лимиті: ${quota?.searches_used || 0}/20` : `Бесплатный поиск: ${quota?.searches_used || 0}/20`}</span>
                <span className="text-[10px] uppercase underline text-primary ml-1">{isKz ? "Тарифтер" : "Тарифы"}</span>
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder={t('search.searchPlaceholder')}
              icon={<Search className="w-5 h-5" />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-12 flex-1 bg-white shadow-sm"
            />
            <Button variant="outline" size="icon" className="h-12 w-12 shrink-0 bg-white shadow-sm" onClick={() => handleSearch()}>
              <Search className="w-5 h-5" />
            </Button>
            <Button 
              variant="outline" 
              className="h-12 px-3 bg-white shrink-0 flex items-center gap-1.5 border-primary/30 text-primary font-bold shadow-sm" 
              onClick={() => setMobileFiltersOpen(true)}
            >
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <span className="text-xs">{t('search.filters')}</span>
            </Button>
          </div>
        </div>

        {/* Mobile Filter Drawer / Modal */}
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-[200] lg:hidden flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm animate-in fade-in" onClick={() => setMobileFiltersOpen(false)}>
            <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-y-auto p-6 shadow-2xl border border-slate-100 animate-in slide-in-from-bottom duration-200" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-lg text-slate-900">{t('search.filters')}</h3>
                </div>
                <button onClick={() => setMobileFiltersOpen(false)} className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* City Selection */}
              <div className="space-y-2 mb-5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('search.city')}</label>
                <select
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}&city=${encodeURIComponent(e.target.value)}`);
                  }}
                  className="w-full h-11 bg-slate-100 rounded-xl px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="Алматы">{locale === 'kk' ? 'Алматы' : 'Алматы'}</option>
                  <option value="Астана">{locale === 'kk' ? 'Астана' : 'Астана'}</option>
                  <option value="Шымкент">{locale === 'kk' ? 'Шымкент' : 'Шымкент'}</option>
                  <option value={locale === 'kk' ? 'Қарағанды' : 'Караганда'}>{locale === 'kk' ? 'Қарағанды' : 'Караганда'}</option>
                  <option value="Павлодар">{locale === 'kk' ? 'Павлодар' : 'Павлодар'}</option>
                  <option value={locale === 'kk' ? 'Ақтөбе' : 'Актобе'}>{locale === 'kk' ? 'Ақтөбе' : 'Актобе'}</option>
                </select>
              </div>

              {/* Price Filter */}
              <div className="space-y-2 mb-5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('search.price')} (₸)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder={t('search.priceFrom')}
                    value={minPriceInput}
                    onChange={(e) => setMinPriceInput(e.target.value)}
                    className="w-full bg-slate-100 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <input
                    type="number"
                    placeholder={t('search.priceTo')}
                    value={maxPriceInput}
                    onChange={(e) => setMaxPriceInput(e.target.value)}
                    className="w-full bg-slate-100 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Rating */}
              <div className="space-y-2 mb-5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('search.rating')}</label>
                <select
                  value={minRating || ""}
                  onChange={(e) => setMinRating(e.target.value ? Number(e.target.value) : null)}
                  className="w-full h-11 bg-slate-100 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">{t('search.anyRating')}</option>
                  <option value="4.5">⭐ 4.5+</option>
                  <option value="4.0">⭐ 4.0+</option>
                  <option value="3.5">⭐ 3.5+</option>
                </select>
              </div>

              {/* Online Booking Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 mb-5">
                <span className="text-sm font-semibold text-slate-700">{locale === 'kk' ? 'Тек онлайн-жазылу бар клиникалар' : 'Только с онлайн-записью'}</span>
                <input
                  type="checkbox"
                  checked={onlineBooking === true}
                  onChange={(e) => setOnlineBooking(e.target.checked ? true : null)}
                  className="w-5 h-5 rounded text-primary focus:ring-primary"
                />
              </div>

              <Button
                className="w-full h-12 rounded-2xl bg-primary text-white font-bold shadow-md shadow-primary/25"
                onClick={() => {
                  applyPriceFilter();
                  setMobileFiltersOpen(false);
                }}
              >
                {t('search.apply')}
              </Button>
            </div>
          </div>
        )}

        {/* Mobile Categories Scroll */}
        <div className="lg:hidden overflow-x-auto pb-4 mb-2 -mx-4 px-4 flex gap-2 scrollbar-hide">
          {[
            { label: t('categories.tests'), value: "Анализы" },
            { label: t('categories.doctor'), value: "Прием врача" },
            { label: t('categories.ultrasound'), value: "УЗИ" },
            { label: "МРТ", value: "МРТ" },
            { label: t('search.xRay'), value: "Рентген" },
            { label: t('search.cbc'), value: "ОАК" }
          ].map(cat => (
            <button
              key={cat.value}
              onClick={() => { setSearchQuery(cat.value); router.push(`/search?q=${encodeURIComponent(cat.value)}&city=${encodeURIComponent(city)}`); }}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium border transition-colors ${searchQuery.toLowerCase().includes(cat.value.toLowerCase()) ? 'bg-primary text-white border-primary' : 'bg-white text-zinc-600 border-black/10 hover:border-primary/50'}`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">

          {/* Sidebar Filters */}
          <aside className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-28 space-y-6 bg-white p-6 rounded-3xl border border-black/5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <SlidersHorizontal className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-lg">{t('search.filters')}</h2>
              </div>

              {/* City Filter */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">{t('search.city')}</h3>
                <div className="relative flex items-center bg-black/5 rounded-xl h-12 hover:bg-black/10 transition-colors">
                  <MapPin className="w-4 h-4 text-primary absolute left-3 pointer-events-none" />
                  <select
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}&city=${encodeURIComponent(e.target.value)}`);
                    }}
                    className="w-full h-full bg-transparent pl-9 pr-8 appearance-none border-none outline-none text-sm font-medium cursor-pointer"
                  >
                    <option value="Алматы">{locale === 'kk' ? 'Алматы' : 'Алматы'}</option>
                    <option value="Астана">{locale === 'kk' ? 'Астана' : 'Астана'}</option>
                    <option value="Шымкент">{locale === 'kk' ? 'Шымкент' : 'Шымкент'}</option>
                    <option value={locale === 'kk' ? 'Қарағанды' : 'Караганда'}>{locale === 'kk' ? 'Қарағанды' : 'Караганда'}</option>
                    <option value="Павлодар">{locale === 'kk' ? 'Павлодар' : 'Павлодар'}</option>
                    <option value={locale === 'kk' ? 'Ақтөбе' : 'Актобе'}>{locale === 'kk' ? 'Ақтөбе' : 'Актобе'}</option>
                  </select>
                  <svg className="w-4 h-4 text-muted-foreground absolute right-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>

              {/* Category Filter */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">{t('search.category')}</h3>
                <div className="space-y-2">
                  {[
                    { label: t('categories.tests'), value: "Анализы" },
                    { label: t('categories.doctor'), value: "Прием врача" },
                    { label: t('categories.ultrasound'), value: "УЗИ" },
                    { label: "МРТ", value: "МРТ" },
                    { label: t('search.xRay'), value: "Рентген" },
                    { label: t('search.cbc'), value: "ОАК" }
                  ].map((cat) => (
                    <label key={cat.value} className="flex items-center gap-3 cursor-pointer group" onClick={() => { setSearchQuery(cat.value); router.push(`/search?q=${encodeURIComponent(cat.value)}&city=${encodeURIComponent(city)}`); }}>
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${searchQuery.toLowerCase().includes(cat.value.toLowerCase()) ? 'border-primary bg-primary' : 'border-gray-300 group-hover:border-primary'}`}>
                        {searchQuery.toLowerCase().includes(cat.value.toLowerCase()) && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <span className="text-sm">{cat.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price Filter */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">{t('search.price')}</h3>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder={t('search.priceFrom')}
                    value={minPriceInput}
                    onChange={(e) => setMinPriceInput(e.target.value)}
                    className="w-full bg-black/5 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-muted-foreground">-</span>
                  <input
                    type="number"
                    placeholder={t('search.priceTo')}
                    value={maxPriceInput}
                    onChange={(e) => setMaxPriceInput(e.target.value)}
                    className="w-full bg-black/5 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Rating Filter */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">{locale === 'en' ? 'Rating' : (locale === 'kk' ? 'Рейтинг' : 'Рейтинг')}</h3>
                <div className="relative flex items-center bg-black/5 rounded-xl h-12 hover:bg-black/10 transition-colors">
                  <Star className="w-4 h-4 text-primary absolute left-3 pointer-events-none" />
                  <select
                    value={minRating || ""}
                    onChange={(e) => setMinRating(e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full h-full bg-transparent pl-9 pr-8 appearance-none border-none outline-none text-sm font-medium cursor-pointer"
                  >
                    <option value="">{locale === 'en' ? 'Any' : (locale === 'kk' ? 'Кез келген' : 'Любой')}</option>
                    <option value="4.0">4.0+</option>
                    <option value="4.5">4.5+</option>
                  </select>
                  <svg className="w-4 h-4 text-muted-foreground absolute right-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>

              {/* Online Booking Filter */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${onlineBooking === true ? 'border-primary bg-primary' : 'border-gray-300 group-hover:border-primary'}`}>
                    <input type="checkbox" className="hidden" checked={onlineBooking === true} onChange={(e) => setOnlineBooking(e.target.checked ? true : null)} />
                    {onlineBooking === true && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                  <span className="text-sm font-semibold text-muted-foreground">{locale === 'en' ? 'Online Booking' : (locale === 'kk' ? 'Онлайн жазылу' : 'Онлайн запись')}</span>
                </label>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">{locale === 'kk' ? 'Мамандық' : 'Специальность'}</h3>
                <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="w-full h-12 bg-black/5 rounded-xl px-3 text-sm outline-none focus:ring-1 focus:ring-primary">
                  <option value="">{locale === 'kk' ? 'Кез келген' : 'Любая'}</option>
                  <option value="Терапевт">Терапевт</option>
                  <option value="Кардиолог">Кардиолог</option>
                  <option value="Невропатолог">Невропатолог</option>
                  <option value="Гинеколог">Гинеколог</option>
                  <option value="ЛОР">ЛОР</option>
                </select>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">{locale === 'kk' ? 'Қабылдау тілі' : 'Язык приема'}</h3>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full h-12 bg-black/5 rounded-xl px-3 text-sm outline-none focus:ring-1 focus:ring-primary">
                  <option value="">{locale === 'kk' ? 'Кез келген' : 'Любой'}</option>
                  <option value="ru">Русский</option>
                  <option value="kk">Қазақша</option>
                </select>
              </div>

              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${hasPromotion === true ? 'border-primary bg-primary' : 'border-gray-300 group-hover:border-primary'}`}>
                  <input type="checkbox" className="hidden" checked={hasPromotion === true} onChange={(e) => setHasPromotion(e.target.checked ? true : null)} />
                  {hasPromotion === true && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
                <span className="text-sm font-semibold text-muted-foreground">{locale === 'kk' ? 'Акциясы бар' : 'Есть акции'}</span>
              </label>

              <Button className="w-full mt-4" onClick={applyPriceFilter}>{t('search.apply')}</Button>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            <div className="hidden lg:block mb-6">
              <div className="flex items-center justify-between mb-2">
                {quota?.is_unlimited ? (
                  <button
                    onClick={() => openPaywall("manual")}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 transition-colors shadow-sm"
                  >
                    <Zap className="w-3.5 h-3.5 text-teal-600" />
                    <span>{quota.plan === "premium" || quota.plan === "vip" ? "⭐ VIP Тариф (Шексіз іздеу & Приоритет)" : "⚡ Standard (Шексіз іздеу)"}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => openPaywall("manual")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors shadow-sm ${
                      (quota?.searches_used || 0) >= 18
                        ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
                        : (quota?.searches_used || 0) >= 10
                        ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                        : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <Search className="w-3.5 h-3.5 text-primary" />
                    <span>{isKz ? `Тегін іздеу лимиті: ${quota?.searches_used || 0}/20` : `Бесплатный поиск: ${quota?.searches_used || 0}/20`}</span>
                    <span className="text-[10px] uppercase font-bold text-primary ml-1 underline">{isKz ? "Тарифті таңдау" : "Тарифы"}</span>
                  </button>
                )}
                <span className="text-xs text-slate-400">
                  {quota?.is_unlimited ? (isKz ? "Шектеусіз іздеу режимі" : "Безлимитный режим поиска") : (isKz ? "20 сұраныстан кейін Standard/VIP қажет" : "После 20 поисков требуется Standard/VIP")}
                </span>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder={t('search.searchPlaceholder')}
                    icon={<Search className="w-5 h-5 text-primary" />}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="h-14 bg-white text-lg shadow-sm"
                  />
                </div>
                <Button className="h-14 px-8" onClick={() => handleSearch()}>{t('hero.searchButton')}</Button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <h1 className="text-2xl font-bold text-foreground">
                {locale === 'en' ? 'Search Results' : (locale === 'kk' ? 'Іздеу нәтижелері' : 'Результаты поиска')} {initialQuery && (locale === 'en' ? `for "${initialQuery}"` : (locale === 'kk' ? `«${initialQuery}» бойынша` : `по запросу «${initialQuery}»`))} <span className="text-muted-foreground font-normal text-lg">({limitBlocked ? 0 : filteredResults.length})</span>
              </h1>

              {/* Sort By Select */}
              <div className="relative flex items-center bg-white border border-black/10 rounded-xl h-10 hover:border-primary/50 transition-colors shrink-0 min-w-[200px]">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full h-full bg-transparent pl-4 pr-8 appearance-none border-none outline-none text-sm font-medium cursor-pointer"
                >
                  <option value="">{locale === 'en' ? 'Sort by (Default)' : (locale === 'kk' ? 'Сұрыптау (Үнсіз)' : 'Сортировка (По умолчанию)')}</option>
                  <option value="price_asc">{locale === 'en' ? 'Price: Low to High' : (locale === 'kk' ? 'Баға: Өсуі бойынша' : 'Цена: По возрастанию')}</option>
                  <option value="price_desc">{locale === 'en' ? 'Price: High to Low' : (locale === 'kk' ? 'Баға: Кемуі бойынша' : 'Цена: По убыванию')}</option>
                  <option value="date_desc">{locale === 'en' ? 'Date: Newest First' : (locale === 'kk' ? 'Күні: Алдымен жаңа' : 'Дата: Сначала новые')}</option>
                </select>
                <svg className="w-4 h-4 text-muted-foreground absolute right-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>

            {limitBlocked ? (
              <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white p-8 sm:p-12 rounded-3xl text-center shadow-2xl border border-slate-800 my-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-5 text-rose-400">
                  <Lock className="w-8 h-8" />
                </div>
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-bold uppercase tracking-wider mb-3">
                  {isKz ? "Лимит 20/20 таусылды" : "Лимит 20/20 исчерпан"}
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white mb-3">
                  {t('paywall.limitReachedTitle')}
                </h3>
                <p className="text-slate-400 max-w-lg mx-auto text-sm sm:text-base mb-8 leading-relaxed">
                  {t('paywall.limitReachedSubtitle')}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
                  <Button
                    onClick={() => openPaywall("limit_reached")}
                    className="w-full h-12 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm shadow-lg shadow-teal-600/30 flex items-center justify-center gap-2"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Standard (1 990 ₸)</span>
                  </Button>
                  <Button
                    onClick={() => openPaywall("limit_reached")}
                    className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2"
                  >
                    <Crown className="w-4 h-4" />
                    <span>Premium VIP (4 990 ₸)</span>
                  </Button>
                </div>
              </div>
            ) : loading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="bg-red-50 text-red-600 p-6 rounded-2xl text-center shadow-sm">
                <p>{error}</p>
              </div>
            ) : filteredResults.length > 0 ? (
              <div className="space-y-6">
                {filteredResults.map((result, index) => (
                  <motion.div
                    key={result.service.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 hover:border-primary/20 transition-all"
                  >
                    <div className="mb-6 border-b border-black/5 pb-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded-md inline-block">
                              {result.service.category}
                            </span>
                            <button
                              onClick={() => toggleFavorite(result)}
                              className={`p-1.5 rounded-full transition-colors ${favorites[result.service.id] ? 'bg-rose-50 text-rose-500' : 'bg-black/5 text-muted-foreground hover:bg-rose-50 hover:text-rose-500'}`}
                            >
                              <Heart className={`w-4 h-4 ${favorites[result.service.id] ? 'fill-rose-500 text-rose-500' : ''}`} />
                            </button>
                          </div>
                          <h2 className="text-xl sm:text-2xl font-bold mt-1 text-slate-900 leading-snug">{result.service.name_raw}</h2>
                        </div>
                        <div className="text-left sm:text-right mt-1 sm:mt-0">
                          <p className="text-xs sm:text-sm text-muted-foreground">{t('search.averagePrice')}</p>
                          <p className="font-extrabold text-base sm:text-lg text-slate-900">~{Math.round(result.avg_price).toLocaleString('ru-RU')} ₸</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        {t('search.bestOffer').replace('{count}', result.clinics_count.toString())}
                      </h3>

                      <ClinicCard
                        clinicId={result.best_offer_clinic.id}
                        clinicName={result.best_offer_clinic.name}
                        address={result.best_offer_clinic.address}
                        city={result.best_offer_clinic.city}
                        latitude={result.best_offer_clinic.latitude}
                        longitude={result.best_offer_clinic.longitude}
                        price={result.best_offer_price}
                        sourceUrl={result.best_offer_clinic.source_url ?? ""}
                        lastUpdatedAt={result.last_updated_at}
                        rating={result.best_offer_clinic.rating}
                        hasOnlineBooking={result.best_offer_clinic.has_online_booking}
                      />

                      <div className="pt-4 mt-4 border-t border-black/5">
                        <Link href={`/compare/${result.service.id}?city=${encodeURIComponent(city)}`}>
                          <Button variant="outline" className="w-full sm:w-auto ml-auto flex bg-blue-50 text-blue-600 border-transparent hover:bg-blue-600 hover:text-white transition-colors">
                            {t('search.comparePrices').replace('{count}', result.clinics_count.toString())} <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : initialQuery ? (
              <div className="bg-white p-10 rounded-3xl text-center shadow-sm border border-black/5">
                <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-2">{t('search.noResults')}</h3>
                <p className="text-muted-foreground">{t('search.searchPlaceholder')}</p>
              </div>
            ) : (
              <div className="text-center py-20 text-muted-foreground">
                {locale === 'en' ? 'Enter a service name to search' : (locale === 'kk' ? 'Іздеу үшін қызмет атауын енгізіңіз' : 'Введите название услуги для поиска')}
              </div>
            )}

          </main>

        </div>
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex justify-center items-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
      <SearchPageContent />
    </Suspense>
  )
}
