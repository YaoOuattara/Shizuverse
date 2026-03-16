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
  id: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  serviceSlug: string;
  date: string;
  status: string;
  location: string;
  notes: string;
  providerName: string;
  providerPhone: string;
  createdAt: string;
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
    adminApi.getBookings(status)
      .then((data) => setBookings(Array.isArray(data) ? data : (data.bookings ?? [])))
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
