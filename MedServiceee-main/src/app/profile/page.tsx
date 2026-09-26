"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Crown, Loader2, Star, CheckCircle2, ShieldCheck, Tag } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { API_URL, api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastContext";
import { useTranslation } from "@/i18n/LanguageContext";
import type { Booking } from "@/lib/types";

interface Account {
  email: string;
  full_name?: string | null;
  plan: "free" | "pro" | "premium";
  ai_requests_used: number;
  ai_limit?: number | null;
  priority_booking: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const toast = useToast();
  const { locale } = useTranslation();
  const isKz = locale === "kk";

  const [account, setAccount] = useState<Account | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [upgrading, setUpgrading] = useState(false);

  const upgradePlan = async (plan: "pro" | "premium") => {
    setUpgrading(true);
    try {
      const res = await api.upgradePlan(plan);
      setAccount((prev) => prev ? { ...prev, plan: res.plan as any } : null);
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

  return (
    <div className="container mx-auto max-w-[1100px] px-4 py-8 pb-24 font-sans">
      
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">
          {isKz ? "Жеке кабинет" : "Личный кабинет"}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold text-slate-900">{account.full_name || account.email}</h1>
          {account.plan === "premium" && (
            <span className="inline-flex items-center gap-1 bg-amber-500 text-slate-950 text-xs font-extrabold px-3 py-1 rounded-full shadow-sm">
              <Crown className="w-3.5 h-3.5" /> PREMIUM · {isKz ? "Басымдықты жазылу" : "Приоритетная запись"}
            </span>
          )}
          {account.plan === "pro" && (
            <span className="inline-flex items-center gap-1 bg-teal-600 text-white text-xs font-extrabold px-3 py-1 rounded-full shadow-sm">
              PRO · {isKz ? "Шексіз AI" : "Безлимитный AI"}
            </span>
          )}
        </div>
        <p className="text-slate-500 text-sm mt-1">{account.email}</p>
      </div>

      {/* Tier & Quota Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        
        {/* Plan card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">{isKz ? "Тариф жоспары" : "Текущий тариф"}</p>
            <p className="text-2xl font-black text-slate-900 uppercase">{account.plan}</p>
            <p className="text-xs text-slate-500 mt-1">
              {account.plan === "free" ? (isKz ? "20 AI сұрау лимиті бар" : "Бесплатный лимит 20 AI-запросов") : (isKz ? "Шексіз AI көмекшісі" : "Безлимитный AI-ассистент")}
            </p>
          </div>
          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
            {account.plan !== "pro" && (
              <Button size="sm" variant="outline" disabled={upgrading} onClick={() => upgradePlan("pro")} className="flex-1 text-xs font-bold rounded-xl">
                Pro (2 990 ₸)
              </Button>
            )}
            {account.plan !== "premium" && (
              <Button size="sm" disabled={upgrading} onClick={() => upgradePlan("premium")} className="flex-1 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl">
                Premium (7 990 ₸)
              </Button>
            )}
          </div>
        </div>

        {/* AI Usage */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">{isKz ? "AI сұраулар" : "AI-запросы"}</p>
            <p className="text-2xl font-black text-teal-600">
              {account.ai_limit == null ? "∞ (Шексіз)" : `${account.ai_requests_used} / ${account.ai_limit}`}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {isKz ? "Медициналық триаж және іздеу" : "Консультации и подбор клиник"}
            </p>
          </div>
        </div>

        {/* Total Bookings */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">{isKz ? "Жазылулар саны" : "Всего записей"}</p>
            <p className="text-2xl font-black text-slate-900">{bookings.length}</p>
            <p className="text-xs text-slate-500 mt-1">
              {isKz ? "Белсенді және аяқталған" : "Активные и завершенные"}
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
