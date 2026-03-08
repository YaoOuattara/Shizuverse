"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import type { ProviderBooking } from "@/data/mockProviderBookings";
import type { DateRange } from "@/components/DateRangeFilter";
import { formatMoney } from "@/lib/currency";
import { useTranslations } from "next-intl";

type ViewMode = "daily" | "weekly";

interface RevenueBreakdownProps {
  bookings: ProviderBooking[];
  dateRange?: DateRange;
  serviceFilter?: string;
  className?: string;
}

interface ChartDataPoint {
  name: string;
  earnings: number;
  bookings: number;
}

function parseBookingDate(dateStr: string): Date {
  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const parts = dateStr.replace(",", "").split(" ");
  if (parts.length !== 3) return new Date();
  const month = months[parts[0]] ?? 0;
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function RevenueBreakdown({
  bookings,
  dateRange,
  serviceFilter,
  className,
}: RevenueBreakdownProps) {
  const t = useTranslations("revenueBreakdown");
  const [viewMode, setViewMode] = useState<ViewMode>("daily");

  const getDayLabel = (date: Date): string => t(`days.${DAY_KEYS[date.getDay()]}`);

  const completedBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status !== "completed") return false;

      if (serviceFilter && serviceFilter !== "all" && b.serviceName !== serviceFilter) {
        return false;
      }

      if (dateRange?.startDate || dateRange?.endDate) {
        const bookingDate = parseBookingDate(b.date);
        if (dateRange.startDate) {
          const start = new Date(dateRange.startDate);
          if (bookingDate < start) return false;
        }
        if (dateRange.endDate) {
          const end = new Date(dateRange.endDate);
          if (bookingDate > end) return false;
        }
      }

      return true;
    });
  }, [bookings, dateRange, serviceFilter]);

  const allCompletedBookings = useMemo(() => {
    return bookings.filter((b) => b.status === "completed");
  }, [bookings]);

  const { chartData, periodTotals } = useMemo(() => {
    if (completedBookings.length === 0) {
      return {
        chartData: [] as ChartDataPoint[],
        periodTotals: { earnings: 0, bookings: 0 },
      };
    }

    if (viewMode === "daily") {
      const dailyMap = new Map<string, { earnings: number; count: number; date: Date }>();

      completedBookings.forEach((booking) => {
        const date = parseBookingDate(booking.date);
        const key = date.toISOString().split("T")[0];
        const existing = dailyMap.get(key) || { earnings: 0, count: 0, date };
        existing.earnings += booking.price;
        existing.count += 1;
        dailyMap.set(key, existing);
      });

      const sortedEntries = Array.from(dailyMap.entries()).sort(
        (a, b) => a[1].date.getTime() - b[1].date.getTime()
      );

      const recentEntries = sortedEntries.slice(-7);

      const data: ChartDataPoint[] = recentEntries.map(([_, value]) => ({
        name: getDayLabel(value.date),
        earnings: value.earnings,
        bookings: value.count,
      }));

      const totals = recentEntries.reduce(
        (acc, [_, value]) => ({
          earnings: acc.earnings + value.earnings,
          bookings: acc.bookings + value.count,
        }),
        { earnings: 0, bookings: 0 }
      );

      return { chartData: data, periodTotals: totals };
    } else {
      const weeklyMap = new Map<string, { earnings: number; count: number; weekNum: number; year: number }>();

      completedBookings.forEach((booking) => {
        const date = parseBookingDate(booking.date);
        const year = date.getFullYear();
        const weekNum = getWeekNumber(date);
        const key = `${year}-W${weekNum}`;
        const existing = weeklyMap.get(key) || { earnings: 0, count: 0, weekNum, year };
        existing.earnings += booking.price;
        existing.count += 1;
        weeklyMap.set(key, existing);
      });

      const sortedEntries = Array.from(weeklyMap.entries()).sort((a, b) => {
        if (a[1].year !== b[1].year) return a[1].year - b[1].year;
        return a[1].weekNum - b[1].weekNum;
      });

      const recentEntries = sortedEntries.slice(-4);

      const data: ChartDataPoint[] = recentEntries.map(([_, value], idx) => ({
        name: t("weekLabel", { n: idx + 1 }),
        earnings: value.earnings,
        bookings: value.count,
      }));

      const totals = recentEntries.reduce(
        (acc, [_, value]) => ({
          earnings: acc.earnings + value.earnings,
          bookings: acc.bookings + value.count,
        }),
        { earnings: 0, bookings: 0 }
      );

      return { chartData: data, periodTotals: totals };
    }
  }, [completedBookings, viewMode, t]);

  const allTimeStats = useMemo(() => {
    const totalEarnings = allCompletedBookings.reduce((sum, b) => sum + b.price, 0);
    const totalBookings = allCompletedBookings.length;
    const avgPerBooking = totalBookings > 0 ? totalEarnings / totalBookings : 0;
    return { totalEarnings, totalBookings, avgPerBooking };
  }, [allCompletedBookings]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-md p-3 shadow-lg">
          <p className="font-medium text-foreground">{label}</p>
          <p className="text-sm text-muted-foreground">
            {t("earnings")} <span className="text-foreground font-medium">{formatMoney(payload[0].value)}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {t("bookings")}: <span className="text-foreground font-medium">{payload[0].payload.bookings}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">{t("title")}</CardTitle>
          </div>

          <div className="flex gap-1">
            <Button
              variant={viewMode === "daily" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("daily")}
              data-testid="button-view-daily"
            >
              {t("daily")}
            </Button>
            <Button
              variant={viewMode === "weekly" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("weekly")}
              data-testid="button-view-weekly"
            >
              {t("weekly")}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
            <div>
              <p className="text-xs text-muted-foreground">{t("periodTotal")}</p>
              <p className="font-semibold text-foreground" data-testid="text-period-earnings">
                {formatMoney(periodTotals.earnings)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
            <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-xs text-muted-foreground">{t("bookings")}</p>
              <p className="font-semibold text-foreground" data-testid="text-period-bookings">
                {periodTotals.bookings}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
            <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <div>
              <p className="text-xs text-muted-foreground">{t("allTime")}</p>
              <p className="font-semibold text-foreground" data-testid="text-total-earnings">
                {formatMoney(allTimeStats.totalEarnings)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
            <BarChart3 className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <div>
              <p className="text-xs text-muted-foreground">{t("avgPerBooking")}</p>
              <p className="font-semibold text-foreground" data-testid="text-avg-booking">
                {formatMoney(allTimeStats.avgPerBooking)}
              </p>
            </div>
          </div>
        </div>

        {chartData.length > 0 ? (
          <>
            <div className="h-[200px] sm:h-[250px] w-full" data-testid="chart-revenue">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="name"
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => value >= 1000 ? `${Math.round(value / 1000)}k` : `${value}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="earnings" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        className="fill-primary hover:fill-primary/80 transition-colors"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              {chartData.map((item, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-xs"
                  data-testid={`badge-bookings-${item.name.toLowerCase().replace(" ", "-")}`}
                >
                  {item.name}: {item.bookings} {item.bookings !== 1 ? t("bookingsPlural") : t("bookingSingular")}
                </Badge>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center" data-testid="empty-revenue">
            <BarChart3 className="h-10 w-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">
              {t("noBookingsTitle")}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {t("noBookingsDesc")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default RevenueBreakdown;
