export const MAPS_CONFIG = {
  twoGisApiKey: process.env.NEXT_PUBLIC_2GIS_API_KEY || "",
  googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  defaultProvider: process.env.NEXT_PUBLIC_DEFAULT_MAP_PROVIDER || "2gis",
};

/**
 * Builds direct navigation/routing URL for 2GIS (opens auto-route from current location to destination)
 */
export function build2GisRouteUrl(name: string, city: string, address: string, latitude?: number | null, longitude?: number | null) {
  if (latitude != null && longitude != null) {
    // 2GIS direct route search link
    return `https://2gis.kz/routeSearch/rsType/car/to/${longitude},${latitude}`;
  }
  return `https://2gis.kz/search/${encodeURIComponent(`${name}, ${city}, ${address}`)}`;
}

/**
 * Builds direct navigation/routing URL for Google Maps (auto driving direction from current location)
 */
export function buildGoogleMapsRouteUrl(name: string, city: string, address: string, latitude?: number | null, longitude?: number | null) {
  if (latitude != null && longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${name}, ${city}, ${address}`)}&travelmode=driving`;
}

/**
 * Builds direct navigation/routing URL for Yandex Maps
 */
export function buildYandexMapsRouteUrl(name: string, city: string, address: string, latitude?: number | null, longitude?: number | null) {
  if (latitude != null && longitude != null) {
    return `https://yandex.kz/maps/?rtext=~${latitude}%2C${longitude}&rtt=auto`;
  }
  return `https://yandex.kz/maps/?text=${encodeURIComponent(`${name}, ${city}, ${address}`)}`;
}

let googleMapsPromise: Promise<void> | null = null;
let twoGisPromise: Promise<void> | null = null;

export function loadGoogleMapsSdk(): Promise<void> {
  if (typeof window === "undefined" || !MAPS_CONFIG.googleMapsApiKey) return Promise.resolve();
  const browserWindow = window as Window & { google?: { maps?: unknown } };
  if (browserWindow.google?.maps) return Promise.resolve();
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-medservice-google-maps]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Google Maps SDK failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.dataset.medserviceGoogleMaps = "true";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_CONFIG.googleMapsApiKey)}&libraries=places`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps SDK failed to load"));
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

export function load2GisSdk(): Promise<void> {
  if (typeof window === "undefined" || !MAPS_CONFIG.twoGisApiKey) return Promise.resolve();
  if (twoGisPromise) return twoGisPromise;
  twoGisPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-medservice-2gis]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("2GIS SDK failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.dataset.medservice2gis = "true";
    script.async = true;
    script.src = `https://maps.api.2gis.ru/2.0/loader.js?pkg=full&key=${encodeURIComponent(MAPS_CONFIG.twoGisApiKey)}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("2GIS SDK failed to load"));
    document.head.appendChild(script);
  });
  return twoGisPromise;
}
