// todo: remove mock functionality - replace with API call to Flask backend

export type ProviderBookingStatus = "confirmed" | "pending" | "requested" | "cancelled" | "completed";

export interface ProviderBooking {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  location?: string;        // commune / client_location from API
  serviceName: string;
  serviceType: string;
  providerId: string;
  date: string;             // YYYY-MM-DD
  time: string;             // HH:MM (24h)
  duration: string;
  price: number;
  status: ProviderBookingStatus;
  notes?: string;
  requestedAt: string;
}

// todo: remove mock functionality - replace with API data
// These are bookings from the provider's perspective (Sarah Johnson - provider-1)
export const mockProviderBookings: ProviderBooking[] = [
  {
    id: "pb-1",
    customerId: "customer-1",
    customerName: "John Davidson",
    customerEmail: "john.d@email.com",
    customerPhone: "(555) 123-4567",
    serviceName: "Deep Tissue Massage",
    serviceType: "Wellness",
    providerId: "provider-1",
    date: "Dec 10, 2025",
    time: "2:00 PM",
    duration: "60 min",
    price: 85,
    status: "confirmed",
    requestedAt: "Dec 5, 2025",
  },
  {
    id: "pb-2",
    customerId: "customer-2",
    customerName: "Emily Richardson",
    customerEmail: "emily.r@email.com",
    customerPhone: "(555) 234-5678",
    serviceName: "Swedish Massage",
    serviceType: "Wellness",
    providerId: "provider-1",
    date: "Dec 11, 2025",
    time: "10:00 AM",
    duration: "60 min",
    price: 75,
    status: "pending",
    notes: "First-time customer, prefers light pressure",
    requestedAt: "Dec 6, 2025",
  },
  {
    id: "pb-3",
    customerId: "customer-3",
    customerName: "Michael Torres",
    customerEmail: "m.torres@email.com",
    customerPhone: "(555) 345-6789",
    serviceName: "Hot Stone Therapy",
    serviceType: "Wellness",
    providerId: "provider-1",
    date: "Dec 12, 2025",
    time: "3:30 PM",
    duration: "90 min",
    price: 120,
    status: "pending",
    requestedAt: "Dec 7, 2025",
  },
  {
    id: "pb-4",
    customerId: "customer-4",
    customerName: "Sarah Kim",
    customerEmail: "sarah.kim@email.com",
    customerPhone: "(555) 456-7890",
    serviceName: "Sports Massage",
    serviceType: "Wellness",
    providerId: "provider-1",
    date: "Dec 8, 2025",
    time: "4:00 PM",
    duration: "45 min",
    price: 65,
    status: "cancelled",
    notes: "Customer requested cancellation - schedule conflict",
    requestedAt: "Dec 3, 2025",
  },
  {
    id: "pb-5",
    customerId: "customer-5",
    customerName: "David Chen",
    customerEmail: "d.chen@email.com",
    customerPhone: "(555) 567-8901",
    serviceName: "Deep Tissue Massage",
    serviceType: "Wellness",
    providerId: "provider-1",
    date: "Dec 5, 2025",
    time: "11:00 AM",
    duration: "60 min",
    price: 85,
    status: "completed",
    requestedAt: "Nov 28, 2025",
  },
  {
    id: "pb-6",
    customerId: "customer-6",
    customerName: "Amanda Foster",
    customerEmail: "a.foster@email.com",
    customerPhone: "(555) 678-9012",
    serviceName: "Swedish Massage",
    serviceType: "Wellness",
    providerId: "provider-1",
    date: "Dec 14, 2025",
    time: "1:00 PM",
    duration: "60 min",
    price: 75,
    status: "pending",
    notes: "Regular customer - prefers essential oils",
    requestedAt: "Dec 8, 2025",
  },
  {
    id: "pb-7",
    customerId: "customer-7",
    customerName: "Robert Williams",
    customerEmail: "r.williams@email.com",
    customerPhone: "(555) 789-0123",
    serviceName: "Hot Stone Therapy",
    serviceType: "Wellness",
    providerId: "provider-1",
    date: "Dec 15, 2025",
    time: "5:00 PM",
    duration: "90 min",
    price: 120,
    status: "confirmed",
    requestedAt: "Dec 9, 2025",
  },
  {
    id: "pb-8",
    customerId: "customer-8",
    customerName: "Jennifer Lee",
    customerEmail: "j.lee@email.com",
    customerPhone: "(555) 890-1234",
    serviceName: "Sports Massage",
    serviceType: "Wellness",
    providerId: "provider-1",
    date: "Dec 3, 2025",
    time: "9:00 AM",
    duration: "45 min",
    price: 65,
    status: "completed",
    requestedAt: "Nov 25, 2025",
  },
];

// Helper to get unique values for filter dropdowns
export const providerBookingDates = Array.from(new Set(mockProviderBookings.map((b) => b.date)));
export const providerServiceNames = Array.from(new Set(mockProviderBookings.map((b) => b.serviceName)));

// Helper function to get bookings by status
export function getBookingsByStatus(status: ProviderBookingStatus): ProviderBooking[] {
  return mockProviderBookings.filter((b) => b.status === status);
}

// Helper function to count bookings by status
export function getBookingCounts(): Record<ProviderBookingStatus, number> {
  return {
    pending:   mockProviderBookings.filter((b) => b.status === "pending").length,
    requested: mockProviderBookings.filter((b) => b.status === "requested").length,
    confirmed: mockProviderBookings.filter((b) => b.status === "confirmed").length,
    completed: mockProviderBookings.filter((b) => b.status === "completed").length,
    cancelled: mockProviderBookings.filter((b) => b.status === "cancelled").length,
  };
}
