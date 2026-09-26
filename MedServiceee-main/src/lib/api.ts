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
} from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    let errorDetail = `Request failed with status ${res.status}`;
    try {
      const data = await res.json();
      if (data.detail) {
        errorDetail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      }
    } catch {}
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
    return fetchJson<SearchResult[]>(`${API_URL}/api/search?${cleanParams.toString()}`);
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
    return fetchJson<Clinic[]>(`${API_URL}/api/clinics?${cleanParams.toString()}`);
  },

  getClinicDetails: (id: string) => {
    return fetchJson<ClinicDetail>(`${API_URL}/api/clinics/${id}`);
  },

  getClinicsInBounds: (minLat: number, maxLat: number, minLng: number, maxLng: number, city?: string) => {
    const cleanParams = new URLSearchParams({
      min_lat: String(minLat),
      max_lat: String(maxLat),
      min_lng: String(minLng),
      max_lng: String(maxLng),
    });
    if (city) cleanParams.append('city', city);
    return fetchJson<any[]>(`${API_URL}/api/clinics/bounds?${cleanParams.toString()}`);
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
    return fetchJson<Doctor[]>(`${API_URL}/api/doctors?${cleanParams.toString()}`);
  },

  getDoctorSlots: (doctorId: string, date?: string) => {
    const url = date
      ? `${API_URL}/api/doctors/${doctorId}/slots?date=${date}`
      : `${API_URL}/api/doctors/${doctorId}/slots`;
    return fetchJson<DoctorSlot[]>(url);
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
    return fetchJson<Booking>(`${API_URL}/api/bookings`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getMyBookings: () => {
    return fetchJson<Booking[]>(`${API_URL}/api/bookings/me`);
  },

  // Promo Codes
  validatePromoCode: (code: string, amount: number, clinic_id?: string) => {
    return fetchJson<PromoCodeResponse>(`${API_URL}/api/promocodes/validate`, {
      method: 'POST',
      body: JSON.stringify({ code, amount, clinic_id }),
    });
  },

  // Reviews
  getDoctorReviews: (doctorId: string) => {
    return fetchJson<Review[]>(`${API_URL}/api/doctors/${doctorId}/reviews`);
  },

  getClinicReviews: (clinicId: string) => {
    return fetchJson<Review[]>(`${API_URL}/api/clinics/${clinicId}/reviews`);
  },

  createReview: (payload: {
    rating: number;
    comment?: string;
    doctor_id?: string | null;
    clinic_id?: string | null;
    patient_name?: string;
    booking_id?: string | null;
  }) => {
    return fetchJson<Review>(`${API_URL}/api/reviews`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Subscriptions & Plans
  getMyPlan: () => {
    return fetchJson<UserPlan>(`${API_URL}/api/subscriptions/plan`);
  },

  upgradePlan: (plan: 'pro' | 'premium') => {
    return fetchJson<{ status: string; message: string; plan: string }>(`${API_URL}/api/payment/checkout`, {
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
    return fetchJson<SymptomCheckResponse>(`${API_URL}/api/ai/symptom-checker`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
