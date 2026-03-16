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
  service_name: string;
  service_slug: string;
  appointment_date: string;
  status: string;
  notes: string | null;
  provider_name: string | null;
  provider_phone: string | null;
  created_at: string | null;
  payment_status: string;
  payout_status: string;
  amount_xof: number | null;
  decline_reason: string | null;
  cancellation_reason: string | null;
}

export interface ApiProvider {
  id: number;
  user_id: number;
  // New portal endpoint fields
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
  // Old endpoint fields (kept for backwards compat)
  name?: string;
  email?: string;
  verified?: boolean;
  created_at?: string;
}

export interface ApiService {
  id: number;
  name: string;
  category: string;
  price: number;
  duration: number;
  active: boolean;
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
      .then(setServices)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { services, loading };
}
