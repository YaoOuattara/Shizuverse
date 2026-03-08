import type { BookingCardProps } from "@/components/BookingCard";

// todo: remove mock functionality - replace with API call to Flask backend
export const mockBookings: BookingCardProps[] = [
  {
    id: "1",
    serviceName: "Deep Tissue Massage",
    serviceType: "Wellness",
    providerId: "provider-1", // todo: remove mock functionality - use real ID from API
    providerName: "Sarah Johnson",
    date: "Dec 10, 2025",
    time: "2:00 PM",
    status: "confirmed",
  },
  {
    id: "2",
    serviceName: "Hair Styling & Cut",
    serviceType: "Beauty",
    providerId: "provider-2", // todo: remove mock functionality - use real ID from API
    providerName: "Michael Chen",
    date: "Dec 12, 2025",
    time: "10:30 AM",
    status: "confirmed",
  },
  {
    id: "3",
    serviceName: "Dental Checkup",
    serviceType: "Healthcare",
    providerId: "provider-3", // todo: remove mock functionality - use real ID from API
    providerName: "Dr. Emily Wilson",
    date: "Dec 15, 2025",
    time: "9:00 AM",
    status: "pending",
  },
  {
    id: "4",
    serviceName: "Personal Training Session",
    serviceType: "Fitness",
    providerId: "provider-4", // todo: remove mock functionality - use real ID from API
    providerName: "Alex Rodriguez",
    date: "Dec 8, 2025",
    time: "6:00 PM",
    status: "cancelled",
  },
  {
    id: "5",
    serviceName: "Facial Treatment",
    serviceType: "Beauty",
    providerId: "provider-5", // todo: remove mock functionality - use real ID from API
    providerName: "Lisa Park",
    date: "Dec 18, 2025",
    time: "3:30 PM",
    status: "confirmed",
  },
  {
    id: "6",
    serviceName: "Yoga Class",
    serviceType: "Fitness",
    providerId: "provider-6", // todo: remove mock functionality - use real ID from API
    providerName: "Maya Patel",
    date: "Dec 20, 2025",
    time: "7:00 AM",
    status: "pending",
  },
];

// Helper to get unique values for filter dropdowns
// todo: remove mock functionality - these will come from API
export const serviceTypes = Array.from(new Set(mockBookings.map((b) => b.serviceType)));
export const providerNames = Array.from(new Set(mockBookings.map((b) => b.providerName)));
export const bookingDates = Array.from(new Set(mockBookings.map((b) => b.date)));
