// todo: remove mock functionality - replace with API call to Flask backend

export type VerificationStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'suspended';

export interface ProviderService {
  id: string;
  name: string;
  duration: string;
  price: number;
}

export interface ProviderVerification {
  verificationStatus: VerificationStatus;
  listed: boolean;
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  hasIdProof: boolean;
  hasWorkPhoto: boolean;
  hasReference: boolean;
}

export interface Provider {
  id: string;
  name: string;
  avatar?: string;
  bio: string;
  serviceType: string;
  services: ProviderService[];
  averageRating: number;
  totalReviews: number;
  phone?: string;
  serviceArea?: string;
  priceRange?: { min: number; max: number };
  // Verification fields
  verification?: ProviderVerification;
}

export const RATING_THRESHOLDS = {
  TOP_RATED_MIN_RATING: 4.7,
  TOP_RATED_MIN_REVIEWS: 10,
} as const;

export interface Review {
  id: string;
  providerId: string;
  bookingId: string;
  reviewerName: string;
  rating: number;
  comment: string;
  date: string;
}

// todo: remove mock functionality - replace with API data
export const mockProviders: Provider[] = [
  {
    id: "provider-1",
    name: "Sarah Johnson",
    bio: "Certified massage therapist with over 10 years of experience. Specializing in deep tissue and Swedish massage techniques to help you relax and recover.",
    serviceType: "Wellness",
    services: [
      { id: "s1-1", name: "Deep Tissue Massage", duration: "60 min", price: 85 },
      { id: "s1-2", name: "Swedish Massage", duration: "60 min", price: 75 },
      { id: "s1-3", name: "Hot Stone Therapy", duration: "90 min", price: 120 },
      { id: "s1-4", name: "Sports Massage", duration: "45 min", price: 65 },
    ],
    averageRating: 4.8,
    totalReviews: 124,
    phone: "(555) 123-4567",
    serviceArea: "Downtown & Midtown",
    priceRange: { min: 65, max: 120 },
    verification: {
      verificationStatus: 'approved',
      listed: true,
      reviewedAt: '2024-03-16',
      hasIdProof: true,
      hasWorkPhoto: true,
      hasReference: true,
    },
  },
  {
    id: "provider-2",
    name: "Michael Chen",
    bio: "Award-winning hair stylist passionate about creating looks that enhance your natural beauty. Trained in the latest cutting and coloring techniques.",
    serviceType: "Beauty",
    services: [
      { id: "s2-1", name: "Hair Styling & Cut", duration: "45 min", price: 55 },
      { id: "s2-2", name: "Color Treatment", duration: "120 min", price: 150 },
      { id: "s2-3", name: "Balayage", duration: "180 min", price: 200 },
      { id: "s2-4", name: "Blowout", duration: "30 min", price: 35 },
    ],
    averageRating: 4.9,
    totalReviews: 89,
    verification: {
      verificationStatus: 'approved',
      listed: true,
      reviewedAt: '2024-05-23',
      hasIdProof: true,
      hasWorkPhoto: true,
      hasReference: true,
    },
  },
  {
    id: "provider-3",
    name: "Dr. Emily Wilson",
    bio: "Board-certified dentist dedicated to providing comprehensive dental care in a comfortable environment. Committed to your oral health and beautiful smile.",
    serviceType: "Healthcare",
    services: [
      { id: "s3-1", name: "Dental Checkup", duration: "30 min", price: 95 },
      { id: "s3-2", name: "Teeth Cleaning", duration: "45 min", price: 120 },
      { id: "s3-3", name: "Whitening Treatment", duration: "60 min", price: 250 },
      { id: "s3-4", name: "Cavity Filling", duration: "45 min", price: 175 },
    ],
    averageRating: 4.7,
    totalReviews: 156,
    verification: {
      verificationStatus: 'approved',
      listed: true,
      reviewedAt: '2024-02-11',
      hasIdProof: true,
      hasWorkPhoto: true,
      hasReference: true,
    },
  },
  {
    id: "provider-4",
    name: "Alex Rodriguez",
    bio: "NASM certified personal trainer helping clients achieve their fitness goals through personalized workout plans and nutrition guidance.",
    serviceType: "Fitness",
    services: [
      { id: "s4-1", name: "Personal Training Session", duration: "60 min", price: 70 },
      { id: "s4-2", name: "Fitness Assessment", duration: "45 min", price: 50 },
      { id: "s4-3", name: "HIIT Training", duration: "45 min", price: 55 },
      { id: "s4-4", name: "Strength Training", duration: "60 min", price: 70 },
    ],
    averageRating: 4.6,
    totalReviews: 78,
    verification: {
      verificationStatus: 'approved',
      listed: true,
      reviewedAt: '2024-06-02',
      hasIdProof: true,
      hasWorkPhoto: true,
      hasReference: true,
    },
  },
  {
    id: "provider-5",
    name: "Lisa Park",
    bio: "Licensed esthetician specializing in skincare treatments. Using premium products and advanced techniques for radiant, healthy skin.",
    serviceType: "Beauty",
    services: [
      { id: "s5-1", name: "Facial Treatment", duration: "60 min", price: 95 },
      { id: "s5-2", name: "Chemical Peel", duration: "45 min", price: 130 },
      { id: "s5-3", name: "Microdermabrasion", duration: "60 min", price: 150 },
      { id: "s5-4", name: "LED Light Therapy", duration: "30 min", price: 75 },
    ],
    averageRating: 4.9,
    totalReviews: 203,
    verification: {
      verificationStatus: 'approved',
      listed: true,
      reviewedAt: '2024-04-19',
      hasIdProof: true,
      hasWorkPhoto: true,
      hasReference: true,
    },
  },
  {
    id: "provider-6",
    name: "Maya Patel",
    bio: "RYT-500 certified yoga instructor bringing mindfulness and movement together. Specializing in Vinyasa, Hatha, and restorative yoga practices.",
    serviceType: "Fitness",
    services: [
      { id: "s6-1", name: "Yoga Class", duration: "60 min", price: 25 },
      { id: "s6-2", name: "Private Yoga Session", duration: "60 min", price: 80 },
      { id: "s6-3", name: "Meditation Session", duration: "30 min", price: 35 },
      { id: "s6-4", name: "Breathwork Class", duration: "45 min", price: 30 },
    ],
    averageRating: 4.8,
    totalReviews: 167,
    verification: {
      verificationStatus: 'approved',
      listed: true,
      reviewedAt: '2024-07-11',
      hasIdProof: true,
      hasWorkPhoto: true,
      hasReference: true,
    },
  },
];

// todo: remove mock functionality - replace with API data
export const mockReviews: Review[] = [
  {
    id: "review-1",
    providerId: "provider-1",
    bookingId: "past-1",
    reviewerName: "John D.",
    rating: 5,
    comment: "Amazing massage! Sarah really knows how to work out the knots. Will definitely be back.",
    date: "Nov 28, 2025",
  },
  {
    id: "review-2",
    providerId: "provider-1",
    bookingId: "past-2",
    reviewerName: "Emily R.",
    rating: 4,
    comment: "Very relaxing experience. The studio is clean and peaceful.",
    date: "Nov 15, 2025",
  },
  {
    id: "review-3",
    providerId: "provider-2",
    bookingId: "past-3",
    reviewerName: "Sophie M.",
    rating: 5,
    comment: "Best haircut I've ever had! Michael really listened to what I wanted.",
    date: "Nov 20, 2025",
  },
  {
    id: "review-4",
    providerId: "provider-3",
    bookingId: "past-4",
    reviewerName: "David K.",
    rating: 5,
    comment: "Dr. Wilson is fantastic. Pain-free dental experience for the first time!",
    date: "Nov 10, 2025",
  },
  {
    id: "review-5",
    providerId: "provider-5",
    bookingId: "past-5",
    reviewerName: "Amanda L.",
    rating: 5,
    comment: "My skin has never looked better. Lisa is a true professional.",
    date: "Nov 25, 2025",
  },
  {
    id: "review-6",
    providerId: "provider-6",
    bookingId: "past-6",
    reviewerName: "Chris T.",
    rating: 4,
    comment: "Great yoga class! Maya creates such a calming atmosphere.",
    date: "Nov 22, 2025",
  },
  {
    id: "review-7",
    providerId: "provider-4",
    bookingId: "past-7",
    reviewerName: "Jessica W.",
    rating: 5,
    comment: "Alex pushed me to my limits in the best way. Already seeing results!",
    date: "Nov 18, 2025",
  },
];

// Helper function to get provider by name
export function getProviderByName(name: string): Provider | undefined {
  return mockProviders.find((p) => p.name === name);
}

// Helper function to get reviews for a provider
export function getReviewsForProvider(providerId: string): Review[] {
  return mockReviews.filter((r) => r.providerId === providerId);
}

// Helper function to filter eligible providers (approved + listed)
// Note: In a real implementation, this would also check the provider's active/paused status
// from the shared backend. For mock data, we rely on verification fields present in the data.
export function getEligibleProviders(providers: Provider[]): Provider[] {
  return providers.filter((p) => {
    if (!p.verification) {
      return false;
    }
    return p.verification.verificationStatus === 'approved' && p.verification.listed;
  });
}
