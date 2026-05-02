/**
 * Admin Store - Single Source of Truth for Admin Data
 * 
 * Centralized mock data store with computed KPIs.
 * All admin pages read from and write to this store.
 * Includes localStorage persistence for demo purposes.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { subDays, isAfter, isBefore, startOfDay, endOfDay, parseISO, isValid } from 'date-fns';
import { 
  type PricingRules, 
  type PricingSuggestion, 
  type PricingMode,
  type UrgencyLevel,
  type TimePreference,
  type QuoteStatus,
  DEFAULT_PRICING_RULES,
} from '@/utils/pricingEngine';

export type { PricingRules, PricingSuggestion, PricingMode, UrgencyLevel, TimePreference, QuoteStatus };

export interface PaymentInput {
  method: 'cash' | 'mobile_money' | 'bank_transfer';
  reference?: string;
  note?: string;
}

export interface PayoutInput {
  method: 'mobile_money' | 'bank_transfer';
  reference?: string;
  note?: string;
}

export interface StatusHistoryEntry {
  status: string;
  timestamp: string;
  note?: string;
  actor?: string;
}

export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'refunded';
export type PayoutStatus = 'not_due' | 'due' | 'sent' | 'failed';
export type TransactionType = 'customer_payment' | 'refund' | 'provider_payout' | 'adjustment';
export type TransactionDirection = 'in' | 'out';
export type TransactionStatus = 'initiated' | 'settled' | 'failed';

export interface Transaction {
  id: string;
  bookingId: string;
  type: TransactionType;
  direction: TransactionDirection;
  amount: number;
  currency: string;
  status: TransactionStatus;
  provider: string;
  providerRef?: string;
  settledAt?: string;
  failureReason?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorType: 'admin' | 'system';
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: string;
}

export interface AdminBooking {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  providerName: string;
  providerCompany?: string;
  providerPhone?: string;
  providerId: string;
  serviceName: string;
  serviceCategory: string;
  date: string;
  time: string;
  duration: string;
  address?: string;
  status: 'pending' | 'under_review' | 'assigned' | 'confirmed' | 'completed' | 'cancelled';
  price: number;
  currency: string;
  baseAmount: number;
  platformFeeAmount: number;
  providerPayoutAmount: number;
  paymentStatus: PaymentStatus;
  payoutStatus: PayoutStatus;
  paidAt?: string;
  payoutDueAt?: string;
  payoutSentAt?: string;
  paymentMethod?: string;
  payoutMethod?: string;
  notes?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt?: string;
  cancellationReason?: string;
  cancelledBy?: 'client' | 'provider' | 'admin';
  statusHistory?: StatusHistoryEntry[];
  zone?: string;
  urgency?: UrgencyLevel;
  timePreference?: TimePreference;
  pricingSuggestion?: PricingSuggestion;
  quoteStatus?: QuoteStatus;
  quotedPrice?: number;
  quoteNote?: string;
  quoteExpiresAt?: string;
  quotedAt?: string;
  quotedBy?: string;
}

export type VerificationStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'suspended';

export interface AdminProvider {
  id: string;
  name: string;
  email: string;
  phone: string;
  services: string[];
  serviceArea: string;
  rating: number;
  reviewCount: number;
  status: 'active' | 'paused';
  joinedAt: string;
  totalBookings: number;
  completedBookings: number;
  revenue: number;
  // Verification fields
  verificationStatus: VerificationStatus;
  listed: boolean;
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  suspensionReason?: string;
  unlistReason?: string;
  // Mock checklist fields (pretend documents exist)
  hasIdProof: boolean;
  hasWorkPhoto: boolean;
  hasReference: boolean;
  idDocumentUrl?: string;
}

export interface AdminService {
  id: string;
  category: string;
  name: string;
  basePrice: number;
  durationMins: number;
  active: boolean;
  description?: string;
  pricingMode?: PricingMode;
  minPrice?: number;
  maxPrice?: number;
  pricingRules?: PricingRules;
}

export interface AdminReview {
  id: string;
  providerId: string;
  providerName: string;
  bookingId: string;
  clientName: string;
  rating: number;
  comment: string;
  status: 'published' | 'hidden' | 'flagged';
  createdAt: string;
  moderationReason?: string;
}

export type DateRangeOption = 'today' | '7d' | '30d';

interface AdminState {
  bookings: AdminBooking[];
  providers: AdminProvider[];
  services: AdminService[];
  reviews: AdminReview[];
  transactions: Transaction[];
  auditLog: AuditLogEntry[];
  dateRange: DateRangeOption;
  
  setDateRange: (range: DateRangeOption) => void;
  
  updateBookingStatus: (id: string, status: AdminBooking['status']) => void;
  updateBookingAdminNotes: (id: string, notes: string) => void;
  cancelBookingWithReason: (id: string, reason: string, cancelledBy: AdminBooking['cancelledBy']) => void;
  rescheduleBooking: (id: string, date: string, time: string) => void;
  assignProvider: (id: string, providerId: string, providerName: string) => void;
  markBookingCompleted: (id: string) => void;
  
  // Payment actions with full input
  recordPayment: (id: string, input: PaymentInput) => void;
  recordRefund: (id: string, reason?: string) => void;
  recordPayout: (id: string, input: PayoutInput) => void;
  markPayoutFailed: (id: string, reason: string) => void;
  
  // Reset to defaults (for testing)
  resetToDefaults: () => void;
  
  // Get transactions for a booking
  getBookingTransactions: (bookingId: string) => Transaction[];
  getBookingAuditLog: (bookingId: string) => AuditLogEntry[];
  
  updateProviderStatus: (id: string, status: AdminProvider['status']) => void;
  
  // Verification actions
  approveProvider: (id: string) => void;
  rejectProvider: (id: string, reason: string) => void;
  suspendProvider: (id: string, reason?: string) => void;
  toggleProviderListed: (id: string, reason?: string) => void;
  submitProviderApplication: (id: string) => void;
  
  // Get eligible providers (approved + listed + active)
  getEligibleProviders: () => AdminProvider[];
  
  addService: (service: Omit<AdminService, 'id'>) => void;
  updateService: (id: string, updates: Partial<AdminService>) => void;
  deleteService: (id: string) => void;
  toggleServiceActive: (id: string) => void;
  resetServicesToDefaults: () => void;
  
  updateReviewStatus: (id: string, status: AdminReview['status'], reason?: string) => void;
  
  sendQuote: (id: string, quotedPrice: number, quoteNote?: string, pricingSuggestion?: PricingSuggestion) => void;
  updateBookingPricingInputs: (id: string, zone?: string, urgency?: UrgencyLevel, timePreference?: TimePreference) => void;
  
  getFilteredBookings: () => AdminBooking[];
  getKPIs: () => {
    totalBookings: number;
    pendingBookings: number;
    confirmedBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    totalGMV: number;
    avgRating: number;
    activeProviders: number;
    eligibleProviders: number;
    totalProviders: number;
    totalReviews: number;
  };
}

const defaultServices: AdminService[] = [
  { id: 'svc-1', category: 'Home Cleaning', name: 'Standard Cleaning', basePrice: 15000, durationMins: 120, active: true, description: 'Basic home cleaning service', pricingMode: 'range', minPrice: 12000, maxPrice: 22000, pricingRules: DEFAULT_PRICING_RULES },
  { id: 'svc-2', category: 'Home Cleaning', name: 'Deep Cleaning', basePrice: 25000, durationMins: 240, active: true, description: 'Thorough deep cleaning', pricingMode: 'range', minPrice: 20000, maxPrice: 35000, pricingRules: DEFAULT_PRICING_RULES },
  { id: 'svc-3', category: 'Home Cleaning', name: 'Move-in/Move-out', basePrice: 35000, durationMins: 300, active: true, description: 'Complete cleaning for moves', pricingMode: 'quote_required', pricingRules: DEFAULT_PRICING_RULES },
  { id: 'svc-4', category: 'Plumbing', name: 'Drain Cleaning', basePrice: 10000, durationMins: 60, active: true, description: 'Clear clogged drains', pricingMode: 'instant', pricingRules: DEFAULT_PRICING_RULES },
  { id: 'svc-5', category: 'Plumbing', name: 'Leak Repair', basePrice: 18000, durationMins: 90, active: true, description: 'Fix water leaks', pricingMode: 'range', minPrice: 15000, maxPrice: 25000, pricingRules: DEFAULT_PRICING_RULES },
  { id: 'svc-6', category: 'Plumbing', name: 'Fixture Installation', basePrice: 22000, durationMins: 120, active: true, description: 'Install new fixtures', pricingMode: 'quote_required', pricingRules: DEFAULT_PRICING_RULES },
  { id: 'svc-7', category: 'Electrical', name: 'Outlet Installation', basePrice: 12000, durationMins: 60, active: true, description: 'Install new outlets', pricingMode: 'instant', pricingRules: DEFAULT_PRICING_RULES },
  { id: 'svc-8', category: 'Electrical', name: 'Lighting Setup', basePrice: 15000, durationMins: 90, active: true, description: 'Install lighting fixtures', pricingMode: 'range', minPrice: 12000, maxPrice: 20000, pricingRules: DEFAULT_PRICING_RULES },
  { id: 'svc-9', category: 'Electrical', name: 'Panel Upgrade', basePrice: 50000, durationMins: 240, active: true, description: 'Upgrade electrical panel', pricingMode: 'quote_required', pricingRules: DEFAULT_PRICING_RULES },
  { id: 'svc-10', category: 'Landscaping', name: 'Lawn Mowing', basePrice: 8000, durationMins: 60, active: true, description: 'Regular lawn maintenance', pricingMode: 'instant', pricingRules: DEFAULT_PRICING_RULES },
  { id: 'svc-11', category: 'Landscaping', name: 'Garden Design', basePrice: 40000, durationMins: 180, active: true, description: 'Custom garden planning', pricingMode: 'quote_required', pricingRules: DEFAULT_PRICING_RULES },
  { id: 'svc-12', category: 'HVAC', name: 'AC Maintenance', basePrice: 15000, durationMins: 90, active: true, description: 'Regular AC service', pricingMode: 'instant', pricingRules: DEFAULT_PRICING_RULES },
  { id: 'svc-13', category: 'HVAC', name: 'Furnace Repair', basePrice: 25000, durationMins: 120, active: true, description: 'Heating system repairs', pricingMode: 'range', minPrice: 20000, maxPrice: 35000, pricingRules: DEFAULT_PRICING_RULES },
  { id: 'svc-14', category: 'Painting', name: 'Interior Painting', basePrice: 45000, durationMins: 480, active: true, description: 'Room painting service', pricingMode: 'quote_required', pricingRules: DEFAULT_PRICING_RULES },
  { id: 'svc-15', category: 'Painting', name: 'Exterior Painting', basePrice: 65000, durationMins: 600, active: true, description: 'House exterior painting', pricingMode: 'quote_required', pricingRules: DEFAULT_PRICING_RULES },
];

const initialBookings: AdminBooking[] = [
  // Test case: Two bookings with SAME amount (200 FCFA) to prove no collision
  { id: 'bk-1', clientName: 'Sarah Johnson', clientEmail: 'sarah@email.com', clientPhone: '555-0101', providerName: 'CleanPro Services', providerCompany: 'CleanPro LLC', providerPhone: '555-1001', providerId: 'prov-1', serviceName: 'Deep Cleaning', serviceCategory: 'Home Cleaning', date: '2025-12-10', time: '9:00 AM', duration: '4 hours', address: '123 Oak Street, Apt 4B', status: 'confirmed', price: 200, currency: 'XOF', baseAmount: 200, platformFeeAmount: 30, providerPayoutAmount: 170, paymentStatus: 'unpaid', payoutStatus: 'not_due', createdAt: '2025-12-05', updatedAt: '2025-12-05' },
  // Same 200 FCFA amount - different booking
  { id: 'bk-13', clientName: 'Thomas Brown', clientEmail: 'thomas@email.com', clientPhone: '555-0113', providerName: 'Quick Fix Plumbing', providerCompany: 'QuickFix Inc', providerPhone: '555-1002', providerId: 'prov-2', serviceName: 'Leak Repair', serviceCategory: 'Plumbing', date: '2025-12-11', time: '3:00 PM', duration: '2 hours', address: '432 River Road', status: 'confirmed', price: 200, currency: 'XOF', baseAmount: 200, platformFeeAmount: 30, providerPayoutAmount: 170, paymentStatus: 'unpaid', payoutStatus: 'not_due', createdAt: '2025-12-05', updatedAt: '2025-12-05' },
  { id: 'bk-2', clientName: 'Michael Chen', clientEmail: 'mike@email.com', clientPhone: '555-0102', providerName: 'Quick Fix Plumbing', providerCompany: 'QuickFix Inc', providerPhone: '555-1002', providerId: 'prov-2', serviceName: 'Leak Repair', serviceCategory: 'Plumbing', date: '2025-12-08', time: '2:00 PM', duration: '1.5 hours', address: '456 Maple Ave', status: 'confirmed', price: 150, currency: 'XOF', baseAmount: 150, platformFeeAmount: 23, providerPayoutAmount: 127, paymentStatus: 'paid', payoutStatus: 'not_due', paidAt: '2025-12-04', paymentMethod: 'mobile_money', createdAt: '2025-12-04', updatedAt: '2025-12-05' },
  { id: 'bk-3', clientName: 'Emily Brown', clientEmail: 'emily@email.com', clientPhone: '555-0103', providerName: 'Spark Electric', providerCompany: 'Spark Electric Co', providerPhone: '555-1003', providerId: 'prov-3', serviceName: 'Outlet Installation', serviceCategory: 'Electrical', date: '2025-12-06', time: '10:00 AM', duration: '1 hour', address: '789 Pine Rd, Suite 100', status: 'completed', price: 95, currency: 'XOF', baseAmount: 95, platformFeeAmount: 14, providerPayoutAmount: 81, paymentStatus: 'paid', payoutStatus: 'due', paidAt: '2025-12-03', paymentMethod: 'bank_transfer', payoutDueAt: '2025-12-06', createdAt: '2025-12-03', updatedAt: '2025-12-06' },
  { id: 'bk-4', clientName: 'James Wilson', clientEmail: 'james@email.com', clientPhone: '555-0104', providerName: 'Green Thumb Gardens', providerCompany: 'Green Thumb LLC', providerPhone: '555-1004', providerId: 'prov-4', serviceName: 'Lawn Mowing', serviceCategory: 'Landscaping', date: '2025-12-05', time: '8:00 AM', duration: '1 hour', address: '321 Elm Street', status: 'completed', price: 50, currency: 'XOF', baseAmount: 50, platformFeeAmount: 8, providerPayoutAmount: 42, paymentStatus: 'paid', payoutStatus: 'sent', paidAt: '2025-12-02', paymentMethod: 'cash', payoutDueAt: '2025-12-05', payoutSentAt: '2025-12-05', payoutMethod: 'mobile_money', createdAt: '2025-12-02', updatedAt: '2025-12-05' },
  { id: 'bk-5', clientName: 'Lisa Anderson', clientEmail: 'lisa@email.com', clientPhone: '555-0105', providerName: 'CleanPro Services', providerCompany: 'CleanPro LLC', providerPhone: '555-1001', providerId: 'prov-1', serviceName: 'Standard Cleaning', serviceCategory: 'Home Cleaning', date: '2025-12-04', time: '1:00 PM', duration: '2 hours', address: '555 Cedar Lane', status: 'cancelled', price: 120, currency: 'XOF', baseAmount: 120, platformFeeAmount: 18, providerPayoutAmount: 102, paymentStatus: 'refunded', payoutStatus: 'not_due', createdAt: '2025-12-01', updatedAt: '2025-12-03', cancellationReason: 'Client requested cancellation due to schedule conflict', cancelledBy: 'client' },
  { id: 'bk-6', clientName: 'David Martinez', clientEmail: 'david@email.com', clientPhone: '555-0106', providerName: 'Cool Air HVAC', providerCompany: 'Cool Air Services', providerPhone: '555-1005', providerId: 'prov-5', serviceName: 'AC Maintenance', serviceCategory: 'HVAC', date: '2025-12-09', time: '11:00 AM', duration: '1.5 hours', address: '888 Birch Blvd', status: 'pending', price: 120, currency: 'XOF', baseAmount: 120, platformFeeAmount: 18, providerPayoutAmount: 102, paymentStatus: 'unpaid', payoutStatus: 'not_due', createdAt: '2025-12-05', updatedAt: '2025-12-05' },
  { id: 'bk-7', clientName: 'Amanda Lee', clientEmail: 'amanda@email.com', clientPhone: '555-0107', providerName: 'Quick Fix Plumbing', providerCompany: 'QuickFix Inc', providerPhone: '555-1002', providerId: 'prov-2', serviceName: 'Drain Cleaning', serviceCategory: 'Plumbing', date: '2025-12-07', time: '3:00 PM', duration: '1 hour', address: '222 Willow Way', status: 'confirmed', price: 85, currency: 'XOF', baseAmount: 85, platformFeeAmount: 13, providerPayoutAmount: 72, paymentStatus: 'paid', payoutStatus: 'not_due', paidAt: '2025-12-04', paymentMethod: 'mobile_money', createdAt: '2025-12-04', updatedAt: '2025-12-05' },
  { id: 'bk-8', clientName: 'Robert Taylor', clientEmail: 'robert@email.com', clientPhone: '555-0108', providerName: 'ProPaint Studio', providerCompany: 'ProPaint Inc', providerPhone: '555-1006', providerId: 'prov-6', serviceName: 'Interior Painting', serviceCategory: 'Painting', date: '2025-12-03', time: '9:00 AM', duration: '8 hours', address: '444 Spruce Court', status: 'completed', price: 350, currency: 'XOF', baseAmount: 350, platformFeeAmount: 53, providerPayoutAmount: 297, paymentStatus: 'paid', payoutStatus: 'due', paidAt: '2025-11-30', paymentMethod: 'bank_transfer', payoutDueAt: '2025-12-03', createdAt: '2025-11-30', updatedAt: '2025-12-03' },
  { id: 'bk-9', clientName: 'Jennifer White', clientEmail: 'jen@email.com', clientPhone: '555-0109', providerName: 'Spark Electric', providerCompany: 'Spark Electric Co', providerPhone: '555-1003', providerId: 'prov-3', serviceName: 'Lighting Setup', serviceCategory: 'Electrical', date: '2025-12-11', time: '10:00 AM', duration: '1.5 hours', address: '666 Aspen Drive', status: 'pending', price: 120, currency: 'XOF', baseAmount: 120, platformFeeAmount: 18, providerPayoutAmount: 102, paymentStatus: 'unpaid', payoutStatus: 'not_due', createdAt: '2025-12-05', updatedAt: '2025-12-05' },
  { id: 'bk-10', clientName: 'Christopher Harris', clientEmail: 'chris@email.com', clientPhone: '555-0110', providerName: 'Green Thumb Gardens', providerCompany: 'Green Thumb LLC', providerPhone: '555-1004', providerId: 'prov-4', serviceName: 'Garden Design', serviceCategory: 'Landscaping', date: '2025-12-02', time: '9:00 AM', duration: '3 hours', address: '777 Redwood Terrace', status: 'completed', price: 300, currency: 'XOF', baseAmount: 300, platformFeeAmount: 45, providerPayoutAmount: 255, paymentStatus: 'paid', payoutStatus: 'sent', paidAt: '2025-11-28', paymentMethod: 'mobile_money', payoutDueAt: '2025-12-02', payoutSentAt: '2025-12-02', payoutMethod: 'bank_transfer', createdAt: '2025-11-28', updatedAt: '2025-12-02' },
  { id: 'bk-11', clientName: 'Michelle Davis', clientEmail: 'michelle@email.com', clientPhone: '555-0111', providerName: 'CleanPro Services', providerCompany: 'CleanPro LLC', providerPhone: '555-1001', providerId: 'prov-1', serviceName: 'Move-in/Move-out', serviceCategory: 'Home Cleaning', date: '2025-12-12', time: '8:00 AM', duration: '5 hours', address: '999 Sequoia Place', status: 'pending', price: 250, currency: 'XOF', baseAmount: 250, platformFeeAmount: 38, providerPayoutAmount: 212, paymentStatus: 'unpaid', payoutStatus: 'not_due', createdAt: '2025-12-05', updatedAt: '2025-12-05' },
  // Same 200 FCFA as bk-1 - completed + paid, payout due
  { id: 'bk-12', clientName: 'Kevin Robinson', clientEmail: 'kevin@email.com', clientPhone: '555-0112', providerName: 'Cool Air HVAC', providerCompany: 'Cool Air Services', providerPhone: '555-1005', providerId: 'prov-5', serviceName: 'Furnace Repair', serviceCategory: 'HVAC', date: '2025-12-01', time: '2:00 PM', duration: '2 hours', address: '111 Cypress Lane', status: 'completed', price: 200, currency: 'XOF', baseAmount: 200, platformFeeAmount: 30, providerPayoutAmount: 170, paymentStatus: 'paid', payoutStatus: 'sent', paidAt: '2025-11-27', paymentMethod: 'cash', payoutDueAt: '2025-12-01', payoutSentAt: '2025-12-01', payoutMethod: 'mobile_money', createdAt: '2025-11-27', updatedAt: '2025-12-01' },
];

const initialProviders: AdminProvider[] = [
  // Approved and listed providers (eligible)
  { id: 'prov-1', name: 'CleanPro Services', email: 'contact@cleanpro.com', phone: '555-1001', services: ['Standard Cleaning', 'Deep Cleaning', 'Move-in/Move-out'], serviceArea: 'Downtown, Midtown', rating: 4.8, reviewCount: 127, status: 'active', joinedAt: '2024-03-15', totalBookings: 245, completedBookings: 230, revenue: 32500, verificationStatus: 'approved', listed: true, reviewedAt: '2024-03-16', hasIdProof: true, hasWorkPhoto: true, hasReference: true },
  { id: 'prov-2', name: 'Quick Fix Plumbing', email: 'info@quickfix.com', phone: '555-1002', services: ['Drain Cleaning', 'Leak Repair', 'Fixture Installation'], serviceArea: 'Citywide', rating: 4.6, reviewCount: 89, status: 'active', joinedAt: '2024-05-22', totalBookings: 156, completedBookings: 148, revenue: 24800, verificationStatus: 'approved', listed: true, reviewedAt: '2024-05-23', hasIdProof: true, hasWorkPhoto: true, hasReference: true },
  { id: 'prov-3', name: 'Spark Electric', email: 'spark@electric.com', phone: '555-1003', services: ['Outlet Installation', 'Lighting Setup', 'Panel Upgrade'], serviceArea: 'North Side, West End', rating: 4.9, reviewCount: 72, status: 'active', joinedAt: '2024-02-10', totalBookings: 134, completedBookings: 129, revenue: 28900, verificationStatus: 'approved', listed: true, reviewedAt: '2024-02-11', hasIdProof: true, hasWorkPhoto: true, hasReference: true },
  { id: 'prov-4', name: 'Green Thumb Gardens', email: 'hello@greenthumb.com', phone: '555-1004', services: ['Lawn Mowing', 'Garden Design'], serviceArea: 'Suburbs', rating: 4.7, reviewCount: 56, status: 'active', joinedAt: '2024-06-01', totalBookings: 98, completedBookings: 92, revenue: 12400, verificationStatus: 'approved', listed: true, reviewedAt: '2024-06-02', hasIdProof: true, hasWorkPhoto: true, hasReference: true },
  { id: 'prov-5', name: 'Cool Air HVAC', email: 'service@coolair.com', phone: '555-1005', services: ['AC Maintenance', 'Furnace Repair'], serviceArea: 'Metro Area', rating: 4.5, reviewCount: 45, status: 'active', joinedAt: '2024-04-18', totalBookings: 87, completedBookings: 81, revenue: 18200, verificationStatus: 'approved', listed: true, reviewedAt: '2024-04-19', hasIdProof: true, hasWorkPhoto: true, hasReference: true },
  // Approved but paused (not eligible due to status)
  { id: 'prov-6', name: 'ProPaint Studio', email: 'paint@propaint.com', phone: '555-1006', services: ['Interior Painting', 'Exterior Painting'], serviceArea: 'Downtown', rating: 4.4, reviewCount: 38, status: 'paused', joinedAt: '2024-07-10', totalBookings: 52, completedBookings: 45, revenue: 21500, verificationStatus: 'approved', listed: true, reviewedAt: '2024-07-11', hasIdProof: true, hasWorkPhoto: true, hasReference: true },
  // Submitted - awaiting approval
  { id: 'prov-7', name: 'Fresh Start Movers', email: 'team@freshstart.com', phone: '555-1007', services: ['Local Moving', 'Packing Services'], serviceArea: 'Metro Area', rating: 0, reviewCount: 0, status: 'active', joinedAt: '2024-12-01', totalBookings: 0, completedBookings: 0, revenue: 0, verificationStatus: 'submitted', listed: false, submittedAt: '2024-12-02', hasIdProof: true, hasWorkPhoto: true, hasReference: true },
  { id: 'prov-8', name: 'Tidy Home Organizers', email: 'hello@tidyhome.com', phone: '555-1008', services: ['Home Organization', 'Decluttering'], serviceArea: 'Downtown', rating: 0, reviewCount: 0, status: 'active', joinedAt: '2024-12-03', totalBookings: 0, completedBookings: 0, revenue: 0, verificationStatus: 'submitted', listed: false, submittedAt: '2024-12-04', hasIdProof: true, hasWorkPhoto: false, hasReference: true },
  // Draft - not yet submitted
  { id: 'prov-9', name: 'HandyMan Pro', email: 'contact@handymanpro.com', phone: '555-1009', services: ['General Repairs'], serviceArea: 'Suburbs', rating: 0, reviewCount: 0, status: 'active', joinedAt: '2024-12-05', totalBookings: 0, completedBookings: 0, revenue: 0, verificationStatus: 'draft', listed: false, hasIdProof: true, hasWorkPhoto: false, hasReference: false },
  // Rejected
  { id: 'prov-10', name: 'Budget Cleaners', email: 'info@budgetclean.com', phone: '555-1010', services: ['Basic Cleaning'], serviceArea: 'Citywide', rating: 0, reviewCount: 0, status: 'active', joinedAt: '2024-11-15', totalBookings: 0, completedBookings: 0, revenue: 0, verificationStatus: 'rejected', listed: false, submittedAt: '2024-11-16', reviewedAt: '2024-11-17', rejectionReason: 'incomplete_documents', hasIdProof: false, hasWorkPhoto: true, hasReference: false },
  // Suspended
  { id: 'prov-11', name: 'QuickFix Solutions', email: 'help@quickfixsol.com', phone: '555-1011', services: ['Appliance Repair'], serviceArea: 'Metro Area', rating: 3.2, reviewCount: 15, status: 'paused', joinedAt: '2024-08-01', totalBookings: 28, completedBookings: 20, revenue: 4500, verificationStatus: 'suspended', listed: false, reviewedAt: '2024-11-20', hasIdProof: true, hasWorkPhoto: true, hasReference: true },
];

const initialReviews: AdminReview[] = [
  { id: 'rev-1', providerId: 'prov-1', providerName: 'CleanPro Services', bookingId: 'bk-3', clientName: 'Emily Brown', rating: 5, comment: 'Excellent service! The team was professional and thorough. My home has never been cleaner.', status: 'published', createdAt: '2025-12-04' },
  { id: 'rev-2', providerId: 'prov-2', providerName: 'Quick Fix Plumbing', bookingId: 'bk-7', clientName: 'Amanda Lee', rating: 4, comment: 'Good work fixing the drain. Arrived on time and explained everything clearly.', status: 'published', createdAt: '2025-12-03' },
  { id: 'rev-3', providerId: 'prov-3', providerName: 'Spark Electric', bookingId: 'bk-3', clientName: 'Emily Brown', rating: 5, comment: 'Outstanding electrical work. Very knowledgeable and safety-conscious.', status: 'published', createdAt: '2025-12-02' },
  { id: 'rev-4', providerId: 'prov-4', providerName: 'Green Thumb Gardens', bookingId: 'bk-4', clientName: 'James Wilson', rating: 4, comment: 'Great lawn service. Will definitely use again next month.', status: 'published', createdAt: '2025-12-01' },
  { id: 'rev-5', providerId: 'prov-6', providerName: 'ProPaint Studio', bookingId: 'bk-8', clientName: 'Robert Taylor', rating: 3, comment: 'The painting was okay but they left some spots. Had to call them back.', status: 'published', createdAt: '2025-11-30' },
  { id: 'rev-6', providerId: 'prov-1', providerName: 'CleanPro Services', bookingId: 'bk-10', clientName: 'Christopher Harris', rating: 2, comment: 'This service was terrible. Never booking again!', status: 'flagged', createdAt: '2025-11-29', moderationReason: 'Potentially fake review - no matching booking found' },
  { id: 'rev-7', providerId: 'prov-5', providerName: 'Cool Air HVAC', bookingId: 'bk-12', clientName: 'Kevin Robinson', rating: 5, comment: 'Fixed my furnace quickly before the cold snap. Lifesaver!', status: 'published', createdAt: '2025-11-28' },
  { id: 'rev-8', providerId: 'prov-2', providerName: 'Quick Fix Plumbing', bookingId: 'bk-2', clientName: 'Michael Chen', rating: 1, comment: 'SPAM SPAM BUY NOW cheap products visit this link...', status: 'hidden', createdAt: '2025-11-27', moderationReason: 'Spam content' },
];

function parseDate(dateStr: string): Date {
  const date = parseISO(dateStr);
  return isValid(date) ? date : new Date();
}

const PLATFORM_FEE_RATE = 0.15;

function computeFees(price: number): { baseAmount: number; platformFeeAmount: number; providerPayoutAmount: number } {
  const baseAmount = price;
  const platformFeeAmount = Math.round(price * PLATFORM_FEE_RATE);
  const providerPayoutAmount = baseAmount - platformFeeAmount;
  return { baseAmount, platformFeeAmount, providerPayoutAmount };
}

const initialTransactions: Transaction[] = [
  { id: 'tx-1', bookingId: 'bk-3', type: 'customer_payment', direction: 'in', amount: 95, currency: 'XOF', status: 'settled', provider: 'manual', settledAt: '2025-12-03', createdAt: '2025-12-03' },
  { id: 'tx-2', bookingId: 'bk-4', type: 'customer_payment', direction: 'in', amount: 50, currency: 'XOF', status: 'settled', provider: 'manual', settledAt: '2025-12-02', createdAt: '2025-12-02' },
  { id: 'tx-3', bookingId: 'bk-4', type: 'provider_payout', direction: 'out', amount: 42, currency: 'XOF', status: 'settled', provider: 'manual', settledAt: '2025-12-05', createdAt: '2025-12-05' },
  { id: 'tx-4', bookingId: 'bk-10', type: 'customer_payment', direction: 'in', amount: 300, currency: 'XOF', status: 'settled', provider: 'manual', settledAt: '2025-11-28', createdAt: '2025-11-28' },
  { id: 'tx-5', bookingId: 'bk-10', type: 'provider_payout', direction: 'out', amount: 255, currency: 'XOF', status: 'settled', provider: 'manual', settledAt: '2025-12-02', createdAt: '2025-12-02' },
  { id: 'tx-6', bookingId: 'bk-12', type: 'customer_payment', direction: 'in', amount: 200, currency: 'XOF', status: 'settled', provider: 'manual', settledAt: '2025-11-27', createdAt: '2025-11-27' },
  { id: 'tx-7', bookingId: 'bk-12', type: 'provider_payout', direction: 'out', amount: 170, currency: 'XOF', status: 'settled', provider: 'manual', settledAt: '2025-12-01', createdAt: '2025-12-01' },
  { id: 'tx-8', bookingId: 'bk-5', type: 'customer_payment', direction: 'in', amount: 120, currency: 'XOF', status: 'settled', provider: 'manual', settledAt: '2025-12-01', createdAt: '2025-12-01' },
  { id: 'tx-9', bookingId: 'bk-5', type: 'refund', direction: 'out', amount: 120, currency: 'XOF', status: 'settled', provider: 'manual', settledAt: '2025-12-03', createdAt: '2025-12-03' },
];

const initialAuditLog: AuditLogEntry[] = [
  { id: 'audit-1', actorType: 'admin', actorId: 'admin-1', action: 'mark_paid', entityType: 'booking', entityId: 'bk-3', after: { paymentStatus: 'paid' }, createdAt: '2025-12-03T10:00:00Z' },
  { id: 'audit-2', actorType: 'admin', actorId: 'admin-1', action: 'mark_completed', entityType: 'booking', entityId: 'bk-3', after: { status: 'completed' }, createdAt: '2025-12-06T14:00:00Z' },
  { id: 'audit-3', actorType: 'admin', actorId: 'admin-1', action: 'cancel_booking', entityType: 'booking', entityId: 'bk-5', after: { status: 'cancelled', cancellationReason: 'Client requested cancellation' }, createdAt: '2025-12-03T09:00:00Z' },
];

export const useAdminStore = create<AdminState>()(
  persist(
    (set, get) => ({
  bookings: initialBookings,
  providers: initialProviders,
  services: [...defaultServices],
  reviews: initialReviews,
  transactions: initialTransactions,
  auditLog: initialAuditLog,
  dateRange: '7d',

  setDateRange: (range) => set({ dateRange: range }),

  updateBookingStatus: (id, status) => set((state) => {
    const now = new Date().toISOString();
    return {
      bookings: state.bookings.map((b) =>
        b.id === id 
          ? { 
              ...b, 
              status,
              updatedAt: now.split('T')[0],
              statusHistory: [
                ...(b.statusHistory || []),
                { status, timestamp: now, actor: 'admin' }
              ],
            } 
          : b
      ),
    };
  }),

  updateBookingAdminNotes: (id, notes) => set((state) => ({
    bookings: state.bookings.map((b) =>
      b.id === id ? { ...b, adminNotes: notes, updatedAt: new Date().toISOString().split('T')[0] } : b
    ),
  })),

  cancelBookingWithReason: (id, reason, cancelledBy) => set((state) => {
    const now = new Date().toISOString();
    return {
      bookings: state.bookings.map((b) =>
        b.id === id 
          ? { 
              ...b, 
              status: 'cancelled' as const, 
              cancellationReason: reason, 
              cancelledBy,
              paymentStatus: 'refunded' as const,
              updatedAt: now.split('T')[0],
              statusHistory: [
                ...(b.statusHistory || []),
                { status: 'cancelled', timestamp: now, note: reason, actor: cancelledBy }
              ],
            } 
          : b
      ),
    };
  }),

  rescheduleBooking: (id, date, time) => set((state) => {
    const now = new Date().toISOString();
    return {
      bookings: state.bookings.map((b) =>
        b.id === id 
          ? { 
              ...b, 
              date, 
              time,
              updatedAt: now.split('T')[0],
              statusHistory: [
                ...(b.statusHistory || []),
                { status: 'rescheduled', timestamp: now, note: `Rescheduled to ${date} ${time}`, actor: 'admin' }
              ],
            } 
          : b
      ),
    };
  }),

  assignProvider: (id, providerId, providerName) => set((state) => {
    const now = new Date().toISOString();
    return {
      bookings: state.bookings.map((b) =>
        b.id === id 
          ? { 
              ...b, 
              providerId, 
              providerName,
              updatedAt: now.split('T')[0],
              statusHistory: [
                ...(b.statusHistory || []),
                { status: 'provider_assigned', timestamp: now, note: `Assigned to ${providerName}`, actor: 'admin' }
              ],
            } 
          : b
      ),
    };
  }),

  markBookingCompleted: (id) => set((state) => {
    const now = new Date().toISOString();
    const booking = state.bookings.find(b => b.id === id);
    if (!booking || booking.status !== 'confirmed') return state;
    
    const isPaid = booking.paymentStatus === 'paid';
    const canTransitionToDue = booking.payoutStatus !== 'sent';
    const newPayoutStatus = isPaid && canTransitionToDue 
      ? 'due' as const 
      : (booking.payoutStatus === 'sent' ? 'sent' as const : 'not_due' as const);
    
    return {
      bookings: state.bookings.map((b) =>
        b.id === id 
          ? { 
              ...b, 
              status: 'completed' as const,
              payoutStatus: newPayoutStatus,
              payoutDueAt: (isPaid && canTransitionToDue) ? now.split('T')[0] : b.payoutDueAt,
              updatedAt: now.split('T')[0],
              statusHistory: [
                ...(b.statusHistory || []),
                { status: 'completed', timestamp: now, actor: 'admin' }
              ],
            } 
          : b
      ),
      auditLog: [
        ...state.auditLog,
        {
          id: `audit-${Date.now()}`,
          actorType: 'admin' as const,
          actorId: 'admin-1',
          action: 'mark_completed',
          entityType: 'booking',
          entityId: id,
          before: { status: booking.status },
          after: { status: 'completed', payoutStatus: newPayoutStatus },
          createdAt: now,
        },
      ],
    };
  }),

  recordPayment: (id, input) => set((state) => {
    const now = new Date().toISOString();
    const booking = state.bookings.find(b => b.id === id);
    if (!booking) return state;
    if (booking.status !== 'confirmed' && booking.status !== 'completed') return state;
    if (booking.paymentStatus !== 'unpaid') return state;
    
    const isCompleted = booking.status === 'completed';
    const shouldSetPayoutDue = isCompleted && 
      (booking.payoutStatus === 'not_due' || booking.payoutStatus === 'failed');
    
    return {
      bookings: state.bookings.map((b) =>
        b.id === id 
          ? { 
              ...b, 
              paymentStatus: 'paid' as const,
              paidAt: now.split('T')[0],
              paymentMethod: input.method,
              payoutStatus: shouldSetPayoutDue ? 'due' as const : b.payoutStatus,
              payoutDueAt: shouldSetPayoutDue ? now.split('T')[0] : b.payoutDueAt,
              updatedAt: now.split('T')[0],
              statusHistory: [
                ...(b.statusHistory || []),
                { 
                  status: 'payment_received', 
                  timestamp: now, 
                  note: input.note || `Payment via ${input.method}${input.reference ? ` (Ref: ${input.reference})` : ''}`,
                  actor: 'admin' 
                }
              ],
            } 
          : b
      ),
      transactions: [
        ...state.transactions,
        {
          id: `tx-${Date.now()}`,
          bookingId: id,
          type: 'customer_payment' as const,
          direction: 'in' as const,
          amount: booking.baseAmount,
          currency: booking.currency,
          status: 'settled' as const,
          provider: input.method,
          providerRef: input.reference,
          settledAt: now.split('T')[0],
          meta: input.note ? { note: input.note } : undefined,
          createdAt: now.split('T')[0],
        },
      ],
      auditLog: [
        ...state.auditLog,
        {
          id: `audit-${Date.now()}`,
          actorType: 'admin' as const,
          actorId: 'admin-1',
          action: 'record_payment',
          entityType: 'booking',
          entityId: id,
          before: { paymentStatus: booking.paymentStatus },
          after: { paymentStatus: 'paid', method: input.method, reference: input.reference },
          createdAt: now,
        },
      ],
    };
  }),

  recordRefund: (id, reason) => set((state) => {
    const now = new Date().toISOString();
    const booking = state.bookings.find(b => b.id === id);
    if (!booking || booking.paymentStatus !== 'paid') return state;
    
    return {
      bookings: state.bookings.map((b) =>
        b.id === id 
          ? { 
              ...b, 
              paymentStatus: 'refunded' as const,
              updatedAt: now.split('T')[0],
              statusHistory: [
                ...(b.statusHistory || []),
                { status: 'refunded', timestamp: now, note: reason, actor: 'admin' }
              ],
            } 
          : b
      ),
      transactions: [
        ...state.transactions,
        {
          id: `tx-${Date.now()}`,
          bookingId: id,
          type: 'refund' as const,
          direction: 'out' as const,
          amount: booking.price,
          currency: booking.currency,
          status: 'settled' as const,
          provider: 'manual',
          settledAt: now.split('T')[0],
          meta: reason ? { reason } : undefined,
          createdAt: now.split('T')[0],
        },
      ],
      auditLog: [
        ...state.auditLog,
        {
          id: `audit-${Date.now()}`,
          actorType: 'admin' as const,
          actorId: 'admin-1',
          action: 'record_refund',
          entityType: 'booking',
          entityId: id,
          before: { paymentStatus: 'paid' },
          after: { paymentStatus: 'refunded' },
          createdAt: now,
        },
      ],
    };
  }),

  recordPayout: (id, input) => set((state) => {
    const now = new Date().toISOString();
    const booking = state.bookings.find(b => b.id === id);
    // Only allow payout for completed bookings that are paid with payout due
    if (!booking) return state;
    if (booking.status !== 'completed') return state;
    if (booking.paymentStatus !== 'paid') return state;
    if (booking.payoutStatus !== 'due') return state;
    
    return {
      bookings: state.bookings.map((b) =>
        b.id === id 
          ? { 
              ...b, 
              payoutStatus: 'sent' as const,
              payoutSentAt: now.split('T')[0],
              payoutMethod: input.method,
              updatedAt: now.split('T')[0],
              statusHistory: [
                ...(b.statusHistory || []),
                { 
                  status: 'payout_sent', 
                  timestamp: now, 
                  note: input.note || `Payout via ${input.method}${input.reference ? ` (Ref: ${input.reference})` : ''}`,
                  actor: 'admin' 
                }
              ],
            } 
          : b
      ),
      transactions: [
        ...state.transactions,
        {
          id: `tx-${Date.now()}`,
          bookingId: id,
          type: 'provider_payout' as const,
          direction: 'out' as const,
          amount: booking.providerPayoutAmount,
          currency: booking.currency,
          status: 'settled' as const,
          provider: input.method,
          providerRef: input.reference,
          settledAt: now.split('T')[0],
          meta: input.note ? { note: input.note } : undefined,
          createdAt: now.split('T')[0],
        },
      ],
      auditLog: [
        ...state.auditLog,
        {
          id: `audit-${Date.now()}`,
          actorType: 'admin' as const,
          actorId: 'admin-1',
          action: 'record_payout',
          entityType: 'booking',
          entityId: id,
          before: { payoutStatus: 'due' },
          after: { payoutStatus: 'sent', method: input.method, reference: input.reference },
          createdAt: now,
        },
      ],
    };
  }),

  markPayoutFailed: (id, reason) => set((state) => {
    const now = new Date().toISOString();
    const booking = state.bookings.find(b => b.id === id);
    if (!booking || booking.payoutStatus !== 'due') return state;
    
    return {
      bookings: state.bookings.map((b) =>
        b.id === id 
          ? { 
              ...b, 
              payoutStatus: 'failed' as const,
              updatedAt: now.split('T')[0],
              statusHistory: [
                ...(b.statusHistory || []),
                { status: 'payout_failed', timestamp: now, note: reason, actor: 'admin' }
              ],
            } 
          : b
      ),
      transactions: [
        ...state.transactions,
        {
          id: `tx-${Date.now()}`,
          bookingId: id,
          type: 'provider_payout' as const,
          direction: 'out' as const,
          amount: booking.providerPayoutAmount,
          currency: booking.currency,
          status: 'failed' as const,
          provider: 'manual',
          failureReason: reason,
          createdAt: now.split('T')[0],
        },
      ],
      auditLog: [
        ...state.auditLog,
        {
          id: `audit-${Date.now()}`,
          actorType: 'admin' as const,
          actorId: 'admin-1',
          action: 'mark_payout_failed',
          entityType: 'booking',
          entityId: id,
          before: { payoutStatus: 'due' },
          after: { payoutStatus: 'failed', failureReason: reason },
          createdAt: now,
        },
      ],
    };
  }),

  getBookingTransactions: (bookingId) => {
    const { transactions } = get();
    return transactions.filter(t => t.bookingId === bookingId);
  },

  getBookingAuditLog: (bookingId) => {
    const { auditLog } = get();
    return auditLog.filter(a => a.entityType === 'booking' && a.entityId === bookingId);
  },

  updateProviderStatus: (id, status) => set((state) => ({
    providers: state.providers.map((p) =>
      p.id === id ? { ...p, status } : p
    ),
  })),

  // Verification actions
  approveProvider: (id) => set((state) => ({
    providers: state.providers.map((p) =>
      p.id === id
        ? {
            ...p,
            verificationStatus: 'approved' as VerificationStatus,
            listed: true,
            reviewedAt: new Date().toISOString().split('T')[0],
            rejectionReason: undefined,
          }
        : p
    ),
  })),

  rejectProvider: (id, reason) => set((state) => ({
    providers: state.providers.map((p) =>
      p.id === id
        ? {
            ...p,
            verificationStatus: 'rejected' as VerificationStatus,
            listed: false,
            reviewedAt: new Date().toISOString().split('T')[0],
            rejectionReason: reason,
          }
        : p
    ),
  })),

  suspendProvider: (id, reason) => set((state) => ({
    providers: state.providers.map((p) =>
      p.id === id
        ? {
            ...p,
            verificationStatus: 'suspended' as VerificationStatus,
            listed: false,
            reviewedAt: new Date().toISOString().split('T')[0],
            suspensionReason: reason,
          }
        : p
    ),
  })),

  toggleProviderListed: (id, reason) => set((state) => ({
    providers: state.providers.map((p) =>
      p.id === id ? { ...p, listed: !p.listed, unlistReason: reason } : p
    ),
  })),

  submitProviderApplication: (id) => set((state) => ({
    providers: state.providers.map((p) =>
      p.id === id
        ? {
            ...p,
            verificationStatus: 'submitted' as VerificationStatus,
            submittedAt: new Date().toISOString().split('T')[0],
          }
        : p
    ),
  })),

  getEligibleProviders: () => {
    const { providers } = get();
    return providers.filter(
      (p) => p.verificationStatus === 'approved' && p.listed && p.status === 'active'
    );
  },

  addService: (service) => set((state) => ({
    services: [
      ...state.services,
      { ...service, id: `svc-${Date.now()}` },
    ],
  })),

  updateService: (id, updates) => set((state) => ({
    services: state.services.map((s) =>
      s.id === id ? { ...s, ...updates } : s
    ),
  })),

  deleteService: (id) => set((state) => ({
    services: state.services.filter((s) => s.id !== id),
  })),

  toggleServiceActive: (id) => set((state) => ({
    services: state.services.map((s) =>
      s.id === id ? { ...s, active: !s.active } : s
    ),
  })),

  resetServicesToDefaults: () => set({ services: [...defaultServices] }),

  resetToDefaults: () => set({
    bookings: initialBookings,
    providers: initialProviders,
    services: [...defaultServices],
    reviews: initialReviews,
    transactions: initialTransactions,
    auditLog: initialAuditLog,
  }),

  updateReviewStatus: (id, status, reason) => set((state) => ({
    reviews: state.reviews.map((r) =>
      r.id === id ? { ...r, status, moderationReason: reason || r.moderationReason } : r
    ),
  })),

  sendQuote: (id, quotedPrice, quoteNote, pricingSuggestion) => set((state) => {
    const now = new Date().toISOString();
    return {
      bookings: state.bookings.map((b) =>
        b.id === id 
          ? { 
              ...b, 
              quotedPrice,
              quoteNote,
              quoteStatus: 'sent' as QuoteStatus,
              quotedAt: now,
              quotedBy: 'admin',
              pricingSuggestion,
              updatedAt: now.split('T')[0],
              statusHistory: [
                ...(b.statusHistory || []),
                { status: 'quote_sent', timestamp: now, note: `Quote sent: ${quotedPrice} CFA`, actor: 'admin' }
              ],
            } 
          : b
      ),
    };
  }),

  updateBookingPricingInputs: (id, zone, urgency, timePreference) => set((state) => ({
    bookings: state.bookings.map((b) =>
      b.id === id 
        ? { 
            ...b, 
            zone: zone ?? b.zone,
            urgency: urgency ?? b.urgency,
            timePreference: timePreference ?? b.timePreference,
            updatedAt: new Date().toISOString().split('T')[0],
          } 
        : b
    ),
  })),

  getFilteredBookings: () => {
    const { bookings, dateRange } = get();
    const now = new Date();
    let startDate: Date;

    switch (dateRange) {
      case 'today':
        startDate = startOfDay(now);
        break;
      case '7d':
        startDate = subDays(now, 7);
        break;
      case '30d':
        startDate = subDays(now, 30);
        break;
      default:
        startDate = subDays(now, 7);
    }

    return bookings.filter((b) => {
      const bookingDate = parseDate(b.createdAt);
      return isAfter(bookingDate, startDate) || bookingDate.getTime() === startDate.getTime();
    });
  },

  getKPIs: () => {
    const filteredBookings = get().getFilteredBookings();
    const eligibleProvidersList = get().getEligibleProviders();
    const { providers, reviews } = get();

    const totalBookings = filteredBookings.length;
    const pendingBookings = filteredBookings.filter((b) => b.status === 'pending').length;
    const confirmedBookings = filteredBookings.filter((b) => b.status === 'confirmed').length;
    const completedBookings = filteredBookings.filter((b) => b.status === 'completed').length;
    const cancelledBookings = filteredBookings.filter((b) => b.status === 'cancelled').length;
    const totalGMV = filteredBookings
      .filter((b) => b.status === 'completed')
      .reduce((sum, b) => sum + b.price, 0);

    const publishedReviews = reviews.filter((r) => r.status === 'published');
    const avgRating = publishedReviews.length > 0
      ? publishedReviews.reduce((sum, r) => sum + r.rating, 0) / publishedReviews.length
      : 0;

    const activeProviders = providers.filter((p) => p.status === 'active').length;
    const eligibleProviders = eligibleProvidersList.length;
    const totalProviders = providers.length;
    const totalReviews = reviews.length;

    return {
      totalBookings,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      cancelledBookings,
      totalGMV,
      avgRating,
      activeProviders,
      eligibleProviders,
      totalProviders,
      totalReviews,
    };
  },
    }),
    {
      name: 'shizu-admin-store',
      partialize: (state) => ({
        bookings: state.bookings,
        providers: state.providers,
        services: state.services,
        reviews: state.reviews,
        transactions: state.transactions,
        auditLog: state.auditLog,
      }),
    }
  )
);
