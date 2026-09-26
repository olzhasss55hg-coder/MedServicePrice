export interface Doctor {
  id: string;
  clinic_id?: string;
  first_name: string;
  last_name: string;
  name?: string;
  specialty: string;
  gender?: "m" | "f" | string;
  category?: string;
  is_pediatric?: boolean;
  experience_years?: number;
  experience?: number;
  rating?: number;
  reviews_count?: number;
  consultation_price?: number;
  price?: number;
  photo_url?: string | null;
  photo?: string | null;
  languages?: string[];
  description?: string | null;
  clinic?: Clinic;
}

export interface Clinic {
  id: string;
  name: string;
  city: string;
  address: string;
  phone?: string | null;
  working_hours?: string | null;
  source_url?: string | null;
  photo_url?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  reviews_count?: number | null;
  has_online_booking?: boolean;
  has_active_promotion?: boolean;
  doctors?: Doctor[];
}

export interface Service {
  id: string;
  name_raw: string;
  name_norm?: string | null;
  category: string;
}

export interface Price {
  id: string;
  clinic_id: string;
  service_id: string;
  price_kzt: number;
  parsed_at?: string | null;
  clinic: Clinic;
  service: Service;
}

export interface SearchResult {
  service: Service;
  avg_price: number;
  min_price: number;
  clinics_count: number;
  best_offer_clinic?: Clinic | null;
  best_offer_price?: number | null;
  last_updated_at?: string | null;
}

export interface ClinicDetail {
  clinic: Clinic;
  services: Price[];
  doctors: Doctor[];
}

export interface DoctorSlot {
  starts_at: string;
  available: boolean;
}

export interface Booking {
  id: string;
  clinic_id: string;
  doctor_id?: string | null;
  name: string;
  phone: string;
  preferred_time?: string | null;
  appointment_at?: string | null;
  promo_code?: string | null;
  discount_amount: number;
  total_amount?: number | null;
  priority_booking: boolean;
  status: string;
  doctor_name?: string | null;
  clinic_name?: string | null;
  created_at?: string | null;
}

export interface Review {
  id: string;
  rating: number;
  comment?: string | null;
  doctor_id?: string | null;
  clinic_id?: string | null;
  patient_name?: string | null;
  is_verified?: boolean;
  user_id?: string | null;
  created_at: string;
  average_rating?: number;
  reviews_count?: number;
}

export interface PromoCodeResponse {
  code: string;
  discount_type: "percent" | "fixed" | string;
  discount_value: number;
  discount_amount: number;
  total_amount: number;
  expires_at?: string | null;
}

export interface UserPlan {
  plan: "free" | "pro" | "premium";
  ai_requests_used: number;
  ai_limit?: number | null;
  priority_booking: boolean;
}

export interface RecommendedDoctor {
  id: string;
  name: string;
  specialty: string;
  clinic_id: string;
  clinic_name?: string | null;
  price: number;
  rating: number;
  photo_url?: string | null;
  city?: string | null;
}

export interface SymptomCheckResponse {
  potential_conditions: string[];
  specialty: string;
  recommended_examinations: string[];
  disclaimer: string;
  recommended_doctors: RecommendedDoctor[];
  ai_analysis: string;
}
