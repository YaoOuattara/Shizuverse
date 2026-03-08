"use client";

import { useRef, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  CircleDashed,
  XCircle,
  Check,
  ListFilter,
} from "lucide-react";
import { useTranslations } from "next-intl";

export interface StatusCount {
  all: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
}

interface StatusTabsProps {
  value: string;
  onChange: (status: string) => void;
  counts: StatusCount;
  className?: string;
}

const statusConfig = [
  {
    key: "all",
    icon: ListFilter,
    activeClass: "",
  },
  {
    key: "pending",
    icon: CircleDashed,
    activeClass: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  {
    key: "confirmed",
    icon: CheckCircle2,
    activeClass: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  {
    key: "completed",
    icon: Check,
    activeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  {
    key: "cancelled",
    icon: XCircle,
    activeClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
] as const;

export default function StatusTabs({
  value,
  onChange,
  counts,
  className = "",
}: StatusTabsProps) {
  const t = useTranslations("statusTabs");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const checkScrollPosition = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const hasOverflow = scrollWidth > clientWidth;

    setShowLeftFade(hasOverflow && scrollLeft > 5);
    setShowRightFade(hasOverflow && scrollLeft < scrollWidth - clientWidth - 5);
  };

  useEffect(() => {
    checkScrollPosition();
    window.addEventListener("resize", checkScrollPosition);
    return () => window.removeEventListener("resize", checkScrollPosition);
  }, []);

  useEffect(() => {
    checkScrollPosition();
  }, [counts]);

  return (
    <div className={`relative ${className}`}>
      {showLeftFade && (
        <div
          className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none"
          aria-hidden="true"
        />
      )}

      {showRightFade && (
        <div
          className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none"
          aria-hidden="true"
        />
      )}

      <div
        ref={scrollContainerRef}
        onScroll={checkScrollPosition}
        className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1 -my-1 scroll-smooth"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
        }}
        role="tablist"
        aria-label={t("ariaLabel")}
        data-testid="status-tabs"
      >
        {statusConfig.map(({ key, icon: Icon, activeClass }) => {
          const count = counts[key as keyof StatusCount];
          const isSelected = value === key;

          return (
            <Badge
              key={key}
              variant={isSelected ? "default" : "outline"}
              className={`
                cursor-pointer shrink-0 transition-colors
                ${isSelected ? activeClass : "hover-elevate"}
              `}
              onClick={() => onChange(key)}
              role="tab"
              aria-selected={isSelected}
              aria-controls={`status-panel-${key}`}
              data-testid={`tab-status-${key}`}
            >
              <Icon className="mr-1 h-3 w-3" aria-hidden="true" />
              <span className="whitespace-nowrap">
                {t(key)} ({count})
              </span>
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
