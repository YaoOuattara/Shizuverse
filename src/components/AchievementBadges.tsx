"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Shield,
  Star,
  Flame,
  Heart,
  Sparkles,
  Lock,
  Trophy,
  CheckCircle,
  Clock,
} from "lucide-react";
import type { ProviderBooking } from "@/data/mockProviderBookings";
import { ACHIEVEMENT_THRESHOLDS } from "@/lib/achievementThresholds";

interface AchievementBadgesProps {
  bookings: ProviderBooking[];
  providerRating?: number;
  reviewCount?: number;
  className?: string;
}

export interface AchievementBadge {
  id: string;
  name: string;
  description: string;
  requirement: string;
  icon: string;
  unlocked: boolean;
  comingSoon?: boolean;
  notEnoughHistory?: boolean;
  helperText?: string;
  progress?: {
    current: number;
    target: number;
    suffix?: string;
    displayFormat?: "fraction" | "goal";
  };
}

const iconMap: Record<string, typeof Shield> = {
  Shield,
  Star,
  Flame,
  Heart,
  Sparkles,
  Clock,
};

export function AchievementBadges({
  bookings,
  providerRating,
  reviewCount = 0,
  className,
}: AchievementBadgesProps) {
  const isFr = true; // provider dashboard is always fr

  const computedBadges = useMemo(() => {
    const completedBookings = bookings.filter((b) => b.status === "completed");
    const confirmedOrCompleted = bookings.filter(
      (b) => b.status === "completed" || b.status === "confirmed"
    );
    const cancelledBookings = bookings.filter((b) => b.status === "cancelled");

    const customerCounts = new Map<string, number>();
    completedBookings.forEach((b) => {
      const count = customerCounts.get(b.customerId) || 0;
      customerCounts.set(b.customerId, count + 1);
    });
    const repeatCustomers = Array.from(customerCounts.values()).filter((c) => c >= 2).length;

    const totalWithOutcome = confirmedOrCompleted.length + cancelledBookings.length;
    const completionRate = totalWithOutcome > 0
      ? Math.round((confirmedOrCompleted.length / totalWithOutcome) * 100)
      : 0;
    const cancellationRate = totalWithOutcome > 0
      ? Math.round((cancelledBookings.length / totalWithOutcome) * 100)
      : 0;

    const completedCount = completedBookings.length;
    const { FIRST_BOOKING, RELIABLE, TOP_RATED, COMPLETION_STREAK, LOYALTY_CHAMPION } = ACHIEVEMENT_THRESHOLDS;

    const badges: AchievementBadge[] = [
      {
        id: "first_booking",
        name: "Premiers pas",
        description: "Complétez votre première mission",
        requirement: `${FIRST_BOOKING.completedCount} mission(s)`,
        icon: "Sparkles",
        unlocked: completedCount >= FIRST_BOOKING.completedCount,
        progress: { current: Math.min(completedCount, FIRST_BOOKING.completedCount), target: FIRST_BOOKING.completedCount },
      },
      {
        id: "reliable",
        name: "Fiable",
        description: "Prouvez votre fiabilité",
        requirement: `${RELIABLE.completedCount} missions`,
        icon: "Shield",
        unlocked: completedCount >= RELIABLE.completedCount && cancellationRate < RELIABLE.maxCancellationRate,
        progress: { current: completedCount, target: RELIABLE.completedCount },
      },
      {
        id: "top_rated",
        name: "Top noté",
        description: "Obtenez d'excellentes évaluations",
        requirement: `Note ≥ ${TOP_RATED.minRating} · ${TOP_RATED.minReviewCount} avis`,
        icon: "Star",
        unlocked: providerRating !== undefined && providerRating >= TOP_RATED.minRating && reviewCount >= TOP_RATED.minReviewCount,
        comingSoon: providerRating === undefined,
        progress: providerRating !== undefined ? { current: reviewCount, target: TOP_RATED.minReviewCount } : undefined,
      },
      {
        id: "completion_streak",
        name: "Assidu",
        description: "Maintenez un taux de complétion élevé",
        requirement: `${COMPLETION_STREAK.minCompletionRate}% complétion`,
        icon: "Flame",
        unlocked: completionRate >= COMPLETION_STREAK.minCompletionRate && totalWithOutcome >= COMPLETION_STREAK.minBookingsWithOutcome,
        notEnoughHistory: totalWithOutcome < COMPLETION_STREAK.minBookingsWithOutcome,
        progress: totalWithOutcome >= COMPLETION_STREAK.minBookingsWithOutcome
          ? { current: completionRate, target: COMPLETION_STREAK.minCompletionRate, suffix: "%", displayFormat: "goal" }
          : { current: totalWithOutcome, target: COMPLETION_STREAK.minBookingsWithOutcome, displayFormat: "fraction" },
      },
      {
        id: "loyalty",
        name: "Fidélisateur",
        description: "Gardez des clients réguliers",
        requirement: `${LOYALTY_CHAMPION.repeatCustomerCount} clients récurrents`,
        icon: "Heart",
        unlocked: repeatCustomers >= LOYALTY_CHAMPION.repeatCustomerCount,
        progress: { current: repeatCustomers, target: LOYALTY_CHAMPION.repeatCustomerCount },
      },
    ];

    return badges;
  }, [bookings, providerRating, reviewCount]);

  const unlockedCount = computedBadges.filter((b) => b.unlocked).length;
  const totalBadges = computedBadges.length;
  const completedMissions = bookings.filter((b) => b.status === "completed").length;

  // First locked non-comingSoon badge = "next to unlock"
  const nextBadgeIdx = computedBadges.findIndex((b) => !b.unlocked && !b.comingSoon && !b.notEnoughHistory);

  const bottomText = (() => {
    if (unlockedCount === totalBadges) {
      return { text: "Félicitations ! Tous vos badges sont débloqués. 🎉", color: "text-green-600" };
    }
    if (completedMissions === 0) {
      return {
        text: "Acceptez votre première demande pour débloquer vos premiers badges !",
        color: "text-muted-foreground",
      };
    }
    if (nextBadgeIdx >= 0) {
      const nb = computedBadges[nextBadgeIdx];
      if (nb.progress) {
        const remaining = nb.progress.target - nb.progress.current;
        if (remaining > 0) {
          return {
            text: `Plus que ${remaining}${nb.progress.suffix ?? ""} pour débloquer « ${nb.name} »`,
            color: "text-[#0F3A7A]",
          };
        }
      }
      return {
        text: `Prochain objectif : ${nb.name}`,
        color: "text-[#0F3A7A]",
      };
    }
    return null;
  })();

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Récompenses</CardTitle>
          </div>
          <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-2.5 py-0.5">
            {unlockedCount} / {totalBadges}
          </span>
        </div>
      </CardHeader>

      <CardContent>
        {/* Horizontal scroll on mobile, wrap on desktop */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory sm:flex-wrap sm:overflow-visible">
          {computedBadges.map((badge, idx) => {
            const IconComponent = iconMap[badge.icon] || Shield;
            const isUnlocked = badge.unlocked;
            const isNext = idx === nextBadgeIdx;
            const progressPct = badge.progress
              ? isUnlocked ? 100 : Math.round((badge.progress.current / badge.progress.target) * 100)
              : 0;
            const progressLabel = badge.progress
              ? isUnlocked
                ? `${badge.progress.target}${badge.progress.suffix ?? ""} ✓`
                : `${badge.progress.current} / ${badge.progress.target}${badge.progress.suffix ?? ""}`
              : null;

            return (
              <div
                key={badge.id}
                className={`
                  shrink-0 snap-center w-28 sm:w-32 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all
                  ${isUnlocked
                    ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20"
                    : isNext
                      ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20"
                      : "border-border bg-muted/30 opacity-70"
                  }
                `}
                data-testid={`badge-achievement-${badge.id}`}
              >
                {/* Next badge label */}
                {isNext && (
                  <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide leading-none">
                    Prochain objectif
                  </span>
                )}

                {/* Icon circle */}
                <div
                  className={`
                    relative flex items-center justify-center w-11 h-11 rounded-full
                    ${isUnlocked
                      ? "bg-emerald-500 text-white"
                      : isNext
                        ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40"
                        : "bg-muted text-muted-foreground"
                    }
                  `}
                >
                  <IconComponent className="h-5 w-5" />
                  {isUnlocked && (
                    <div className="absolute -bottom-1 -right-1 bg-white dark:bg-background rounded-full p-0.5">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                  )}
                  {!isUnlocked && (
                    <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Badge name */}
                <span className={`text-xs font-semibold text-center leading-tight ${isUnlocked ? "text-emerald-700 dark:text-emerald-400" : isNext ? "text-blue-700 dark:text-blue-300" : "text-muted-foreground"}`}>
                  {badge.name}
                </span>

                {/* Progress bar */}
                {badge.progress && !badge.comingSoon && (
                  <div className="w-full space-y-1">
                    <Progress
                      value={progressPct}
                      className={`h-1.5 ${isUnlocked ? "[&>div]:bg-emerald-500" : isNext ? "[&>div]:bg-blue-500" : ""}`}
                    />
                    <p className={`text-[10px] text-center ${isUnlocked ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {progressLabel}
                    </p>
                  </div>
                )}

                {/* Coming soon / not enough history */}
                {(badge.comingSoon || badge.notEnoughHistory) && (
                  <p className="text-[10px] text-muted-foreground italic text-center leading-tight">
                    {badge.comingSoon ? "Bientôt disponible" : badge.requirement}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom motivational text */}
        {bottomText && (
          <p className={`text-xs text-center mt-3 font-medium ${bottomText.color}`}>
            {bottomText.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default AchievementBadges;
