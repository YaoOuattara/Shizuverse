/**
 * Achievement Thresholds and Constants
 *
 * Centralized configuration for provider achievement badges.
 * All badge logic references these thresholds for consistency.
 */

export const ACHIEVEMENT_THRESHOLDS = {
  FIRST_BOOKING: {
    completedCount: 1,
  },
  RELIABLE: {
    completedCount: 5,
    maxCancellationRate: 10, // percentage
  },
  TOP_RATED: {
    minRating: 4.7,
    minReviewCount: 5,
  },
  COMPLETION_STREAK: {
    minCompletionRate: 95, // percentage
    minBookingsWithOutcome: 5, // minimum bookings to evaluate
  },
  LOYALTY_CHAMPION: {
    repeatCustomerCount: 10,
  },
} as const;

export type AchievementId =
  | "first_booking"
  | "reliable"
  | "top_rated"
  | "completion_streak"
  | "loyalty";
