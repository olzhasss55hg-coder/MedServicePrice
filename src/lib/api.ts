/**
 * API client utilities for MedService platform.
 */

import {
  Clinic,
  ClinicDetail,
  Doctor,
  DoctorSlot,
  Booking,
  Review,
  PromoCodeResponse,
  SearchResult,
  SymptomCheckResponse,
  UserPlan,
  SearchQuota,
} from './types';

export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://medservice.kz';
}

export function getApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured && configured.trim()) {
    return configured.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:8000'
      : window.location.origin;
  }
  return 'http://localhost:8000';
}

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://medservice.kz').replace(/\/+$/, '');

export function buildApiUrl(path: string): string {
  const base = getApiUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export function getSearchSessionId(): string {
  if (typeof window === 'undefined') return 'server-session';
  let sessionId = localStorage.getItem('medservice_search_session');
  if (!sessionId) {
    sessionId = `guest_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
    localStorage.setItem('medservice_search_session', sessionId);
  }
  return sessionId;
}

export class SearchLimitExceededError extends Error {
  quota?: SearchQuota;
  constructor(message: string, quota?: SearchQuota) {
    super(message);
    this.name = 'SearchLimitExceededError';
    this.quota = quota;
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const fullUrl = url.startsWith('http://') || url.startsWith('https://') 
    ? url 
    : buildApiUrl(url);

  const sessionId = getSearchSessionId();
  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Search-Session': sessionId,
      ...options?.headers,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    let errorDetail = `Request failed with status ${res.status}`;
    let parsedData: any = null;
    try {
      parsedData = await res.json();
      if (parsedData.detail) {
        errorDetail = typeof parsedData.detail === 'string' ? parsedData.detail : JSON.stringify(parsedData.detail);
      }
    } catch {}

    if (res.status === 402 || (parsedData?.detail && parsedData.detail.limit_reached)) {
      const msg = typeof parsedData?.detail?.message === 'string'
        ? parsedData.detail.message
        : 'Тегін іздеу лимиті (20) таусылды. Шексіз іздеу үшін тарифті таңдаңыз.';
      throw new SearchLimitExceededError(msg, parsedData?.detail);
    }

    throw new Error(errorDetail);
  }

  return res.json();
}

export const api = {
  // Search
  searchServices: (params: Record<string, any>) => {
    const cleanParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        cleanParams.append(k, String(v));
      }
    });
    return fetchJson<SearchResult[]>(buildApiUrl(`/api/search?${cleanParams.toString()}`));
  },

  // Clinics
  getClinics: (params?: Record<string, any>) => {
    const cleanParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          cleanParams.append(k, String(v));
        }
      });
    }
    return fetchJson<Clinic[]>(buildApiUrl(`/api/clinics?${cleanParams.toString()}`));
  },

  getClinicDetails: (id: string) => {
    return fetchJson<ClinicDetail>(buildApiUrl(`/api/clinics/${id}`));
  },

  getClinicsInBounds: (minLat: number, maxLat: number, minLng: number, maxLng: number, city?: string) => {
    const cleanParams = new URLSearchParams({
      min_lat: String(minLat),
      max_lat: String(maxLat),
      min_lng: String(minLng),
      max_lng: String(maxLng),
    });
    if (city) cleanParams.append('city', city);
    return fetchJson<any[]>(buildApiUrl(`/api/clinics/bounds?${cleanParams.toString()}`));
  },

  // Doctors
  getDoctors: (params?: Record<string, any>) => {
    const cleanParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          cleanParams.append(k, String(v));
        }
      });
    }
    return fetchJson<Doctor[]>(buildApiUrl(`/api/doctors?${cleanParams.toString()}`));
  },

  getDoctorSlots: (doctorId: string, date?: string) => {
    const path = date
      ? `/api/doctors/${doctorId}/slots?date=${date}`
      : `/api/doctors/${doctorId}/slots`;
    return fetchJson<DoctorSlot[]>(buildApiUrl(path));
  },

  // Bookings
  createBooking: (payload: {
    clinic_id: string;
    doctor_id?: string | null;
    name: string;
    phone: string;
    preferred_time?: string | null;
    appointment_at?: string | null;
    promo_code?: string | null;
  }) => {
    return fetchJson<Booking>(buildApiUrl('/api/bookings'), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getMyBookings: () => {
    return fetchJson<Booking[]>(buildApiUrl('/api/bookings/me'));
  },

  // Promo Codes
  validatePromoCode: (code: string, amount: number, clinic_id?: string) => {
    return fetchJson<PromoCodeResponse>(buildApiUrl('/api/promocodes/validate'), {
      method: 'POST',
      body: JSON.stringify({ code, amount, clinic_id }),
    });
  },

  // Reviews
  getDoctorReviews: (doctorId: string) => {
    return fetchJson<Review[]>(buildApiUrl(`/api/doctors/${doctorId}/reviews`));
  },

  getClinicReviews: (clinicId: string) => {
    return fetchJson<Review[]>(buildApiUrl(`/api/clinics/${clinicId}/reviews`));
  },

  createReview: (payload: {
    rating: number;
    comment?: string;
    doctor_id?: string | null;
    clinic_id?: string | null;
    patient_name?: string;
    booking_id?: string | null;
  }) => {
    return fetchJson<Review>(buildApiUrl('/api/reviews'), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Subscriptions & Plans
  getMyPlan: () => {
    return fetchJson<UserPlan>(buildApiUrl('/api/subscriptions/plan'));
  },

  getSearchQuota: () => {
    return fetchJson<SearchQuota>(buildApiUrl('/api/search/quota'));
  },

  upgradePlan: (plan: 'standard' | 'premium' | 'pro' | 'vip' | 'free') => {
    return fetchJson<{ status: string; message: string; plan: string; priority_booking?: boolean; is_unlimited_search?: boolean }>(buildApiUrl('/api/payment/checkout'), {
      method: 'POST',
      body: JSON.stringify({ plan }),
    });
  },

  // AI Symptom Checker
  checkSymptoms: (payload: {
    symptoms_text?: string;
    selected_symptoms: string[];
    language?: string;
    city?: string;
  }) => {
    return fetchJson<SymptomCheckResponse>(buildApiUrl('/api/ai/symptom-checker'), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
