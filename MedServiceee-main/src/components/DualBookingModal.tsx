"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { 
  X, ExternalLink, Calendar, Clock, Tag, User, Phone, Mail, 
  CheckCircle2, Sparkles, AlertCircle, Building2, Stethoscope, ChevronRight 
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/ToastContext";
import { useTranslation } from "@/i18n/LanguageContext";
import { API_URL, api } from "@/lib/api";
import type { Doctor, PromoCodeResponse } from "@/lib/types";

interface DualBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinicId?: string;
  clinicName: string;
  clinicCity?: string;
  clinicAddress?: string;
  sourceUrl?: string | null;
  initialDoctor?: Doctor | null;
  serviceName?: string;
  basePrice?: number;
}

const DEFAULT_SLOTS = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];

export function DualBookingModal({
  isOpen,
  onClose,
  clinicId,
  clinicName,
  clinicCity = "Алматы",
  clinicAddress,
  sourceUrl,
  initialDoctor,
  serviceName,
  basePrice = 10000,
}: DualBookingModalProps) {
  const { locale } = useTranslation();
  const toast = useToast();
  const isKz = locale === "kk";

  // Mode: "choice" (initial dual view) | "internal" (booking form) | "success"
  const [step, setStep] = useState<"choice" | "internal" | "success">("choice");

  // Doctors & Selection
  const [doctors, setDoctors] = useState<Doctor[]>(initialDoctor ? [initialDoctor] : []);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(initialDoctor || null);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  // Form State
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [bookingDate, setBookingDate] = useState(tomorrowStr);
  const [bookingTime, setBookingTime] = useState("10:00");
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("+7 ");
  const [patientEmail, setPatientEmail] = useState("");
  const [promoCodeInput, setPromoCodeInput] = useState("");
  
  // Promo code validation
  const [promoValidation, setPromoValidation] = useState<PromoCodeResponse | null>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [promoError, setPromoError] = useState("");

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [bookingRefId, setBookingRefId] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setStep("choice");
    setPromoValidation(null);
    setPromoError("");
    setBookingRefId("");

    if (initialDoctor) {
      setSelectedDoctor(initialDoctor);
      setDoctors([initialDoctor]);
    } else if (clinicId) {
      setLoadingDoctors(true);
      api.getClinicDetails(clinicId)
        .then((data) => {
          setDoctors(data.doctors || []);
          if (data.doctors && data.doctors.length > 0) {
            setSelectedDoctor(data.doctors[0]);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingDoctors(false));
    }
  }, [isOpen, clinicId, initialDoctor]);

  const effectivePrice = selectedDoctor
    ? (selectedDoctor.consultation_price || selectedDoctor.price || basePrice)
    : basePrice;

  const finalPrice = promoValidation ? promoValidation.total_amount : effectivePrice;
  const discountAmount = promoValidation ? promoValidation.discount_amount : 0;

  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim()) return;
    setValidatingPromo(true);
    setPromoError("");
    try {
      const res = await api.validatePromoCode(promoCodeInput.trim(), effectivePrice, clinicId);
      setPromoValidation(res);
      toast.success(isKz ? `Промокод қабылданды! Жеңілдік: ${res.discount_amount} ₸` : `Промокод применен! Скидка: ${res.discount_amount} ₸`);
    } catch (err: any) {
      setPromoValidation(null);
      const errMsg = err?.message || (isKz ? "Промокод жарамсыз" : "Неверный промокод");
      setPromoError(errMsg);
      toast.error(errMsg);
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleExternalRedirect = () => {
    const targetUrl = sourceUrl || `https://2gis.kz/search/${encodeURIComponent(`${clinicName} ${clinicCity}`)}`;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
    toast.info(isKz ? "Клиника сайтына бағытталды" : "Перенаправление на официальный сайт клиники");
    onClose();
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || patientPhone.trim().length < 8) {
      toast.error(isKz ? "Атыңызды және телефон нөміріңізді толтырыңыз" : "Укажите имя и корректный номер телефона");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        clinic_id: clinicId || (selectedDoctor?.clinic_id ?? "unknown"),
        doctor_id: selectedDoctor?.id || undefined,
        name: patientName.trim(),
        phone: patientPhone.trim(),
        preferred_time: bookingTime || undefined,
        appointment_at: bookingDate && bookingTime ? `${bookingDate}T${bookingTime}:00` : undefined,
        promo_code: promoValidation ? promoCodeInput.trim().toUpperCase() : undefined,
      };

      const res = await api.createBooking(payload);
      setBookingRefId(res.id || "OK");
      setStep("success");
      toast.success(isKz ? "Жазылу сәтті қабылданды!" : "Запись успешно оформлена!");
    } catch (err: any) {
      toast.error(err?.message || (isKz ? "Жазылу кезінде қате орын алды" : "Ошибка при оформлении записи"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl relative animate-in zoom-in-95 duration-200 border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base line-clamp-1">{clinicName}</h3>
              <p className="text-xs text-slate-500">{clinicCity}{clinicAddress ? `, ${clinicAddress}` : ""}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {/* STEP 1: DUAL CHOICE VIEW */}
          {step === "choice" && (
            <div className="space-y-5 animate-in fade-in">
              <div className="text-center mb-6">
                <h4 className="text-xl font-extrabold text-slate-900 mb-1">
                  {isKz ? "Қабылдауға жазылу әдісін таңдаңыз" : "Выберите способ записи на прием"}
                </h4>
                {serviceName && (
                  <p className="text-sm font-medium text-teal-700 bg-teal-50 py-1 px-3 rounded-full inline-block mt-2">
                    {serviceName}
                  </p>
                )}
              </div>

              {/* Option B: Instant Platform Booking (Recommended) */}
              <div 
                onClick={() => setStep("internal")}
                className="p-5 rounded-2xl border-2 border-teal-500 bg-gradient-to-br from-teal-50/70 via-white to-emerald-50/50 hover:shadow-lg transition-all cursor-pointer relative group"
              >
                <div className="absolute -top-3 right-4 bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-[11px] font-bold px-3 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <Sparkles className="w-3 h-3" />
                  {isKz ? "Жеңілдікпен жылдам жазылу" : "Со скидкой и бонусами"}
                </div>
                
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h5 className="font-bold text-slate-900 text-lg group-hover:text-teal-700 transition-colors flex items-center gap-2">
                      {isKz ? "Осында жазылу (MedService арқылы)" : "Записаться здесь онлайн"}
                    </h5>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {isKz 
                        ? "Дәрігерді, қолайлы уақытты таңдаңыз, промокод қолданыңыз және SMS-растау алыңыз."
                        : "Выбор врача, слота времени, поддержка промокодов на скидку и мгновенное SMS-уведомление."}
                    </p>
                    <div className="mt-3 flex items-center gap-2 flex-wrap text-xs font-semibold text-teal-700">
                      <span className="bg-white/90 border border-teal-200 px-2 py-0.5 rounded-md">Промокод -15%</span>
                      <span className="bg-white/90 border border-teal-200 px-2 py-0.5 rounded-md">SMS-ескерту</span>
                      <span className="bg-white/90 border border-teal-200 px-2 py-0.5 rounded-md">Кезексіз қабылдау</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-md">
                    <ChevronRight className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Option A: Official Site Redirection */}
              <div 
                onClick={handleExternalRedirect}
                className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100/80 hover:border-slate-300 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h5 className="font-bold text-slate-800 text-base group-hover:text-slate-900 transition-colors flex items-center gap-1.5">
                      {isKz ? "Клиниканың ресми сайтында жазылу" : "Записаться на сайте клиники"}
                    </h5>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {isKz 
                        ? "Клиниканың ресми веб-порталына немесе тіркеу бөліміне тікелей өту."
                        : "Прямой переход на официальный сайт или регистратуру медицинского центра."}
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center shrink-0 group-hover:text-slate-900 shadow-sm">
                    <ExternalLink className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: INTERNAL BOOKING FORM */}
          {step === "internal" && (
            <form onSubmit={handleSubmitBooking} className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
                <button 
                  type="button" 
                  onClick={() => setStep("choice")}
                  className="text-xs font-bold text-slate-500 hover:text-teal-700 flex items-center gap-1"
                >
                  ← {isKz ? "Артқа" : "Назад к выбору"}
                </button>
                <span className="text-xs font-semibold text-slate-400">MedService Direct</span>
              </div>

              {/* Doctor Selector */}
              {doctors.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {isKz ? "Дәрігерді таңдаңыз" : "Выберите врача"}
                  </label>
                  <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                    {doctors.map((doc) => {
                      const isSelected = selectedDoctor?.id === doc.id;
                      const price = doc.consultation_price || doc.price || basePrice;
                      return (
                        <div
                          key={doc.id}
                          onClick={() => setSelectedDoctor(doc)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                            isSelected 
                              ? "border-teal-500 bg-teal-50/80 shadow-sm" 
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-700 overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs">
                              {doc.photo_url || doc.photo ? (
                                <Image
                                  src={(doc.photo_url || doc.photo) as string}
                                  alt={doc.first_name || "Doctor"}
                                  width={36}
                                  height={36}
                                  unoptimized
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <User className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {doc.first_name} {doc.last_name}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">{doc.specialty}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-extrabold text-slate-900">{price.toLocaleString("ru-RU")} ₸</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Date & Time Slot */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {isKz ? "Күн" : "Дата"}
                  </label>
                  <input
                    type="date"
                    value={bookingDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {isKz ? "Уақыт" : "Время"}
                  </label>
                  <select
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 bg-white"
                  >
                    {DEFAULT_SLOTS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Patient Details */}
              <div className="space-y-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {isKz ? "Пациенттің аты-жөні" : "ФИО Пациента"}
                  </label>
                  <Input
                    placeholder="Мысалы: Айдар Смагулов"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    required
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      {isKz ? "Телефон нөмірі" : "Телефон"}
                    </label>
                    <Input
                      placeholder="+7 777 000 00 00"
                      value={patientPhone}
                      onChange={(e) => setPatientPhone(e.target.value)}
                      required
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Email
                    </label>
                    <Input
                      type="email"
                      placeholder="patient@gmail.com"
                      value={patientEmail}
                      onChange={(e) => setPatientEmail(e.target.value)}
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Promo Code Input */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-teal-600" />
                    {isKz ? "Промокод (жеңілдік)" : "Промокод на скидку"}
                  </span>
                  <span className="text-[10px] text-slate-400 lowercase">MED2026, HEALTH20</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Промокод енгізіңіз..."
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                    className="h-9 text-xs uppercase font-mono tracking-wider rounded-xl"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleApplyPromo}
                    disabled={validatingPromo || !promoCodeInput.trim()}
                    className="h-9 text-xs px-3 rounded-xl shrink-0"
                  >
                    {validatingPromo ? "..." : (isKz ? "Қолдану" : "Применить")}
                  </Button>
                </div>
                {promoError && (
                  <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {promoError}
                  </p>
                )}
                {promoValidation && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isKz ? `Жеңілдік: -${discountAmount} ₸` : `Скидка: -${discountAmount} ₸`}
                  </p>
                )}
              </div>

              {/* Pricing & Submit */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">{isKz ? "Төлем сомасы:" : "Итого к оплате:"}</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-extrabold text-slate-900">
                      {finalPrice.toLocaleString("ru-RU")} ₸
                    </span>
                    {promoValidation && (
                      <span className="text-xs text-slate-400 line-through">
                        {effectivePrice.toLocaleString("ru-RU")} ₸
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-bold text-xs px-6 h-10 rounded-xl shadow-md"
                >
                  {submitting ? (isKz ? "Жазылуда..." : "Оформление...") : (isKz ? "Жазылуды растау" : "Подтвердить запись")}
                </Button>
              </div>
            </form>
          )}

          {/* STEP 3: SUCCESS VIEW */}
          {step === "success" && (
            <div className="text-center py-6 space-y-4 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h4 className="text-2xl font-extrabold text-slate-900 mb-1">
                  {isKz ? "Сіз қабылдауға сәтті жазылдыңыз!" : "Вы успешно записаны на прием!"}
                </h4>
                <p className="text-xs text-slate-500">
                  {isKz 
                    ? `Қабылдау күні: ${bookingDate} сағат ${bookingTime}`
                    : `Дата и время визита: ${bookingDate} в ${bookingTime}`}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-left text-xs space-y-1.5 max-w-sm mx-auto">
                <p><span className="text-slate-400">{isKz ? "Клиника:" : "Клиника:"}</span> <strong className="text-slate-800">{clinicName}</strong></p>
                {selectedDoctor && (
                  <p><span className="text-slate-400">{isKz ? "Дәрігер:" : "Врач:"}</span> <strong className="text-slate-800">{selectedDoctor.first_name} {selectedDoctor.last_name} ({selectedDoctor.specialty})</strong></p>
                )}
                <p><span className="text-slate-400">{isKz ? "Пациент:" : "Пациент:"}</span> <strong className="text-slate-800">{patientName}</strong> ({patientPhone})</p>
                <p><span className="text-slate-400">{isKz ? "Сомасы:" : "Стоимость:"}</span> <strong className="text-teal-700">{finalPrice.toLocaleString("ru-RU")} ₸</strong></p>
                <p><span className="text-slate-400">ID:</span> <code className="text-slate-500 font-mono text-[10px]">{bookingRefId}</code></p>
              </div>

              <p className="text-[11px] text-slate-400">
                {isKz 
                  ? "Растау туралы SMS телефоныңызға жіберілді. Клиникада жеке куәлігіңізді көрсетуді ұмытпаңыз."
                  : "SMS с подтверждением отправлено на ваш телефон. Возьмите с собой удостоверение личности."}
              </p>

              <Button
                onClick={onClose}
                className="w-full max-w-xs mx-auto rounded-xl bg-slate-900 text-white font-bold text-xs h-10 mt-2"
              >
                {isKz ? "Түсінікті, жабу" : "Понятно, закрыть"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
