"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { 
  X, Star, Clock, Award, Check, User, ShieldCheck, Tag, 
  Calendar, Sparkles, MapPin, Globe, ArrowUpRight, Phone, Send
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Doctor, Review, PromoCodeResponse } from "@/lib/types";
import { API_URL, api } from "@/lib/api";
import { useToast } from "@/components/ui/ToastContext";
import { useTranslation } from "@/i18n/LanguageContext";

interface DoctorModalProps {
  doctor: Doctor | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DoctorProfileModal({ doctor, isOpen, onClose }: DoctorModalProps) {
  const { locale } = useTranslation();
  const toast = useToast();
  const isKz = locale === "kk";

  const [isBooked, setIsBooked] = useState(false);
  const [bookingRefId, setBookingRefId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ 
    name: "", 
    phone: "", 
    date: "", 
    time: "", 
    promo_code: "" 
  });
  const [slots, setSlots] = useState<{ starts_at: string; available: boolean }[]>([]);
  const [bookingError, setBookingError] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  
  // Promo code validation state
  const [promoValidation, setPromoValidation] = useState<PromoCodeResponse | null>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [patientName, setPatientName] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!doctor || !isOpen) return;

    // Reset initial states
    setIsBooked(false);
    setShowForm(false);
    setBookingError("");
    setPromoValidation(null);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    setFormData({ name: "", phone: "", date: tomorrow, time: "", promo_code: "" });

    // Fetch verified reviews for this doctor
    api.getDoctorReviews(doctor.id)
      .then((data) => setReviews(data))
      .catch(() => setReviews([]));

  }, [doctor, isOpen]);

  useEffect(() => {
    if (!doctor || !showForm) return;
    const date = formData.date || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    let cancelled = false;

    api.getDoctorSlots(doctor.id, date)
      .then((data) => {
        if (!cancelled) {
          const avail = data.filter((slot) => slot.available);
          setSlots(avail);
          if (avail.length > 0 && !formData.time) {
            setFormData((prev) => ({ ...prev, time: avail[0].starts_at }));
          }
        }
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      });

    return () => { cancelled = true; };
  }, [doctor, showForm, formData.date]);

  const handleApplyPromo = async () => {
    if (!formData.promo_code.trim() || !doctor) return;
    setValidatingPromo(true);
    try {
      const basePrice = doctor.consultation_price || doctor.price || 0;
      const res = await api.validatePromoCode(formData.promo_code.trim().toUpperCase(), basePrice, doctor.clinic_id);
      setPromoValidation(res);
      toast.success(isKz ? `Промокод қабылданды! Жеңілдік: ${res.discount_amount} ₸` : `Промокод применен! Скидка: ${res.discount_amount} ₸`);
    } catch (err: any) {
      setPromoValidation(null);
      toast.error(err.message || (isKz ? "Промокод жарамсыз" : "Неверный промокод"));
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleClose = () => {
    setIsBooked(false);
    setShowForm(false);
    setFormData({ name: "", phone: "", date: "", time: "", promo_code: "" });
    setPromoValidation(null);
    setBookingError("");
    setReviewRating(5);
    setReviewComment("");
    setPatientName("");
    onClose();
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor) return;

    if (!formData.name.trim() || !formData.phone.trim()) {
      setBookingError(isKz ? "Атыңызды және телефон нөміріңізді енгізіңіз" : "Заполните имя и номер телефона");
      return;
    }

    setBookingLoading(true);
    setBookingError("");
    try {
      const res = await api.createBooking({
        clinic_id: doctor.clinic_id || "",
        doctor_id: doctor.id,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        preferred_time: formData.time || undefined,
        appointment_at: formData.date && formData.time ? `${formData.date}T${formData.time.split('T')[1] || '10:00:00'}` : undefined,
        promo_code: promoValidation ? formData.promo_code.trim().toUpperCase() : undefined,
      });

      setBookingRefId(res.id || "OK");
      setIsBooked(true);
      setShowForm(false);
      toast.success(isKz ? "Қабылдауға сәтті жазылдыңыз! SMS-растау жіберілді." : "Вы успешно записаны на прием! Отправлено подтверждение.");
    } catch (err: any) {
      setBookingError(err?.message || (isKz ? "Жазылу кезінде қате орын алды" : "Ошибка при создании записи"));
      toast.error(err?.message || "Не удалось создать запись");
    } finally {
      setBookingLoading(false);
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewRating || !doctor) return;
    setSubmittingReview(true);
    try {
      const created = await api.createReview({
        doctor_id: doctor.id,
        clinic_id: doctor.clinic_id,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
        patient_name: patientName.trim() || (isKz ? "Тексерілген пациент" : "Проверенный пациент"),
      });
      setReviews((prev) => [created, ...prev]);
      toast.success(isKz ? "Пікіріңіз үшін рахмет!" : "Спасибо за ваш отзыв!");
      setReviewComment("");
      setPatientName("");
    } catch (error: any) {
      toast.error(error?.message || (isKz ? "Пікір жіберу қатесі" : "Ошибка отправки отзыва"));
    } finally {
      setSubmittingReview(false);
    }
  };

  if (!isOpen || !doctor) return null;

  const basePrice = doctor.consultation_price || doctor.price || 0;
  const finalPrice = promoValidation ? promoValidation.total_amount : basePrice;

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200" 
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] shadow-2xl relative flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100" 
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky Top Header with Avatar, Title & Fixed Close Button */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200/60 overflow-hidden flex items-center justify-center shrink-0">
              {(doctor.photo_url || doctor.photo) ? (
                <img
                  src={(doctor.photo_url || doctor.photo) as string}
                  alt={doctor.first_name || doctor.name || "Doctor"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-extrabold text-teal-700">
                  {(doctor.first_name?.[0] ?? "Д").toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
                {doctor.first_name ? `${doctor.first_name} ${doctor.last_name}` : doctor.name}
              </h3>
              <p className="text-xs text-teal-600 font-semibold truncate">{doctor.specialty}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-9 h-9 flex items-center justify-center rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0 shadow-sm"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          
          {/* Doctor Hero Card */}
          <div className="flex flex-col items-center text-center bg-gradient-to-b from-teal-50/50 via-slate-50/30 to-white p-6 rounded-3xl border border-teal-500/15">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl border-4 border-white shadow-xl mb-3.5 overflow-hidden bg-white relative">
              {(doctor.photo_url || doctor.photo) ? (
                <img
                  src={(doctor.photo_url || doctor.photo) as string}
                  alt={doctor.first_name || doctor.name || "Doctor"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-teal-50 text-teal-700 text-3xl font-extrabold">
                  {(doctor.first_name?.[0] ?? "Д").toUpperCase()}{(doctor.last_name?.[0] ?? "").toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5 mb-2">
              {doctor.is_pediatric && (
                <span className="bg-sky-100 text-sky-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
                  👶 {isKz ? "Балалар дәрігері" : "Педиатрия"}
                </span>
              )}
              {doctor.category && (
                <span className="bg-teal-100 text-teal-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  🎓 {doctor.category}
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {doctor.first_name ? `${doctor.first_name} ${doctor.last_name}` : doctor.name}
            </h2>
            <p className="text-teal-600 font-bold text-sm mt-0.5">{doctor.specialty}</p>

            <div className="flex items-center gap-2 mt-2.5">
              <div className="flex items-center gap-1 text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200/80 px-2.5 py-1 rounded-xl">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                {doctor.rating || "5.0"}
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {doctor.reviews_count || reviews.length} {isKz ? "пікір" : "отзывов"}
              </span>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl text-center">
              <Award className="w-5 h-5 mx-auto mb-1 text-teal-600" />
              <p className="text-[11px] font-semibold text-slate-500 mb-0.5">{isKz ? "Жұмыс өтілі" : "Стаж работы"}</p>
              <p className="font-extrabold text-sm sm:text-base text-slate-900">{doctor.experience_years || 10} {isKz ? "жыл" : "лет"}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl text-center">
              <Clock className="w-5 h-5 mx-auto mb-1 text-teal-600" />
              <p className="text-[11px] font-semibold text-slate-500 mb-0.5">{isKz ? "Қабылдау құны" : "Стоимость приема"}</p>
              <p className="font-extrabold text-sm sm:text-base text-teal-700">{basePrice.toLocaleString('ru-RU')} ₸</p>
            </div>
          </div>

          {/* About Doctor */}
          <div className="bg-slate-50/70 border border-slate-200/60 p-4 rounded-2xl space-y-1.5">
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-600">
              {isKz ? "Дәрігер туралы" : "О специалисте"}
            </h4>
            <p className="text-slate-700 text-xs sm:text-sm leading-relaxed font-normal">
              {doctor.description || (isKz ? "Білікті дәрігер, амбулаторлық қабылдау жүргізеді." : "Квалифицированный специалист, ведет амбулаторный прием пациентов.")}
            </p>
          </div>

          {/* Success Booking Alert */}
          {isBooked && (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <h4 className="font-extrabold text-base text-emerald-900">
                {isKz ? "Қабылдауға сәтті жазылдыңыз!" : "Вы успешно записаны на прием!"}
              </h4>
              <p className="text-xs text-emerald-700">
                {isKz ? `Тапсырыс нөмірі: #${bookingRefId}. Дәрігер сізді клиникада күтеді.` : `Номер бронирования: #${bookingRefId}. Специалист ожидает вас в назначенное время.`}
              </p>
            </div>
          )}

          {/* Booking Form (Module 5 & 6) */}
          {showForm && !isBooked && (
            <form onSubmit={handleBookingSubmit} className="space-y-4 p-5 rounded-3xl bg-slate-50 border border-teal-500/20 shadow-sm animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-600" />
                  {isKz ? "Қабылдау уақыты мен деректер" : "Запись на удобное время"}
                </h4>
                <span className="text-[11px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                  {isKz ? "Жылдам жазылу" : "Мгновенная бронь"}
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  {isKz ? "Аты-жөніңіз *" : "ФИО пациента *"}
                </label>
                <input 
                  type="text" 
                  required
                  placeholder={isKz ? "Мысалы: Айдар Серіков" : "Например: Айдар Сериков"}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm font-medium"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">
                    {isKz ? "Телефон нөмірі *" : "Номер телефона *"}
                  </label>
                  <input 
                    type="tel"
                    required
                    placeholder="+7 (777) 123-45-67"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm font-medium"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">
                    {isKz ? "Қабылдау күні *" : "Дата приема *"}
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm font-medium"
                    min={new Date().toISOString().slice(0, 10)}
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value, time: ""})}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  {isKz ? "Қолжетімді уақыт слоты *" : "Свободный слот времени *"}
                </label>
                <select
                  required
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm font-semibold"
                  value={formData.time}
                  onChange={e => setFormData({...formData, time: e.target.value})}
                >
                  <option value="">{isKz ? "Уақытты таңдаңыз" : "Выберите время приема"}</option>
                  {slots.length > 0 ? (
                    slots.map((slot) => {
                      const timeStr = new Date(slot.starts_at).toLocaleTimeString(isKz ? "kk-KZ" : "ru-RU", { hour: "2-digit", minute: "2-digit" });
                      return (
                        <option key={slot.starts_at} value={slot.starts_at}>
                          🕒 {timeStr} ({isKz ? "Қолжетімді" : "Свободно"})
                        </option>
                      );
                    })
                  ) : (
                    <>
                      <option value="09:00">🕒 09:00 ({isKz ? "Қолжетімді" : "Свободно"})</option>
                      <option value="10:00">🕒 10:00 ({isKz ? "Қолжетімді" : "Свободно"})</option>
                      <option value="11:30">🕒 11:30 ({isKz ? "Қолжетімді" : "Свободно"})</option>
                      <option value="14:00">🕒 14:00 ({isKz ? "Қолжетімді" : "Свободно"})</option>
                      <option value="15:30">🕒 15:30 ({isKz ? "Қолжетімді" : "Свободно"})</option>
                      <option value="17:00">🕒 17:00 ({isKz ? "Қолжетімді" : "Свободно"})</option>
                    </>
                  )}
                </select>
              </div>

              {/* Promo Code Input (Module 5) */}
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  {isKz ? "Промокод (жеңілдік алу)" : "Промокод (MED2026, HEALTH20)"}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      type="text"
                      placeholder="MED2026"
                      className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm font-bold uppercase tracking-wider"
                      value={formData.promo_code}
                      onChange={e => setFormData({...formData, promo_code: e.target.value.toUpperCase()})}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleApplyPromo}
                    disabled={!formData.promo_code.trim() || validatingPromo}
                    className="h-11 px-4 text-xs font-bold shrink-0 rounded-xl"
                  >
                    {validatingPromo ? "..." : (isKz ? "Қолдану" : "Применить")}
                  </Button>
                </div>
                {promoValidation && (
                  <p className="text-xs text-emerald-600 font-bold mt-1.5 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    {isKz ? `Жеңілдік ${promoValidation.discount_amount} ₸ есептелді!` : `Скидка ${promoValidation.discount_amount} ₸ успешно применена!`}
                  </p>
                )}
              </div>

              {/* Total Summary */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 block">{isKz ? "Төлемге сомасы:" : "Итоговая сумма приема:"}</span>
                  {promoValidation && (
                    <span className="text-xs line-through text-slate-400 font-semibold">{basePrice.toLocaleString('ru-RU')} ₸</span>
                  )}
                </div>
                <span className="text-xl font-black text-teal-700">{finalPrice.toLocaleString('ru-RU')} ₸</span>
              </div>

              {bookingError && <p className="text-xs text-rose-600 font-bold">{bookingError}</p>}

              <Button
                type="submit"
                disabled={bookingLoading}
                className="w-full h-12 bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm rounded-xl shadow-md transition-all"
              >
                {bookingLoading ? (isKz ? "Жіберілуде..." : "Оформление...") : (isKz ? "Жазылуды растау" : "Подтвердить запись")}
              </Button>
            </form>
          )}

          {/* Primary Action Button (If form not open) */}
          {!showForm && !isBooked && (
            <div className="space-y-2.5">
              <Button 
                onClick={() => setShowForm(true)}
                className="w-full h-13 text-base font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-600/20 rounded-2xl transition-all"
              >
                <Calendar className="w-5 h-5 mr-2" />
                {isKz ? "Дәрігерге онлайн жазылу" : "Записаться на прием"}
              </Button>
            </div>
          )}

          {/* Verified Patient Reviews (Module 9) */}
          <div className="pt-4 border-t border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-sm text-slate-900">
                {isKz ? "Пациенттердің пікірлері" : "Отзывы пациентов"}
              </h4>
              <span className="text-xs font-bold text-slate-500">
                {reviews.length} {isKz ? "пікір" : "отзывов"}
              </span>
            </div>

            {/* Submit Review Form */}
            <form onSubmit={submitReview} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
              <p className="text-xs font-bold text-slate-700">{isKz ? "Дәрігерге баға беру" : "Оценить врача"}</p>
              
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReviewRating(value)}
                    className="p-1 text-amber-400 hover:scale-125 transition-transform"
                    aria-label={`${value} stars`}
                  >
                    <Star className={`w-5 h-5 ${value <= reviewRating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder={isKz ? "Атыңыз" : "Ваше имя"}
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />

              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder={isKz ? "Қабылдау қалай өтті? Пікіріңізді жазыңыз..." : "Опишите ваш опыт визита..."}
                maxLength={2000}
                className="w-full min-h-[60px] p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none text-xs"
              />

              <Button
                type="submit"
                size="sm"
                className="text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-9"
                disabled={submittingReview}
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {submittingReview ? "..." : (isKz ? "Пікір қалдыру" : "Отправить отзыв")}
              </Button>
            </form>

            {/* Reviews List */}
            <div className="space-y-2.5">
              {reviews.map((rev) => (
                <div key={rev.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-slate-900">{rev.patient_name || "Пациент"}</span>
                      {rev.is_verified && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-teal-700 bg-teal-100/80 px-1.5 py-0.2 rounded-md">
                          <ShieldCheck className="w-3 h-3 text-teal-600" />
                          {isKz ? "Тексерілген" : "Проверено"}
                        </span>
                      )}
                    </div>
                    <div className="flex text-amber-400">
                      {Array.from({ length: rev.rating }).map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                  </div>
                  {rev.comment && <p className="text-slate-600 leading-relaxed font-normal">{rev.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
