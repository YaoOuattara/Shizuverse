"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import type { ProviderBooking } from "@/data/mockProviderBookings";
import { formatMoney } from "@/lib/currency";

interface RevenueBreakdownProps {
  bookings: ProviderBooking[];
  dateRange?: unknown;
  serviceFilter?: string;
  className?: string;
}

export function RevenueBreakdown({ bookings, className }: RevenueBreakdownProps) {
  const { week, month } = useMemo(() => {
    const now = new Date();

    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); // Monday
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let week = 0;
    let month = 0;

    for (const b of bookings) {
      if (b.status !== "completed") continue;
      const raw = b as ProviderBooking & { amount_xof?: number };
      const amount = raw.amount_xof ?? (typeof b.price === "number" ? b.price : 0);
      if (!amount) continue;

      // Parse booking date — stored as "Mon DD, YYYY" or ISO
      let bookingDate: Date;
      try {
        bookingDate = new Date(b.date);
        if (isNaN(bookingDate.getTime())) {
          const months: Record<string, number> = {
            Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
            Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
          };
          const parts = b.date.replace(",", "").split(" ");
          bookingDate = new Date(
            parseInt(parts[2], 10),
            months[parts[0]] ?? 0,
            parseInt(parts[1], 10)
          );
        }
      } catch {
        continue;
      }

      if (bookingDate >= startOfMonth) month += amount;
      if (bookingDate >= startOfWeek) week += amount;
    }

    return { week, month };
  }, [bookings]);

  const cols = [
    { label: "Cette semaine", value: week },
    { label: "Ce mois",       value: month },
  ];

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Revenus</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {cols.map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl border border-border bg-muted/30 px-4 py-5 text-center"
            >
              <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {formatMoney(value)}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default RevenueBreakdown;
