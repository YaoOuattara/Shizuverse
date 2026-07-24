import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";

export interface ApiStats {
  total_bookings: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  total_providers: number;
}

export interface ApiBooking {
  id: number;
  client_name: string;
  client_phone: string;
  client_location: string;
  service_id?: number | null;
  service_name: string;
  service_slug: string;
  appointment_date: string;
  locale?: string;
  status: string;
  notes: string | null;
  provider_name: string | null;
  provider_phone: string | null;
  created_at: string | null;
  payment_status: string;   // dossier flag: open | pending | refunded
  payout_status: string;
  amount_xof: number | null;
  // Collection axis (derived server-side from amount_collected).
  amount_collected?: number | null;
  amount_due?: number | null;
  collection_status?: 'unpaid' | 'partial' | 'paid' | null;
  overpaid?: number | null;
  decline_reason: string | null;
  cancellation_reason: string | null;
  time_slot?: string;
  time_preference?: string;
  urgency?: string;
  final_amount?: number | null;
  shizu_commission?: number | null;
  provider_payout?: number | null;
  payment_tier?: string | null;
  deposit_amount?: number | null;
  cancellation_policy?: string | null;
  amount_locked?: boolean;
  amount_locked_at?: string | null;
  dispute_flag?: boolean;
  dispute_reason?: string | null;
  dispute_opened_at?: string | null;
  dispute_resolution?: string | null;
  dispute_resolved_at?: string | null;
}

export interface ApiProvider {
  id: number;
  user_id: number;
  // Portal endpoint fields
  company_name?: string;
  phone_number?: string;
  verification_status?: string;
  listed_status?: string;
  provider_status?: string;
  rejection_reason?: string;
  rejection_note?: string;
  submitted_at?: string;
  reviewed_at?: string;
  bio?: string;
  address?: string;
  zones?: string[];
  services?: string[];
  // Provider-declared rates, keyed by localized category name (T-14: NOT Shizu
  // pricing). e.g. { "Climatisation et électroménager": { min: 10000, max: 40000 } }
  service_rates?: Record<string, { min: number; max: number }> | null;
  // Old endpoint fields (kept for backwards compat)
  name?: string;
  email?: string;
  verified?: boolean;
  created_at?: string;
  id_document_url?: string | null;
  profile_photo_url?: string | null;
  experience_photo_url?: string | null;
}

export interface ApiReview {
  id: number;
  booking_id: number;
  client_name: string;
  rating: number;
  text: string;
  service_slug: string;
  provider_name: string;
  provider_id: number | null;
  moderation_status: string;
  display_status: string;
  is_published: boolean;
  punctuality?: boolean;
  respect?: boolean;
  created_at: string;
}

export interface ApiService {
  id: number;
  name: string;
  category: string;
  category_id?: number | null;
  price: number;
  duration: number;
  active: boolean;
  // Pricing inputs for the suggestion engine (display only; never constrains amount_xof)
  base_price?: number | null;
  category_price_min?: number | null;
  category_price_max?: number | null;
  category_is_quote_based?: boolean;
}

export function useAdminStats() {
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { stats, loading };
}

export function useAdminBookings(status?: string) {
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.portalGetBookings(status ? { status } : undefined)
      .then((data: ApiBooking[]) => setBookings(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [status]);

  return { bookings, loading };
}

export function useAdminProviders() {
  const [providers, setProviders] = useState<ApiProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.portalGetProviders()
      .then((data: ApiProvider[]) => setProviders(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { providers, loading };
}

export function useAdminServices() {
  const [services, setServices] = useState<ApiService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getServices()
      .then((data: ApiService[]) => setServices(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { services, loading };
}

export interface ApiOverview {
  gmv_total: number;
  gmv_month: number;
  revenue_shizu: number;
  payouts_due: number;
  payouts_sent: number;
  total_bookings: number;
  completed_bookings: number;
  cancelled_bookings: number;
  pending_bookings: number;
  confirmed_bookings: number;
  completion_rate: number;
  active_providers: number;
}

export function useAdminOverview() {
  const [overview, setOverview] = useState<ApiOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.portalGetOverview()
      .then((data: ApiOverview) => setOverview(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { overview, loading };
}

export interface FinanceSummary {
  completed_bookings: number;
  total_paid_xof: number;
  payouts_due_count: number;
  payouts_due_value_xof: number;
  failed_payouts: number;
  unpaid_completed_bookings: number;
}

export function useAdminReviews(status?: string) {
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.portalGetReviews(status ? { status } : undefined)
      .then((data: ApiReview[]) => setReviews(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [status]);

  return { reviews, setReviews, loading };
}

export function useAdminFinanceSummary() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    adminApi.portalGetFinanceSummary()
      .then((data: FinanceSummary) => setSummary(data))
      .catch(() => setSummary(null))
      .finally(() => setIsLoading(false));
  }, []);

  return { summary, isLoading };
}
