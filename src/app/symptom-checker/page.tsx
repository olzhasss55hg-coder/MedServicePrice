"use client";

import { useState } from "react";
import { useTranslation } from "@/i18n/LanguageContext";
import { api } from "@/lib/api";
import { DoctorProfileModal } from "@/components/DoctorProfileModal";
import type { SymptomCheckResponse, Doctor } from "@/lib/types";
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, FileText, Loader2, Sparkles, Stethoscope, UserCheck, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";

const COMMON_SYMPTOMS_RU = [
  { id: "headache", label: "Головная боль", category: "Неврология" },
  { id: "chest_pain", label: "Боль в груди / Одышка", category: "Кардиология" },
  { id: "stomach_pain", label: "Боль в животе / Тошнота", category: "Гастроэнтерология" },
  { id: "throat_cough", label: "Кашель / Боль в горле", category: "ЛОР / Пульмонология" },
  { id: "fever", label: "Высокая температура", category: "Терапия" },
  { id: "dizziness", label: "Головокружение / Слабость", category: "Неврология" },
  { id: "joint_pain", label: "Боль в суставах / Спине", category: "Ортопедия" },
  { id: "skin_rash", label: "Сыпь на коже / Зуд", category: "Дерматология" },
  { id: "heart_palp", label: "Учащенное сердцебиение", category: "Кардиология" },
  { id: "kidney_pain", label: "Боль в пояснице / Проблемы с мочеиспусканием", category: "Урология" },
];

const COMMON_SYMPTOMS_KK = [
  { id: "headache", label: "Бас ауруы", category: "Неврология" },
  { id: "chest_pain", label: "Кеуде ауруы / Ентігу", category: "Кардиология" },
  { id: "stomach_pain", label: "Іш ауруы / Жүрек айну", category: "Гастроэнтерология" },
  { id: "throat_cough", label: "Жөтел / Тамақ ауруы", category: "ЛОР / Пульмонология" },
  { id: "fever", label: "Жоғары дене қызуы", category: "Терапия" },
  { id: "dizziness", label: "Бас айналу / Әлсіздік", category: "Неврология" },
  { id: "joint_pain", label: "Буын / Бел ауруы", category: "Ортопедия" },
  { id: "skin_rash", label: "Тері бөртпесі / Қышыма", category: "Дерматология" },
  { id: "heart_palp", label: "Жүрек соғысының жиілеуі", category: "Кардиология" },
  { id: "kidney_pain", label: "Бүйрек / Несеп жолдарының ауруы", category: "Урология" },
];

export default function SymptomCheckerPage() {
  const { locale } = useTranslation();
  const isKz = locale === "kk";

  const [symptomsText, setSymptomsText] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState("Алматы");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SymptomCheckResponse | null>(null);
  const [selectedDoctorForBooking, setSelectedDoctorForBooking] = useState<Doctor | null>(null);

  const symptomList = isKz ? COMMON_SYMPTOMS_KK : COMMON_SYMPTOMS_RU;

  const toggleSymptom = (label: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  };

  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!symptomsText.trim() && selectedSymptoms.length === 0) return;

    setLoading(true);
    try {
      const response = await api.checkSymptoms({
        symptoms_text: symptomsText.trim(),
        selected_symptoms: selectedSymptoms,
        language: isKz ? "kz" : "ru",
        city: selectedCity,
      });
      setResult(response);
      setTimeout(() => {
        window.scrollBy({ top: 350, behavior: 'smooth' });
      }, 150);
    } catch (err) {
      console.error("Symptom analysis failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            {isKz ? "Жасанды Интеллект Медициналық Триж" : "AI-Симптом Чекер и Рекомендации"}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {isKz ? "Симптомдарды тексеру және дәрігерді таңдау" : "Проверьте симптомы и найдите специалиста"}
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
            {isKz
              ? "Өз белгілеріңізді сипаттаңыз немесе тізімнен таңдаңыз. AI көмекшісі сәйкес мамандықты, ұсынылатын талдауларды және үздік дәрігерлерді көрсетеді."
              : "Опишите свои ощущения или выберите симптомы из списка. Система определит профильную специальность врача, необходимые обследования и подберет проверенных врачей."}
          </p>
        </div>

        {/* Input Card */}
        <div className="bg-slate-900/80 border border-slate-800 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          {/* City Selection */}
          <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-slate-800">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {isKz ? "Сіздің қалаңыз:" : "Ваш город:"}
            </label>
            <div className="flex flex-wrap gap-2">
              {["Алматы", "Астана", "Шымкент", "Қарағанды"].map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => setSelectedCity(city)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    selectedCity === city
                      ? "bg-teal-500 text-slate-950 font-bold shadow-lg shadow-teal-500/20"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Checkbox Badges */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              {isKz ? "1. Белгілерді таңдаңыз (бірнешеуін белгілеуге болады):" : "1. Выберите основные симптомы:"}
            </label>
            <div className="flex flex-wrap gap-2.5">
              {symptomList.map((symptom) => {
                const isSelected = selectedSymptoms.includes(symptom.label);
                return (
                  <button
                    key={symptom.id}
                    type="button"
                    onClick={() => toggleSymptom(symptom.label)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all border ${
                      isSelected
                        ? "bg-teal-500/20 border-teal-500 text-teal-300 shadow-md shadow-teal-500/10"
                        : "bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-slate-600 hover:bg-slate-800"
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
                      isSelected ? "border-teal-400 bg-teal-400" : "border-slate-500"
                    }`}>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />}
                    </span>
                    {symptom.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text Description */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              {isKz ? "2. Немесе өз сөзіңізбен толықтырыңыз:" : "2. Или опишите своими словами:"}
            </label>
            <textarea
              rows={3}
              value={symptomsText}
              onChange={(e) => setSymptomsText(e.target.value)}
              placeholder={isKz
                ? "Мысалы: 2 күннен бері басым қатты ауырып, қан қысымым көтеріліп тұр..."
                : "Например: Сильная головная боль в области затылка, шум в ушах, скачки давления второй день..."}
              className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm leading-relaxed"
            />
          </div>

          {/* Submit Button */}
          <Button
            onClick={() => handleAnalyze()}
            disabled={loading || (!symptomsText.trim() && selectedSymptoms.length === 0)}
            className="w-full h-14 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-base shadow-xl shadow-teal-500/20 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isKz ? "AI талдау жүргізуде..." : "AI проводит клинический анализ..."}
              </>
            ) : (
              <>
                <Stethoscope className="w-5 h-5" />
                {isKz ? "Симптомдарды талдау және дәрігерлерді табу" : "Анализировать симптомы и подобрать врача"}
              </>
            )}
          </Button>
        </div>

        {/* Results Section (Module 11 Deliverables) */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Mandatory Legal Disclaimer Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm flex items-start gap-3.5">
                <ShieldAlert className="w-6 h-6 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <strong className="font-bold block mb-0.5">
                    {isKz ? "МАҢЫЗДЫ МЕДИЦИНАЛЫҚ ЕСКЕРТУ:" : "ВАЖНОЕ МЕДИЦИНСКОЕ ПРЕДУПРЕЖДЕНИЕ:"}
                  </strong>
                  <p className="leading-relaxed">
                    {result.disclaimer}
                  </p>
                </div>
              </div>

              {/* Analysis Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. Recommended Specialty */}
                <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <p className="text-xs uppercase tracking-wider font-bold text-slate-400">
                    {isKz ? "Ұсынылатын маман" : "Рекомендуемый специалист"}
                  </p>
                  <h3 className="text-xl font-bold text-teal-400">{result.specialty}</h3>
                  <p className="text-xs text-slate-400">
                    {isKz ? "Алғашқы қарау және диагноз қою үшін" : "Для первичного осмотра и постановки диагноза"}
                  </p>
                </div>

                {/* 2. Potential Conditions */}
                <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                    <Activity className="w-5 h-5" />
                  </div>
                  <p className="text-xs uppercase tracking-wider font-bold text-slate-400">
                    {isKz ? "Болжамды жағдайлар" : "Возможные ориентиры"}
                  </p>
                  <ul className="space-y-1 text-xs text-slate-300">
                    {result.potential_conditions.map((c, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 3. Recommended Lab Tests */}
                <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <p className="text-xs uppercase tracking-wider font-bold text-slate-400">
                    {isKz ? "Ұсынылатын талдаулар" : "Рекомендуемые анализы"}
                  </p>
                  <ul className="space-y-1 text-xs text-slate-300">
                    {result.recommended_examinations.map((t, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommended Doctors with 1-Click Booking */}
              {result.recommended_doctors.length > 0 && (
                <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {isKz ? `Таңдалған ${result.specialty} мамандары` : `Проверенные специалисты: ${result.specialty}`}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {isKz ? `${selectedCity} қаласындағы жоғары рейтингті дәрігерлер` : `Врачи с рейтингом 4.7–5.0 в г. ${selectedCity}`}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {result.recommended_doctors.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 hover:border-teal-500/40 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-slate-800 overflow-hidden shrink-0 border border-slate-700">
                            {doc.photo_url ? (
                              <img src={doc.photo_url} alt={doc.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-bold text-teal-400 text-sm">
                                {doc.name[0]}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-slate-100 truncate">{doc.name}</h4>
                            <p className="text-xs text-teal-400">{doc.specialty}</p>
                            <p className="text-xs text-slate-500 truncate">{doc.clinic_name || "Клиника"} · ⭐ {doc.rating || "5.0"}</p>
                            <p className="text-xs font-bold text-slate-300 mt-0.5">{doc.price.toLocaleString("ru-RU")} ₸</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedDoctorForBooking({
                            id: doc.id,
                            first_name: doc.name.split(" ")[0] || "",
                            last_name: doc.name.split(" ")[1] || "",
                            specialty: doc.specialty,
                            clinic_id: doc.clinic_id,
                            consultation_price: doc.price,
                            rating: doc.rating,
                            photo_url: doc.photo_url,
                          })}
                          className="px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shrink-0 transition-colors shadow-md shadow-teal-500/10"
                        >
                          {isKz ? "Жазылу" : "Записаться"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Doctor Booking Modal */}
      {selectedDoctorForBooking && (
        <DoctorProfileModal
          doctor={selectedDoctorForBooking}
          isOpen={!!selectedDoctorForBooking}
          onClose={() => setSelectedDoctorForBooking(null)}
        />
      )}
    </div>
  );
}
