import { useEffect, useState } from "react";
import { providerApi } from "@/lib/api";
import type { ProviderBooking, ProviderBookingStatus } from "@/data/mockProviderBookings";

export interface ApiProviderBooking {
  id: number;
  customerId: number;
  customerName: string;
  customerEmail: string;
  serviceName: string;
  serviceType: string;
  providerId: number;
  date: string;
  time: string;
  duration: number;
  price: number;
  status: string;
  notes?: string;
  requestedAt?: string;
}

function adaptApiBooking(b: ApiProviderBooking): ProviderBooking {
  return {
    id: String(b.id),
    customerId: String(b.customerId),
    customerName: b.customerName,
    customerEmail: b.customerEmail,
    customerPhone: "",
    serviceName: b.serviceName,
    serviceType: b.serviceType,
    providerId: String(b.providerId),
    date: b.date,
    time: b.time,
    duration: `${b.duration} min`,
    price: b.price,
    status: (b.status as ProviderBookingStatus) || "pending",
    notes: b.notes,
    requestedAt: b.requestedAt || "",
  };
}

export function useProviderBookings(providerId?: number) {
  const [bookings, setBookings] = useState<ProviderBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    providerApi.getBookings(providerId)
      .then((data: ApiProviderBooking[]) => setBookings(data.map(adaptApiBooking)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [providerId]);

  return { bookings, loading };
}
