"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarRange, X } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { useTranslations } from "next-intl";

export interface DateRange {
  startDate: string | null;
  endDate: string | null;
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

type PresetOption = "today" | "this_week" | "this_month" | "custom";

export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  const t = useTranslations("dateRangeFilter");
  const [isOpen, setIsOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetOption | null>(null);

  // Local state for input fields
  const [localStart, setLocalStart] = useState(value.startDate || "");
  const [localEnd, setLocalEnd] = useState(value.endDate || "");

  // Sync local state with prop value
  useEffect(() => {
    setLocalStart(value.startDate || "");
    setLocalEnd(value.endDate || "");
  }, [value.startDate, value.endDate]);

  // Check if a date range is active
  const hasActiveRange = value.startDate || value.endDate;

  // Format date for display
  const formatDisplayDate = (dateStr: string | null): string => {
    if (!dateStr) return "";
    try {
      return format(new Date(dateStr), "MMM d");
    } catch {
      return dateStr;
    }
  };

  // Get display label for active range
  const getDisplayLabel = (): string => {
    if (!hasActiveRange) return t("dateRange");
    if (activePreset === "today") return t("today");
    if (activePreset === "this_week") return t("thisWeek");
    if (activePreset === "this_month") return t("thisMonth");

    const start = formatDisplayDate(value.startDate);
    const end = formatDisplayDate(value.endDate);

    if (start && end) return `${start} - ${end}`;
    if (start) return t("from", { date: start });
    if (end) return t("until", { date: end });
    return t("dateRange");
  };

  // Apply preset date ranges
  const applyPreset = (preset: PresetOption) => {
    const today = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (preset) {
      case "today":
        startDate = startOfDay(today);
        endDate = endOfDay(today);
        break;
      case "this_week":
        startDate = startOfWeek(today, { weekStartsOn: 0 });
        endDate = endOfWeek(today, { weekStartsOn: 0 });
        break;
      case "this_month":
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
        break;
      default:
        return;
    }

    const formattedStart = format(startDate, "yyyy-MM-dd");
    const formattedEnd = format(endDate, "yyyy-MM-dd");

    setActivePreset(preset);
    setLocalStart(formattedStart);
    setLocalEnd(formattedEnd);
    onChange({ startDate: formattedStart, endDate: formattedEnd });
    setIsOpen(false);
  };

  // Apply custom date range
  const applyCustomRange = () => {
    setActivePreset("custom");
    onChange({ startDate: localStart || null, endDate: localEnd || null });
    setIsOpen(false);
  };

  // Clear the date range
  const clearRange = () => {
    setActivePreset(null);
    setLocalStart("");
    setLocalEnd("");
    onChange({ startDate: null, endDate: null });
  };

  return (
    <div className={className}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={hasActiveRange ? "default" : "outline"}
            size="sm"
            className="gap-2"
            data-testid="button-date-range-filter"
          >
            <CalendarRange className="h-4 w-4" />
            <span className="hidden sm:inline">{getDisplayLabel()}</span>
            <span className="sm:hidden">
              {hasActiveRange ? t("filtered") : t("dates")}
            </span>
            {hasActiveRange && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 px-1.5 text-xs bg-primary-foreground/20"
              >
                {t("active")}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-80 p-4"
          align="start"
          data-testid="popover-date-range"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-foreground">{t("filterByDate")}</h4>
              {hasActiveRange && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearRange}
                  className="h-7 px-2 text-xs"
                  data-testid="button-clear-date-range"
                >
                  <X className="h-3 w-3 mr-1" />
                  {t("clear")}
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t("quickSelect")}</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={activePreset === "today" ? "default" : "outline"}
                  size="sm"
                  onClick={() => applyPreset("today")}
                  data-testid="button-preset-today"
                >
                  {t("today")}
                </Button>
                <Button
                  variant={activePreset === "this_week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => applyPreset("this_week")}
                  data-testid="button-preset-this-week"
                >
                  {t("thisWeek")}
                </Button>
                <Button
                  variant={activePreset === "this_month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => applyPreset("this_month")}
                  data-testid="button-preset-this-month"
                >
                  {t("thisMonth")}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">{t("customRange")}</Label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="start-date" className="text-xs">{t("startDate")}</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={localStart}
                    onChange={(e) => {
                      setLocalStart(e.target.value);
                      setActivePreset("custom");
                    }}
                    className="h-9"
                    data-testid="input-start-date"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="end-date" className="text-xs">{t("endDate")}</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={localEnd}
                    onChange={(e) => {
                      setLocalEnd(e.target.value);
                      setActivePreset("custom");
                    }}
                    className="h-9"
                    data-testid="input-end-date"
                  />
                </div>
              </div>

              <Button
                onClick={applyCustomRange}
                className="w-full"
                size="sm"
                disabled={!localStart && !localEnd}
                data-testid="button-apply-date-range"
              >
                {t("applyCustomRange")}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default DateRangeFilter;
