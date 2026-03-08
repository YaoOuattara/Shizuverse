export type Booking = {
  id: string;
  serviceId: string;
  name: string;
  phone: string;
  location: string;
  date: string;
  notes?: string;
};

export const bookings: Booking[] = [];

