/**
 * Schedule Conflict Detection Utilities
 *
 * Detects time conflicts between bookings to warn providers
 * before accepting or rescheduling appointments.
 */

import type { ProviderBooking } from "@/data/mockProviderBookings";

export interface TimeSlot {
  date: string;
  time: string;
  duration: string;
}

export interface ConflictInfo {
  hasConflict: boolean;
  conflictingBookings: ProviderBooking[];
}

/**
 * Parse time string (e.g., "2:00 PM") to minutes from midnight
 */
function parseTimeToMinutes(timeStr: string): number {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

/**
 * Parse duration string (e.g., "60 min", "90 min") to minutes
 */
function parseDurationToMinutes(durationStr: string): number {
  const match = durationStr.match(/(\d+)\s*min/i);
  return match ? parseInt(match[1], 10) : 60;
}

/**
 * Check if two time slots overlap
 */
function timeSlotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
  if (slot1.date !== slot2.date) return false;

  const start1 = parseTimeToMinutes(slot1.time);
  const end1 = start1 + parseDurationToMinutes(slot1.duration);

  const start2 = parseTimeToMinutes(slot2.time);
  const end2 = start2 + parseDurationToMinutes(slot2.duration);

  return start1 < end2 && start2 < end1;
}

/**
 * Check if a proposed booking would conflict with any confirmed bookings
 */
export function checkScheduleConflicts(
  proposedSlot: TimeSlot,
  confirmedBookings: ProviderBooking[],
  excludeBookingId?: string
): ConflictInfo {
  const conflictingBookings = confirmedBookings.filter((booking) => {
    if (excludeBookingId && booking.id === excludeBookingId) return false;
    if (booking.status !== "confirmed") return false;

    return timeSlotsOverlap(proposedSlot, {
      date: booking.date,
      time: booking.time,
      duration: booking.duration,
    });
  });

  return {
    hasConflict: conflictingBookings.length > 0,
    conflictingBookings,
  };
}

/**
 * Format a conflict warning message
 */
export function formatConflictWarning(conflicts: ProviderBooking[]): string {
  if (conflicts.length === 0) return "";

  if (conflicts.length === 1) {
    const c = conflicts[0];
    return `Conflicts with ${c.customerName}'s ${c.serviceName} at ${c.time}`;
  }

  return `Conflicts with ${conflicts.length} existing appointments`;
}
