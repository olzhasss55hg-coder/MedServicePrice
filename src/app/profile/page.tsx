"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Crown, Loader2, Star, CheckCircle2, ShieldCheck, Tag, Search, Zap, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { API_URL, api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastContext";
import { useTranslation } from "@/i18n/LanguageContext";
import { usePaywall } from "@/components/PaywallContext";
import type { Booking } from "@/lib/types";

interface Account {
  email: string;
  full_name?: string | null;
  plan: "free" | "standard" | "premium" | "pro" | "vip";
  ai_requests_used: number;
  ai_limit?: number | null;
  search_requests_used?: number;
  search_limit?: number | null;
  is_unlimited_search?: boolean;
  priority_booking: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const toast = useToast();
  const { openPaywall, refreshQuota } = usePaywall();
  const { locale } = useTranslation();
  const isKz = locale === "kk";

  const [account, setAccount] = useState<Account | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [upgrading, setUpgrading] = useState(false);

  const upgradePlan = async (plan: "standard" | "premium" | "free") => {
    setUpgrading(true);
    try {
      const res = await api.upgradePlan(plan);
      setAccount((prev) => prev ? { ...prev, plan: res.plan as any, priority_booking: !!res.priority_booking, is_unlimited_search: !!res.is_unlimited_search } : null);
      void refreshQuota();
      toast.success(isKz ? `Тариф сәтті жаңартылды: ${plan.toUpperCase()}` : `Тариф успешно обновлен до ${plan.toUpperCase()}`);
    } catch (err: any) {
      toast.error(err.message || "Ошибка обновления тарифа");
    } finally {
      setUpgrading(false);
    }
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/auth/me`, { credentials: "include" }),
      fetch(`${API_URL}/api/bookings/me`, { credentials: "include" }),
    ]).then(async ([accountResponse, bookingsResponse]) => {
      if (accountResponse.status === 401 || bookingsResponse.status === 401) {
        router.push("/login");
        return;
      }
      if (!accountResponse.ok || !bookingsResponse.ok) throw new Error("Не удалось загрузить профиль");
      setAccount(await accountResponse.json() as Account);
      setBookings(await bookingsResponse.json() as Booking[]);
    }).catch((requestError: unknown) => {
      setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить профиль");
    }).finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-3xl shadow-xl max-w-sm w-full border border-slate-200">
          <p className="text-rose-600 font-semibold mb-4">{error || "Профиль табылмады / Профиль не найден"}</p>
          <Button onClick={() => router.push("/login")} className="w-full bg-teal-600 hover:bg-teal-500 text-white rounded-xl">
            {isKz ? "Кіру" : "Войти"}
          </Button>
        </div>
      </div>
    );
  }

  const isUnlimited = account.is_unlimited_search || account.plan === "standard" || account.plan === "premium" || account.plan === "pro" || account.plan === "vip";
  const isVip = account.priority_booking || account.plan === "premium" || account.plan === "vip";

  return (
    <div className="container mx-auto max-w-[1100px] px-4 py-8 pb-24 font-sans">
      
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">
            {isKz ? "Жеке кабинет" : "Личный кабинет"}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold text-slate-900">{account.full_name || account.email}</h1>
            {isVip && (
              <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-xs font-black px-3.5 py-1 rounded-full shadow-md shadow-amber-500/20">
                <Crown className="w-3.5 h-3.5 fill-slate-950 text-slate-950" /> PREMIUM VIP · {isKz ? "Басымдықты кезек" : "Приоритетная запись"}
              </span>
            )}
            {!isVip && isUnlimited && (
              <span className="inline-flex items-center gap-1 bg-teal-600 text-white text-xs font-extrabold px-3 py-1 rounded-full shadow-sm">
                <Zap className="w-3.5 h-3.5" /> STANDARD · {isKz ? "Шексіз іздеу" : "Безлимитный поиск"}
              </span>
            )}
            {!isUnlimited && (
              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1 rounded-full border border-slate-200">
                FREE · {isKz ? "20 тегін іздеу" : "20 бесплатных поисков"}
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm mt-1">{account.email}</p>
        </div>

        <Button
          onClick={() => openPaywall("manual")}
          className="rounded-2xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white font-bold text-xs shadow-md shadow-teal-600/20 h-11 px-5"
        >
          <Sparkles className="w-4 h-4 mr-1.5" />
          {isKz ? "Тарифтерді салыстыру" : "Сравнить тарифы"}
        </Button>
      </div>

      {/* Tier & Quota Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        
        {/* Plan card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs uppercase font-bold tracking-wider text-slate-400">{isKz ? "Тариф жоспары" : "Текущий тариф"}</p>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                {account.plan.toUpperCase()}
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900">
              {account.plan === "premium" || account.plan === "vip" ? "PREMIUM VIP" : (account.plan === "standard" || account.plan === "pro" ? "STANDARD" : "FREE TIER")}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              {account.plan === "premium" || account.plan === "vip"
                ? (isKz ? "⭐ Дәрігер кезегінде ең бірінші + Шексіз іздеу" : "⭐ Запись на самом верху очереди + Безлимитный поиск")
                : account.plan === "standard" || account.plan === "pro"
                ? (isKz ? "Шексіз іздеу және толық каталог" : "Безлимитный поиск без ограничений")
                : (isKz ? "20 тегін іздеу лимиті бар" : "Базовый лимит 20 бесплатных поисков")}
            </p>
          </div>
          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
            {account.plan !== "standard" && (
              <Button size="sm" variant="outline" disabled={upgrading} onClick={() => upgradePlan("standard")} className="flex-1 text-xs font-bold rounded-xl border-teal-200 text-teal-700 hover:bg-teal-50">
                Standard (1 990 ₸)
              </Button>
            )}
            {account.plan !== "premium" && (
              <Button size="sm" disabled={upgrading} onClick={() => upgradePlan("premium")} className="flex-1 text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl shadow-md shadow-amber-500/20">
                Premium VIP (4 990 ₸)
              </Button>
            )}
          </div>
        </div>

        {/* Search Usage Quota */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs uppercase font-bold tracking-wider text-slate-400">{isKz ? "Іздеу лимиті" : "Лимит поиска"}</p>
              <Search className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-black text-teal-600">
              {isUnlimited ? "∞ (Шексіз)" : `${account.search_requests_used || 0} / 20`}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              {isUnlimited
                ? (isKz ? "Шектеусіз каталог іздеулері" : "Неограниченный поиск по услугам и клиникам")
                : (isKz ? `Қалған тегін іздеулер: ${Math.max(0, 20 - (account.search_requests_used || 0))}` : `Осталось поисков: ${Math.max(0, 20 - (account.search_requests_used || 0))}`)}
            </p>
          </div>
          {!isUnlimited && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full ${((account.search_requests_used || 0) >= 18) ? 'bg-rose-500' : ((account.search_requests_used || 0) >= 10) ? 'bg-amber-500' : 'bg-teal-500'}`}
                  style={{ width: `${Math.min(100, ((account.search_requests_used || 0) / 20) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Total Bookings & VIP Status */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs uppercase font-bold tracking-wider text-slate-400">{isKz ? "Жазылулар саны" : "Всего записей"}</p>
              <CalendarDays className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-black text-slate-900">{bookings.length}</p>
            <p className="text-xs text-slate-500 mt-2">
              {isVip
                ? (isKz ? "⭐ Барлық жазылулар VIP басымдықты болып барады" : "⭐ Все записи отправляются с VIP-приоритетом")
                : (isKz ? "Белсенді және аяқталған жазылулар" : "Активные и завершенные приёмы")}
            </p>
          </div>
        </div>
      </div>

      {/* Bookings List (Module 6) */}
      <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-lg text-slate-900">{isKz ? "Менің жазылуларым" : "Мои записи на приём"}</h2>
          </div>
          <span className="text-xs font-semibold text-slate-400">{bookings.length} {isKz ? "жазба" : "записей"}</span>
        </div>

        {bookings.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-sm">{isKz ? "Әзірге жазылулар жоқ." : "У вас пока нет активных записей."}</p>
            <Button onClick={() => router.push("/clinics")} className="mt-4 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold">
              {isKz ? "Дәрігер табу" : "Найти врача"}
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {bookings.map((booking) => (
              <div key={booking.id} className="p-6 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                <div>
                  <p className="font-bold text-base text-slate-900">{booking.doctor_name || "Дәрігер қабылдауы / Приём врача"}</p>
                  <p className="text-sm font-semibold text-teal-600">{booking.clinic_name || "Клиника"}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    📅 {booking.appointment_at ? new Date(booking.appointment_at).toLocaleString(isKz ? "kk-KZ" : "ru-RU") : (booking.preferred_time || "Уточняется")}
                  </p>
                  {booking.promo_code && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md mt-1">
                      <Tag className="w-3 h-3" /> {booking.promo_code} (-{booking.discount_amount} ₸)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {booking.priority_booking && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {isKz ? "Басымдықты" : "Приоритет"}
                    </span>
                  )}
                  <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                    {booking.status === "new" ? (isKz ? "Жаңа" : "Новая") : booking.status}
                  </span>
                  {booking.total_amount != null && (
                    <span className="font-black text-base text-slate-900">{booking.total_amount.toLocaleString("ru-RU")} ₸</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
