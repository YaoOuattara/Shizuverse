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
  client: string;
  provider: string;
  service: string;
  date: string;
  status: string;
  price: number;
  notes?: string;
}

export interface ApiProvider {
  id: number;
  user_id: number;
  name: string;
  email: string;
  verified: boolean;
  address?: string;
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
      .then(setBookings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [status]);

  return { bookings, loading };
}

export function useAdminProviders() {
  const [providers, setProviders] = useState<ApiProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getProviders()
      .then(setProviders)
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
