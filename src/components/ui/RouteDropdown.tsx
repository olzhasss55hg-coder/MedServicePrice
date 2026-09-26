"use client";

import { useState, useRef, useEffect } from "react";
import { Navigation, ChevronDown, ExternalLink } from "lucide-react";
import { build2GisRouteUrl, buildGoogleMapsRouteUrl } from "@/lib/maps";
import { useTranslation } from "@/i18n/LanguageContext";

interface RouteDropdownProps {
  clinicName: string;
  city?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  className?: string;
  size?: "sm" | "md";
}

export function RouteDropdown({
  clinicName,
  city = "",
  address = "",
  latitude,
  longitude,
  className = "",
  size = "sm"
}: RouteDropdownProps) {
  const { locale } = useTranslation();
  const isKz = locale === "kk";
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const gisUrl = build2GisRouteUrl(clinicName, city, address, latitude, longitude);
  const googleUrl = buildGoogleMapsRouteUrl(clinicName, city, address, latitude, longitude);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`inline-flex items-center justify-center gap-1.5 font-bold rounded-xl transition-all shadow-sm ${
          size === "sm" ? "px-3.5 py-1.5 text-xs" : "px-4 py-2 text-sm"
        } bg-primary/10 text-primary hover:bg-primary/20 border border-primary/25 active:scale-95`}
      >
        <Navigation className="w-3.5 h-3.5" />
        <span>Маршрут</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 mt-1.5 w-52 rounded-2xl bg-white shadow-2xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
            {isKz ? "Навигаторды таңдаңыз:" : "Выберите навигатор:"}
          </div>

          <a
            href={gisUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors group"
          >
            <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-extrabold text-[10px] group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              2G
            </span>
            <div className="flex flex-col">
              <span className="font-bold">2GIS Маршрут</span>
              <span className="text-[10px] text-slate-400 font-normal">{isKz ? "Авто-маршрут қою" : "Маршрут на авто"}</span>
            </div>
            <ExternalLink className="w-3 h-3 ml-auto opacity-40 group-hover:opacity-100 text-emerald-600" />
          </a>

          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors group border-t border-slate-50"
          >
            <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-extrabold text-[10px] group-hover:bg-blue-600 group-hover:text-white transition-colors">
              GM
            </span>
            <div className="flex flex-col">
              <span className="font-bold">Google Maps</span>
              <span className="text-[10px] text-slate-400 font-normal">{isKz ? "Google Навигатор" : "Google Навигатор"}</span>
            </div>
            <ExternalLink className="w-3 h-3 ml-auto opacity-40 group-hover:opacity-100 text-blue-600" />
          </a>
        </div>
      )}
    </div>
  );
}
