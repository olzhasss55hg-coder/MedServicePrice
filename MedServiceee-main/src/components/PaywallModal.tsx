"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Check, Sparkles, Crown, Zap, ShieldCheck, 
  Search, ArrowRight, Star, Clock, Lock, CheckCircle2 
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastContext";
import { useTranslation } from "@/i18n/LanguageContext";
import { api } from "@/lib/api";
import type { SearchQuota } from "@/lib/types";

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (plan: string) => void;
  quota?: SearchQuota | null;
  reason?: "limit_reached" | "manual" | "vip_booking";
}

export function PaywallModal({
  isOpen,
  onClose,
  onSuccess,
  quota,
  reason = "manual",
}: PaywallModalProps) {
  const { t, locale } = useTranslation();
  const toast = useToast();
  const isKz = locale === "kk";
  const [mounted, setMounted] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const currentPlan = quota?.plan || "free";

  const handleSelectPlan = async (plan: "standard" | "premium" | "free") => {
    if (plan === "free") {
      onClose();
      return;
    }

    setLoadingPlan(plan);
    try {
      const res = await api.upgradePlan(plan);
      
      // Dispatch global quota update event
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("search-quota-updated", {
          detail: {
            plan: res.plan,
            is_unlimited: true,
            priority_booking: res.priority_booking,
            searches_used: quota?.searches_used || 0,
            remaining: null,
            search_limit: null,
          }
        }));
      }

      toast.success(
        isKz 
          ? `«${plan === 'premium' ? 'PREMIUM VIP' : 'STANDARD'}» тарифі сәтті белсендірілді! 🚀`
          : `Тариф «${plan === 'premium' ? 'PREMIUM VIP' : 'STANDARD'}» успешно активирован! 🚀`
      );

      if (onSuccess) onSuccess(res.plan);
      onClose();
    } catch (err: any) {
      toast.error(err.message || (isKz ? "Тарифті белсендіру қатесі" : "Ошибка активации тарифа"));
    } finally {
      setLoadingPlan(null);
    }
  };

  const modalContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-4xl bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800 my-auto max-h-[92vh] overflow-y-auto"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors z-10"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-8">
            {reason === "limit_reached" ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider mb-3">
                <Lock className="w-3.5 h-3.5" />
                {t('paywall.limitReachedTitle')}
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold uppercase tracking-wider mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                {isKz ? "MedService Монетизация & Тарифтер" : "MedService Тарифные Планы"}
              </div>
            )}

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
              {reason === "limit_reached" ? t('paywall.limitReachedTitle') : t('paywall.modalTitle')}
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-2">
              {reason === "limit_reached" ? t('paywall.limitReachedSubtitle') : t('paywall.modalSubtitle')}
            </p>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

            {/* FREE TIER */}
            <div className={`relative rounded-2xl p-5 sm:p-6 border flex flex-col justify-between transition-all ${
              currentPlan === "free"
                ? "bg-slate-900/80 border-slate-700 shadow-sm"
                : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
            }`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {t('paywall.freeTitle')}
                  </span>
                  {currentPlan === "free" && (
                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                      {t('paywall.activeBadge')}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-black text-white">{t('paywall.freePrice')}</span>
                  <span className="text-xs text-slate-500">/ {t('paywall.freePeriod')}</span>
                </div>

                <p className="text-xs text-slate-400 mb-5">
                  {isKz ? "Базалық танысу үшін 20 тегін іздеу сұранысы" : "Базовый доступ с лимитом 20 бесплатных поисков"}
                </p>

                <ul className="space-y-3 text-xs text-slate-300 mb-6">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <span>{t('paywall.freeFeature1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <span>{t('paywall.freeFeature2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <span>{t('paywall.freeFeature3')}</span>
                  </li>
                </ul>
              </div>

              <Button
                variant="outline"
                disabled={currentPlan === "free"}
                onClick={() => handleSelectPlan("free")}
                className="w-full h-11 rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold"
              >
                {currentPlan === "free" ? t('paywall.activeBadge') : t('paywall.freeTitle')}
              </Button>
            </div>

            {/* TIER 1: STANDARD */}
            <div className={`relative rounded-2xl p-5 sm:p-6 border flex flex-col justify-between transition-all ${
              currentPlan === "standard" || currentPlan === "pro"
                ? "bg-teal-950/40 border-teal-500/60 shadow-lg shadow-teal-500/10 ring-1 ring-teal-500/50"
                : "bg-slate-900/90 border-teal-500/30 hover:border-teal-400/60"
            }`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    {t('paywall.standardTitle')}
                  </span>
                  {(currentPlan === "standard" || currentPlan === "pro") && (
                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 border border-teal-500/30">
                      {t('paywall.activeBadge')}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-black text-white">{t('paywall.standardPrice')}</span>
                  <span className="text-xs text-slate-400">/ {t('paywall.standardPeriod')}</span>
                </div>

                <p className="text-xs text-teal-200/80 mb-5 font-medium">
                  {isKz ? "Барлық 20 іздеу шектеулерін толық алып тастайды" : "Полное снятие барьера в 20 поисковых запросов"}
                </p>

                <ul className="space-y-3 text-xs text-slate-200 mb-6">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <span className="font-semibold text-teal-300">{t('paywall.standardFeature1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <span>{t('paywall.standardFeature2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <span>{t('paywall.standardFeature3')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <span>{t('paywall.standardFeature4')}</span>
                  </li>
                </ul>
              </div>

              <Button
                disabled={currentPlan === "standard" || loadingPlan !== null}
                onClick={() => handleSelectPlan("standard")}
                className="w-full h-11 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md shadow-teal-600/20 flex items-center justify-center gap-1.5"
              >
                {loadingPlan === "standard" ? t('paywall.activating') : (
                  currentPlan === "standard" ? t('paywall.activeBadge') : (
                    <>
                      <span>{t('paywall.standardBtn')}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )
                )}
              </Button>
            </div>

            {/* TIER 2: PREMIUM / VIP */}
            <div className={`relative rounded-2xl p-5 sm:p-6 border flex flex-col justify-between transition-all ${
              currentPlan === "premium" || currentPlan === "vip"
                ? "bg-amber-950/50 border-amber-500 shadow-xl shadow-amber-500/15 ring-2 ring-amber-500"
                : "bg-gradient-to-b from-slate-900 to-amber-950/30 border-amber-500/40 hover:border-amber-400 shadow-lg"
            }`}>
              {/* Top Banner Tag */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-md flex items-center gap-1 whitespace-nowrap">
                <Star className="w-3 h-3 fill-slate-950 text-slate-950" />
                {t('paywall.mostPopular')}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3 mt-1">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-400" />
                    {t('paywall.premiumTitle')}
                  </span>
                  {(currentPlan === "premium" || currentPlan === "vip") && (
                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {t('paywall.activeBadge')}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-black text-amber-400">{t('paywall.premiumPrice')}</span>
                  <span className="text-xs text-slate-400">/ {t('paywall.premiumPeriod')}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
                  <p className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                    <span>{isKz ? "Дәрігер кезегінде ЕҢ БІРІНШІ болып бекітіледі" : "Заявка на приём закрепляется на самом верху очереди"}</span>
                  </p>
                </div>

                <ul className="space-y-3 text-xs text-slate-200 mb-6">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{t('paywall.premiumFeature1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0 mt-0.5" />
                    <span className="font-bold text-amber-200">{t('paywall.premiumFeature2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{t('paywall.premiumFeature3')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{t('paywall.premiumFeature4')}</span>
                  </li>
                </ul>
              </div>

              <Button
                disabled={currentPlan === "premium" || loadingPlan !== null}
                onClick={() => handleSelectPlan("premium")}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 flex items-center justify-center gap-1.5"
              >
                {loadingPlan === "premium" ? t('paywall.activating') : (
                  currentPlan === "premium" ? t('paywall.activeBadge') : (
                    <>
                      <span>{t('paywall.premiumBtn')}</span>
                      <Crown className="w-3.5 h-3.5" />
                    </>
                  )
                )}
              </Button>
            </div>

          </div>

          {/* Footer Highlights */}
          <div className="border-t border-slate-800 pt-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>{t('paywall.securityGuarantee')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>{t('paywall.instantActivation')}</span>
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
