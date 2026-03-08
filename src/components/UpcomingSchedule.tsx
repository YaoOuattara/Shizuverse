"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User } from "lucide-react";
import type { ProviderBooking } from "@/data/mockProviderBookings";
import { useTranslations } from "next-intl";

interface UpcomingScheduleProps {
  bookings: ProviderBooking[];
  className?: string;
}

interface GroupedBookings {
  date: string;
  bookings: ProviderBooking[];
}

export default function UpcomingSchedule({ bookings, className }: UpcomingScheduleProps) {
  const t = useTranslations("upcomingSchedule");

  const groupedByDay = useMemo(() => {
    const confirmedBookings = bookings
      .filter((b) => b.status === "confirmed")
      .sort((a, b) => {
        const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
      });

    const groups: GroupedBookings[] = [];
    let currentGroup: GroupedBookings | null = null;

    confirmedBookings.forEach((booking) => {
      if (!currentGroup || currentGroup.date !== booking.date) {
        currentGroup = { date: booking.date, bookings: [] };
        groups.push(currentGroup);
      }
      currentGroup.bookings.push(booking);
    });

    return groups;
  }, [bookings]);

  if (groupedByDay.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">{t("title")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("noConfirmed")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const confirmedCount = bookings.filter((b) => b.status === "confirmed").length;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">{t("title")}</CardTitle>
          </div>
          <Badge variant="secondary" data-testid="badge-confirmed-count">
            {t("confirmedCount", { count: confirmedCount })}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {groupedByDay.map((group) => (
          <div key={group.date} data-testid={`schedule-day-${group.date.replace(/\s/g, "-")}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-foreground">{group.date}</span>
              <Badge variant="outline" className="text-xs">
                {t("bookingCount", { count: group.bookings.length })}
              </Badge>
            </div>

            <div className="space-y-2 pl-2 border-l-2 border-muted">
              {group.bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center gap-3 py-1.5 px-2 rounded-md bg-muted/30"
                  data-testid={`schedule-item-${booking.id}`}
                >
                  <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{booking.time}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {booking.serviceName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({booking.duration})
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span className="truncate">{booking.customerName}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
