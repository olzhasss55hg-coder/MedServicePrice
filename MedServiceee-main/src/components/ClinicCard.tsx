"use client";

import { useState } from "react";
import Image from "next/image";
import { MapPin, Star, ShieldCheck, Users, Activity, Calendar, User, Clock } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import PriceChart from "@/components/ui/PriceChart";
import { DoctorProfileModal } from "@/components/DoctorProfileModal";
import { DualBookingModal } from "@/components/DualBookingModal";
import { RouteDropdown } from "@/components/ui/RouteDropdown";
import { useTranslation } from "@/i18n/LanguageContext";
import { api } from "@/lib/api";
import type { Doctor } from "@/lib/types";

interface ClinicCardProps {
  clinicId: string;
  clinicName: string;
  address: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string;
  sourceUrl?: string;
  price: number;
  rating?: number;
  hasOnlineBooking?: boolean;
  isPopular?: boolean;
  accredited?: boolean;
  historyData?: { date: string; price: number }[];
  lastUpdatedAt?: string;
}

export function ClinicCard({
  clinicId,
  clinicName,
  address,
  city = "",
  latitude,
  longitude,
  phone,
  sourceUrl,
  price,
  rating,
  hasOnlineBooking,
  isPopular,
  accredited = true,
  historyData = [],
  lastUpdatedAt
}: ClinicCardProps) {
  const { t, locale } = useTranslation();
  const [showHistory, setShowHistory] = useState(false);
  const [showDoctors, setShowDoctors] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [showDualBooking, setShowDualBooking] = useState(false);

  const handleShowDoctors = async () => {
    if (!showDoctors && doctors.length === 0) {
      setLoadingDoctors(true);
      try {
        const data = await api.getClinicDetails(clinicId);
        setDoctors(data.doctors || []);
      } catch (err) {
        console.error("Failed to load doctors", err);
      } finally {
        setLoadingDoctors(false);
      }
    }
    setShowDoctors(!showDoctors);
  };

  return (
    <GlassCard className="p-4 sm:p-6 transition-all hover:border-primary/50 relative overflow-hidden group mb-4">
      {isPopular && (
        <div className="absolute top-0 right-0 bg-gradient-to-l from-primary to-accent text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
          {t('search.popular')}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
              {clinicName}
            </h3>
            {accredited && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200/60">
                <ShieldCheck className="w-3 h-3" /> {t('common.accredited')}
              </span>
            )}
            {rating && (
              <div className="flex items-center gap-1 bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded text-sm font-semibold">
                <Star className="w-3.5 h-3.5 fill-current" /> {rating.toFixed(1)}
              </div>
            )}
            {hasOnlineBooking && (
              <div className="flex items-center gap-1 bg-green-500/10 text-green-600 px-2 py-0.5 rounded text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                {locale === 'kk' ? 'Онлайн жазылу' : 'Онлайн-запись'}
              </div>
            )}
          </div>

          <div className="flex items-center text-muted-foreground text-sm mb-2">
            <MapPin className="w-4 h-4 mr-1 text-primary shrink-0" />
            <span>{city ? `${city}, ` : ""}{address}</span>
          </div>

          {/* Unified Route Dropdown Button */}
          <div className="mt-2">
            <RouteDropdown
              clinicName={clinicName}
              city={city}
              address={address}
              latitude={latitude}
              longitude={longitude}
            />
          </div>
        </div>

        <div className="flex flex-col md:items-end gap-2 w-full md:w-auto">
          <div className="flex flex-col items-end">
            <div className="text-2xl font-bold text-gradient">
              {price.toLocaleString('ru-RU')} ₸
            </div>
            {lastUpdatedAt && (
              <div className="text-[10px] sm:text-xs text-muted-foreground mt-1.5 flex items-center justify-end gap-1.5 opacity-80">
                <Clock className="w-3 h-3 shrink-0" />
                <span>
                  {locale === 'kk' ? 'Соңғы жаңарту:' : 'Обновлено:'} {new Date(lastUpdatedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:flex gap-2 w-full md:w-auto">
            <Button
              variant="outline"
              onClick={handleShowDoctors}
              className="w-full flex justify-center items-center gap-1.5 md:gap-2 px-2 md:px-4"
            >
              <Users className="w-4 h-4 shrink-0" />
              <span className="truncate">{t('search.doctors')}</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex justify-center items-center gap-1.5 md:gap-2 px-2 md:px-4"
            >
              <Activity className="w-4 h-4 shrink-0" />
              <span className="truncate">{t('search.history')}</span>
            </Button>
            <Button
              onClick={() => setShowDualBooking(true)}
              className="col-span-2 md:col-span-1 w-full flex justify-center items-center gap-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white font-bold"
            >
              <Calendar className="w-4 h-4 shrink-0" />
              {t('search.book')}
            </Button>
          </div>
        </div>
      </div>

      {showHistory && (
        <div className="mt-6 w-full animate-in fade-in slide-in-from-top-4 duration-300">
          <PriceChart data={historyData} />
        </div>
      )}

      {showDoctors && (
        <div className="mt-6 pt-6 border-t border-black/5 animate-in fade-in slide-in-from-top-4 duration-300">
          <h4 className="font-bold mb-4 text-muted-foreground uppercase tracking-wider text-sm">{t('search.doctors')}</h4>
          {loadingDoctors ? (
            <div className="flex justify-center p-4">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : doctors.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {doctors.map(doc => {
                const docPhoto = doc.photo_url || doc.photo;
                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoctor(doc)}
                    className="flex gap-4 p-4 border border-black/5 rounded-2xl bg-black/5 hover:bg-black/10 transition-colors cursor-pointer items-center"
                  >
                    <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-primary/20 bg-primary/10 flex items-center justify-center">
                      {docPhoto ? (
                        <Image
                          src={docPhoto}
                          alt={doc.first_name || "Doctor"}
                          width={56}
                          height={56}
                          unoptimized
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-7 h-7 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h6 className="font-bold text-sm truncate">{doc.first_name} {doc.last_name}</h6>
                          <p className="text-xs text-primary font-medium">{doc.specialty}</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-semibold bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded shrink-0">
                          <Star className="w-3 h-3 fill-current" /> {doc.rating}
                        </div>
                      </div>
                      <div className="flex justify-between items-end mt-2 text-xs">
                        <span className="text-muted-foreground">Тәжірибесі: {doc.experience_years ?? 0} жыл</span>
                        <span className="font-bold text-foreground text-sm">{(doc.consultation_price ?? doc.price ?? 0).toLocaleString('ru-RU')} ₸</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-4">Дәрігерлер табылмады</div>
          )}
        </div>
      )}

      <DoctorProfileModal
        doctor={selectedDoctor}
        isOpen={selectedDoctor !== null}
        onClose={() => setSelectedDoctor(null)}
      />

      <DualBookingModal
        isOpen={showDualBooking}
        onClose={() => setShowDualBooking(false)}
        clinicId={clinicId}
        clinicName={clinicName}
        clinicCity={city}
        clinicAddress={address}
        sourceUrl={sourceUrl}
        basePrice={price}
      />
    </GlassCard>
  );
}
