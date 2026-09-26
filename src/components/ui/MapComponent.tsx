"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTranslation } from "@/i18n/LanguageContext";
import { build2GisRouteUrl, buildGoogleMapsRouteUrl, load2GisSdk, loadGoogleMapsSdk } from "@/lib/maps";

interface MapComponentProps {
  clinics: Clinic[];
  selectedClinicId?: string | null;
  onClinicSelect?: (clinicId: string) => void;
}

interface Clinic {
  id: string;
  name: string;
  city: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  reviews_count?: number | null;
  photo_url?: string | null;
  phone?: string | null;
}

const defaultCenter: [number, number] = [51.169392, 71.449074];

// Official Red/Teal Medical Teardrop Location Pin
const createOfficialPin = (isSelected: boolean) => {
  const pinColor = isSelected ? "#0d9488" : "#EF4444";
  const glowColor = isSelected ? "rgba(13, 148, 136, 0.4)" : "rgba(239, 68, 68, 0.35)";
  const size = isSelected ? 46 : 40;
  const width = Math.round(size * 0.75);

  return L.divIcon({
    className: "medservice-official-pin",
    html: `
      <div style="position: relative; width: ${width}px; height: ${size}px; filter: drop-shadow(0 4px 10px ${glowColor}); cursor: pointer; transition: transform 0.2s ease;">
        <svg viewBox="0 0 32 44" width="${width}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Pin body -->
          <path d="M16 0C7.16344 0 0 7.16344 0 16C0 26.5 16 44 16 44C16 44 32 26.5 32 16C32 7.16344 24.8366 0 16 0Z" fill="${pinColor}"/>
          <!-- White circle badge inside -->
          <circle cx="16" cy="16" r="10.5" fill="white"/>
          <!-- Medical Cross Icon -->
          <path d="M14 9.5H18V13.5H22V17.5H18V21.5H14V17.5H10V13.5H14V9.5Z" fill="${pinColor}"/>
        </svg>
      </div>
    `,
    iconSize: [width, size],
    iconAnchor: [width / 2, size], // Precise bottom tip anchor!
    popupAnchor: [0, -size + 4],
  });
};

export default function MapComponent({ clinics, selectedClinicId, onClinicSelect }: MapComponentProps) {
  const { locale } = useTranslation();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markerLayer = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, { lat: number; lng: number; marker: L.Marker }>>(new Map());

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    const map = L.map(mapRef.current, { 
      zoomControl: true,
      fadeAnimation: true,
      zoomAnimation: true
    }).setView(defaultCenter, 12);
    
    leafletMap.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
      tileSize: 256,
      zoomOffset: 0
    }).addTo(map);
    
    markerLayer.current = L.layerGroup().addTo(map);
    void loadGoogleMapsSdk().catch(() => undefined);
    void load2GisSdk().catch(() => undefined);
    const mountedMarkers = markersRef.current;

    const fixSizes = () => {
      if (leafletMap.current) {
        leafletMap.current.invalidateSize();
      }
    };

    const timer1 = window.setTimeout(fixSizes, 100);
    const timer2 = window.setTimeout(fixSizes, 400);
    const timer3 = window.setTimeout(fixSizes, 1000);

    const resizeObserver = new ResizeObserver(() => {
      fixSizes();
    });

    if (mapRef.current) {
      resizeObserver.observe(mapRef.current);
    }

    window.addEventListener("resize", fixSizes);

    return () => {
      window.clearTimeout(timer1);
      window.clearTimeout(timer2);
      window.clearTimeout(timer3);
      resizeObserver.disconnect();
      window.removeEventListener("resize", fixSizes);
      leafletMap.current?.remove();
      leafletMap.current = null;
      markerLayer.current = null;
      mountedMarkers.clear();
    };
  }, []);

  useEffect(() => {
    const map = leafletMap.current;
    const layer = markerLayer.current;
    if (!map || !layer) return;

    layer.clearLayers();
    markersRef.current.clear();

    const withCoords = clinics.filter((clinic) => clinic.latitude != null && clinic.longitude != null);
    if (withCoords.length === 0) {
      map.setView(defaultCenter, 12);
      return;
    }

    const noAddress = locale === "kk" ? "Мекенжай көрсетілмеген" : "Адрес не указан";
    const reviewsLabel = locale === "kk" ? "пікір" : "отзывов";
    const detailsLabel = locale === "kk" ? "Толығырақ" : "Подробнее";
    const route2gisLabel = locale === "kk" ? "2GIS Маршрут" : "Маршрут в 2GIS";
    const routeGoogleLabel = locale === "kk" ? "Google Maps Маршрут" : "Маршрут в Google";

    withCoords.forEach((clinic) => {
      const lat = clinic.latitude as number;
      const lng = clinic.longitude as number;
      const isSelected = selectedClinicId === clinic.id;
      const pinIcon = createOfficialPin(isSelected);

      const gisRoute = build2GisRouteUrl(clinic.name, clinic.city, clinic.address || "", lat, lng);
      const googleRoute = buildGoogleMapsRouteUrl(clinic.name, clinic.city, clinic.address || "", lat, lng);

      const popupHtml = `
        <div style="font-family: inherit; min-width: 230px; padding: 6px;">
          ${clinic.photo_url ? `<img src="${clinic.photo_url}" alt="${clinic.name}" style="width: 100%; height: 95px; object-fit: cover; border-radius: 10px; margin-bottom: 8px;" />` : ''}
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #EF4444;"></span>
            <span style="font-size: 11px; font-weight: 700; color: #EF4444; text-transform: uppercase; letter-spacing: 0.5px;">${locale === "kk" ? "Медициналық мекеме" : "Медицинское учреждение"}</span>
          </div>
          <h4 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #0f172a; line-height: 1.3;">${clinic.name}</h4>
          <div style="color: #64748b; font-size: 12px; margin-bottom: 6px;">📍 ${clinic.city}, ${clinic.address || noAddress}</div>
          <div style="color: #d97706; font-size: 12px; font-weight: 700; margin-bottom: 10px;">⭐ ${clinic.rating ?? "5.0"} (${clinic.reviews_count ?? 120} ${reviewsLabel})</div>
          
          <a href="/clinics/${encodeURIComponent(clinic.id)}" style="display: block; background: #0F6FFF; color: white; text-align: center; padding: 8px 12px; border-radius: 10px; text-decoration: none; font-size: 12px; font-weight: 700; margin-bottom: 8px; box-shadow: 0 4px 12px rgba(15,111,255,0.25);">
            ${detailsLabel}
          </a>

          <div style="display: flex; flex-direction: column; gap: 6px; font-size: 11px;">
            <a href="${gisRoute}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 6px; background: #ecfccb; color: #3f6212; border: 1px solid #d9f99d; padding: 6px 8px; border-radius: 8px; text-decoration: none; font-weight: 700;">
              🧭 ${route2gisLabel}
            </a>
            <a href="${googleRoute}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 6px; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; padding: 6px 8px; border-radius: 8px; text-decoration: none; font-weight: 700;">
              🗺️ ${routeGoogleLabel}
            </a>
          </div>
        </div>
      `;

      const marker = L.marker([lat, lng], { icon: pinIcon }).addTo(layer);
      marker.bindPopup(popupHtml, { maxWidth: 280, className: "medservice-custom-popup" });
      marker.on("click", () => {
        if (onClinicSelect) onClinicSelect(clinic.id);
      });
      markersRef.current.set(clinic.id, { lat, lng, marker });
    });

    const bounds = L.latLngBounds(withCoords.map((clinic) => [clinic.latitude as number, clinic.longitude as number]));
    if (withCoords.length === 1) {
      map.setView([withCoords[0].latitude as number, withCoords[0].longitude as number], 14);
    } else {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [clinics, locale, onClinicSelect, selectedClinicId]);

  useEffect(() => {
    if (!selectedClinicId || !leafletMap.current) return;
    const selected = markersRef.current.get(selectedClinicId);
    if (!selected) return;
    leafletMap.current.flyTo([selected.lat, selected.lng], 16, { animate: true, duration: 0.8 });
    selected.marker.openPopup();
  }, [selectedClinicId, clinics]);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-full min-h-[460px] rounded-2xl relative shadow-inner overflow-hidden" 
      style={{ zIndex: 1 }}
    />
  );
}
