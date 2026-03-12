"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { useTranslations } from "next-intl";

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
  unlockedDate?: string;
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
  const t = useTranslations("achievementBadges");

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
    const repeatCustomers = Array.from(customerCounts.values()).filter((count) => count >= 2).length;

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
        name: t("badges.firstSteps.name"),
        description: t("badges.firstSteps.description"),
        requirement: t("badges.firstSteps.requirement", { count: FIRST_BOOKING.completedCount }),
        icon: "Sparkles",
        unlocked: completedCount >= FIRST_BOOKING.completedCount,
        progress: {
          current: Math.min(completedCount, FIRST_BOOKING.completedCount),
          target: FIRST_BOOKING.completedCount,
        },
      },
      {
        id: "reliable",
        name: t("badges.reliable.name"),
        description: t("badges.reliable.description"),
        requirement: t("badges.reliable.requirement", { count: RELIABLE.completedCount, maxRate: RELIABLE.maxCancellationRate }),
        icon: "Shield",
        unlocked: completedCount >= RELIABLE.completedCount && cancellationRate < RELIABLE.maxCancellationRate,
        progress: {
          current: completedCount,
          target: RELIABLE.completedCount,
        },
      },
      {
        id: "top_rated",
        name: t("badges.topRated.name"),
        description: t("badges.topRated.description"),
        requirement: t("badges.topRated.requirement", { minRating: TOP_RATED.minRating, minReviews: TOP_RATED.minReviewCount }),
        icon: "Star",
        unlocked: providerRating !== undefined && providerRating >= TOP_RATED.minRating && reviewCount >= TOP_RATED.minReviewCount,
        comingSoon: providerRating === undefined,
        progress: providerRating !== undefined ? {
          current: reviewCount,
          target: TOP_RATED.minReviewCount,
        } : undefined,
      },
      {
        id: "completion_streak",
        name: t("badges.completionStreak.name"),
        description: t("badges.completionStreak.description"),
        requirement: t("badges.completionStreak.requirement", { minRate: COMPLETION_STREAK.minCompletionRate, minBookings: COMPLETION_STREAK.minBookingsWithOutcome }),
        icon: "Flame",
        unlocked: completionRate >= COMPLETION_STREAK.minCompletionRate && totalWithOutcome >= COMPLETION_STREAK.minBookingsWithOutcome,
        notEnoughHistory: totalWithOutcome < COMPLETION_STREAK.minBookingsWithOutcome,
        helperText: t("badges.completionStreak.helperText", { total: totalWithOutcome }),
        progress: totalWithOutcome >= COMPLETION_STREAK.minBookingsWithOutcome ? {
          current: completionRate,
          target: COMPLETION_STREAK.minCompletionRate,
          suffix: "%",
          displayFormat: "goal",
        } : {
          current: totalWithOutcome,
          target: COMPLETION_STREAK.minBookingsWithOutcome,
          displayFormat: "fraction",
        },
      },
      {
        id: "loyalty",
        name: t("badges.loyalty.name"),
        description: t("badges.loyalty.description"),
        requirement: t("badges.loyalty.requirement", { count: LOYALTY_CHAMPION.repeatCustomerCount }),
        icon: "Heart",
        unlocked: repeatCustomers >= LOYALTY_CHAMPION.repeatCustomerCount,
        progress: {
          current: repeatCustomers,
          target: LOYALTY_CHAMPION.repeatCustomerCount,
        },
      },
    ];

    return badges;
  }, [bookings, providerRating, reviewCount, t]);

  const unlockedCount = computedBadges.filter((b) => b.unlocked).length;
  const totalBadges = computedBadges.length;

  const renderBadge = (badge: AchievementBadge) => {
    const IconComponent = iconMap[badge.icon] || Shield;
    const isUnlocked = badge.unlocked;
    const isComingSoon = badge.comingSoon;

    return (
      <Tooltip key={badge.id}>
        <TooltipTrigger asChild>
          <div
            className={`
              relative flex flex-col items-center gap-2 p-4 rounded-lg
              transition-all cursor-pointer
              ${isUnlocked
                ? "bg-primary/10 dark:bg-primary/20 hover-elevate"
                : "bg-muted/50 opacity-70"
              }
            `}
            data-testid={`badge-achievement-${badge.id}`}
          >
            <div
              className={`
                relative flex items-center justify-center w-12 h-12 rounded-full
                ${isUnlocked
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
                }
              `}
            >
              <IconComponent className="h-6 w-6" />

              {!isUnlocked && (
                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                  <Lock className="h-3 w-3 text-muted-foreground" />
                </div>
              )}

              {isUnlocked && (
                <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-0.5">
                  <CheckCircle className="h-3 w-3 text-white" />
                </div>
              )}
            </div>

            <span
              className={`
                text-sm font-medium text-center
                ${isUnlocked ? "text-foreground" : "text-muted-foreground"}
              `}
            >
              {badge.name}
            </span>

            {isComingSoon && (
              <Badge variant="secondary" className="text-xs">
                {t("comingSoon")}
              </Badge>
            )}

            {badge.notEnoughHistory && !isComingSoon && (
              <Badge variant="outline" className="text-xs">
                {t("notEnoughHistory")}
              </Badge>
            )}

            {!isUnlocked && !isComingSoon && !badge.notEnoughHistory && badge.progress && (
              <div className="w-full space-y-1">
                <Progress
                  value={(badge.progress.current / badge.progress.target) * 100}
                  className="h-1.5"
                />
                <p className="text-xs text-center text-muted-foreground">
                  {badge.progress.displayFormat === "goal"
                    ? `${badge.progress.current}${badge.progress.suffix || ""} \u2022 ${t("goal")} ${badge.progress.target}${badge.progress.suffix || ""}`
                    : `${badge.progress.current}/${badge.progress.target}${badge.progress.suffix || ""}`
                  }
                </p>
              </div>
            )}
          </div>
        </TooltipTrigger>

        <TooltipContent side="bottom" className="max-w-[250px] p-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <IconComponent className={`h-4 w-4 ${isUnlocked ? "text-primary" : "text-muted-foreground"}`} />
              <span className="font-semibold">{badge.name}</span>
              {isUnlocked && (
                <Badge variant="secondary" className="text-xs ml-auto">
                  {t("unlocked")}
                </Badge>
              )}
              {isComingSoon && (
                <Badge variant="outline" className="text-xs ml-auto">
                  {t("comingSoon")}
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              {badge.description}
            </p>

            <div className="pt-1 border-t border-border">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">{t("requirementLabel")}</span> {badge.requirement}
              </p>

              {isUnlocked && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  {t("achievementUnlocked")}
                </p>
              )}

              {isComingSoon && (
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {t("ratingDataRequired")}
                </p>
              )}

              {badge.notEnoughHistory && (
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {t("notEnoughBookingHistory")}
                </p>
              )}

              {!isUnlocked && !isComingSoon && !badge.notEnoughHistory && badge.progress && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("progressLabel")} {badge.progress.displayFormat === "goal"
                    ? `${badge.progress.current}${badge.progress.suffix || ""} \u2022 ${t("goal")} ${badge.progress.target}${badge.progress.suffix || ""}`
                    : `${badge.progress.current} / ${badge.progress.target}${badge.progress.suffix || ""}`
                  }
                </p>
              )}

              {badge.helperText && !badge.notEnoughHistory && (
                <p className="text-xs text-muted-foreground/60 mt-1 italic">
                  {badge.helperText}
                </p>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">{t("title")}</CardTitle>
          </div>

          <Badge variant="secondary" data-testid="badge-achievement-count">
            {t("unlockedCount", { count: unlockedCount, total: totalBadges })}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <TooltipProvider>
        <div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3"
          data-testid="grid-achievements"
        >
          {computedBadges.map(renderBadge)}
        </div>
        </TooltipProvider>

        {unlockedCount < totalBadges && (
          <p className="text-sm text-muted-foreground text-center mt-4">
            {t("keepUpMsg", { count: totalBadges - unlockedCount })}
          </p>
        )}

        {unlockedCount === totalBadges && (
          <p className="text-sm text-green-600 dark:text-green-400 text-center mt-4">
            {t("congratulations")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default AchievementBadges;
