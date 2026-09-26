"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import DynamicMap from "@/components/ui/DynamicMap";
import { RouteDropdown } from "@/components/ui/RouteDropdown";
import { Search, MapPin, Phone, Clock, Star, Users, Navigation, Compass, Filter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DoctorProfileModal } from "@/components/DoctorProfileModal";
import { useTranslation } from "@/i18n/LanguageContext";
import { API_URL, api } from "@/lib/api";
import type { Clinic, Doctor } from "@/lib/types";
import { build2GisRouteUrl, buildGoogleMapsRouteUrl } from "@/lib/maps";

const CITIES = ["Астана", "Алматы", "Шымкент", "Қарағанды", "Павлодар", "Ақтөбе"];

const DISTRICTS_MAP: Record<string, string[]> = {
  "Астана": ["Есіл ауданы", "Алматы ауданы", "Байқоңыр ауданы", "Сарыарқа ауданы", "Нұра ауданы"],
  "Алматы": ["Алмалы ауданы", "Бостандық ауданы", "Медеу ауданы", "Әуезов ауданы", "Түрксіб ауданы", "Жетісу ауданы"],
  "Шымкент": ["Әл-Фараби ауданы", "Абай ауданы", "Еңбекші ауданы", "Қаратау ауданы"],
  "Қарағанды": ["Қазыбек би ауданы", "Әлихан Бөкейхан ауданы"],
  "Павлодар": ["Орталық", "Усолка", "Химгородки"],
  "Ақтөбе": ["Орталық", "12 мкр", "Батыс-2", "Шанхай"]
};

function ClinicsContent() {
  const { t, locale } = useTranslation();
  const isKz = locale === "kk";
  const searchParams = useSearchParams();
  const initialCity = searchParams.get("city") || "Астана";

  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState(CITIES.includes(initialCity) ? initialCity : "Астана");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [clinicQuery, setClinicQuery] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [onlineOnly, setOnlineOnly] = useState(false);

  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [expandedClinicId, setExpandedClinicId] = useState<string | null>(null);
  const [clinicDoctors, setClinicDoctors] = useState<Record<string, Doctor[]>>({});
  const [loadingDoctors, setLoadingDoctors] = useState<Record<string, boolean>>({});
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  useEffect(() => {
    const qCity = searchParams.get("city");
    if (qCity && CITIES.includes(qCity) && qCity !== selectedCity) {
      setSelectedCity(qCity);
    }
  }, [searchParams]);

  useEffect(() => {
    async function fetchClinics() {
      setLoading(true);
      try {
        const data = await api.getClinics({
          city: selectedCity,
          district: selectedDistrict || undefined,
          q: clinicQuery.trim() || undefined,
          min_rating: minRating > 0 ? minRating : undefined,
          online_booking: onlineOnly ? true : undefined,
        });
        setClinics(data || []);
      } catch (err) {
        console.error("Failed to load clinics", err);
        setClinics([]);
      } finally {
        setLoading(false);
      }
    }
    fetchClinics();
  }, [selectedCity, selectedDistrict, clinicQuery, minRating, onlineOnly]);

  const toggleDoctors = async (clinicId: string) => {
    if (expandedClinicId === clinicId) {
      setExpandedClinicId(null);
      return;
    }
    setExpandedClinicId(clinicId);
    if (!clinicDoctors[clinicId]) {
      setLoadingDoctors(prev => ({ ...prev, [clinicId]: true }));
      try {
        const data = await api.getClinicDetails(clinicId);
        setClinicDoctors(prev => ({ ...prev, [clinicId]: data.doctors || [] }));
      } catch (err) {
        console.error("Failed to load clinic doctors", err);
      } finally {
        setLoadingDoctors(prev => ({ ...prev, [clinicId]: false }));
      }
    }
  };

  const openRoute = (clinic: Clinic, provider: "2gis" | "google") => {
    const url = provider === "2gis"
      ? build2GisRouteUrl(clinic.name, clinic.city, clinic.address || "", clinic.latitude, clinic.longitude)
      : buildGoogleMapsRouteUrl(clinic.name, clinic.city, clinic.address || "", clinic.latitude, clinic.longitude);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const districts = DISTRICTS_MAP[selectedCity] || [];

  return (
    <div className="container mx-auto max-w-[1440px] px-4 py-8 font-sans">
      {/* Header */}
      <div className="flex flex-col gap-5 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            {isKz ? "Қазақстан клиникалары мен медициналық орталықтары" : "Клиники и медицинские центры Казахстана"}
          </h1>
          <p className="text-slate-500 text-sm">
            {isKz ? "Мекенжайлар, телефондар, дәрігерлер және нақты GPS картасы" : "Адреса, телефоны, врачи и интерактивная карта с официальными метками"}
          </p>
        </div>

        {/* City Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200 w-fit">
          {CITIES.map((city) => (
            <button
              key={city}
              type="button"
              onClick={() => {
                setSelectedCity(city);
                setSelectedDistrict("");
                setSelectedClinicId(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                selectedCity === city
                  ? "bg-primary text-white shadow-md shadow-primary/25"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              📍 {city}
            </button>
          ))}
        </div>

        {/* Search & Filters Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={isKz ? "Клиника аты немесе мекенжай бойынша іздеу..." : "Поиск по названию или адресу..."}
              value={clinicQuery}
              onChange={(e) => setClinicQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
            />
          </div>

          {districts.length > 0 && (
            <div>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
              >
                <option value="">{isKz ? "Барлық аудандар" : "Все районы"}</option>
                {districts.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlineOnly(!onlineOnly)}
              className={`flex-1 px-3 py-2.5 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                onlineOnly
                  ? "bg-green-500 text-white border-green-500 shadow-green-500/25"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${onlineOnly ? 'bg-white' : 'bg-green-500'}`}></span>
              {isKz ? "Онлайн жазылу" : "Онлайн-запись"}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Left List (6 cols) | Right Map (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Clinics List */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">
              {isKz ? `${selectedCity} клиникалары` : `Клиники в г. ${selectedCity}`} 
              <span className="ml-2 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                {clinics.length}
              </span>
            </h2>
          </div>

          <div className="space-y-4 max-h-[720px] overflow-y-auto pr-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-3xl">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                <p className="text-xs text-slate-400">{isKz ? "Клиникалар жүктелуде..." : "Загрузка клиник..."}</p>
              </div>
            ) : clinics.length === 0 ? (
              <div className="text-center py-16 bg-white border border-slate-200 rounded-3xl p-6">
                <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="font-bold text-slate-700 mb-1">{isKz ? "Клиника табылмады" : "Клиники не найдены"}</p>
                <p className="text-xs text-slate-400">{isKz ? "Басқа қала немесе сүзгі таңдаңыз" : "Попробуйте изменить фильтры или выбрать другой город"}</p>
              </div>
            ) : (
              clinics.map((clinic) => (
                <div
                  key={clinic.id}
                  onClick={() => setSelectedClinicId(clinic.id)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                    selectedClinicId === clinic.id
                      ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h3 className="font-bold text-base text-slate-900 leading-snug">{clinic.name}</h3>
                      {clinic.district && (
                        <p className="text-xs font-semibold text-primary mt-0.5">{clinic.district}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-lg shrink-0">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {clinic.rating || "5.0"}
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-slate-500 mb-4">
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                      <span>{clinic.city}, {clinic.address}</span>
                    </div>
                    {clinic.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{clinic.phone}</span>
                      </div>
                    )}
                    {clinic.working_hours && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{clinic.working_hours}</span>
                      </div>
                    )}
                  </div>

                  {/* Route & Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                    <Link
                      href={`/clinics/${encodeURIComponent(clinic.id)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
                    >
                      {isKz ? "Толығырақ" : "Подробнее"}
                    </Link>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRoute(clinic, "2gis");
                      }}
                      className="px-3 py-1.5 rounded-xl bg-lime-50 hover:bg-lime-100 text-lime-900 border border-lime-200 text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      🧭 2GIS
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRoute(clinic, "google");
                      }}
                      className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      🗺️ Google Maps
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDoctors(clinic.id);
                      }}
                      className="ml-auto px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-colors shadow-sm"
                    >
                      {expandedClinicId === clinic.id ? (isKz ? "Жабу" : "Скрыть") : (isKz ? "Дәрігерлер" : "Врачи")}
                    </button>
                  </div>

                  {/* Doctors Accordion */}
                  {expandedClinicId === clinic.id && (
                    <div className="mt-4 pt-4 border-t border-slate-200 space-y-2.5">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        {isKz ? "Клиника дәрігерлері:" : "Врачи клиники:"}
                      </p>
                      {loadingDoctors[clinic.id] ? (
                        <p className="text-xs text-slate-400 py-2">{isKz ? "Дәрігерлер жүктелуде..." : "Загрузка врачей..."}</p>
                      ) : (clinicDoctors[clinic.id] || []).length === 0 ? (
                        <p className="text-xs text-slate-400 py-2">{isKz ? "Дәрігерлер табылмады" : "Врачи не найдены"}</p>
                      ) : (
                        (clinicDoctors[clinic.id] || []).map((doc) => (
                          <div
                            key={doc.id}
                            className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-slate-200 overflow-hidden shrink-0">
                                {doc.photo_url ? (
                                  <img src={doc.photo_url} alt={doc.first_name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center font-bold text-primary text-xs">
                                    {doc.first_name[0]}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-xs text-slate-900 truncate">{doc.first_name} {doc.last_name}</p>
                                <p className="text-[11px] text-primary font-medium">{doc.specialty}</p>
                                <p className="text-[11px] text-slate-500 font-bold">{(doc.consultation_price || 0).toLocaleString("ru-RU")} ₸</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDoctor(doc);
                              }}
                              className="text-xs font-bold bg-primary hover:bg-primary/90 text-white rounded-xl shrink-0 h-8"
                            >
                              {isKz ? "Жазылу" : "Запись"}
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Interactive Map */}
        <div className="lg:col-span-6 sticky top-24 bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col h-[720px] p-2">
          <DynamicMap
            clinics={clinics}
            selectedClinicId={selectedClinicId}
          />
        </div>
      </div>

      {selectedDoctor && (
        <DoctorProfileModal
          doctor={selectedDoctor}
          isOpen={!!selectedDoctor}
          onClose={() => setSelectedDoctor(null)}
        />
      )}
    </div>
  );
}

export default function ClinicsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
      <ClinicsContent />
    </Suspense>
  );
}
