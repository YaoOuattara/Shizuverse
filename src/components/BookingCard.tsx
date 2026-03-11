"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Clock, Calendar, Pencil, Trash2, ChevronDown, Check, CircleDashed, XCircle, CheckCircle2, UserCircle, Star, Loader2, Banknote, FileText } from "lucide-react";
import { useState } from "react";
import { formatMoney } from "@/lib/currency";
import { useTranslations } from "next-intl";

export type BookingStatus = "confirmed" | "pending" | "cancelled" | "completed" | "under_review" | "assigned";
export type QuoteStatus = 'none' | 'sent' | 'accepted' | 'declined' | 'expired';

export interface BookingCardProps {
  id: string;
  serviceName: string;
  serviceType: string;
  providerId: string; // todo: remove mock functionality - use real provider ID from API
  providerName: string;
  date: string;
  time: string;
  status?: BookingStatus;
  notes?: string;
  quoteStatus?: QuoteStatus;
  quotedPrice?: number;
  quoteNote?: string;
  quoteExpiry?: string;
  currency?: string;
}

interface BookingCardComponentProps extends BookingCardProps {
  onEdit?: (booking: BookingCardProps) => void;
  onCancel?: (bookingId: string) => Promise<void> | void;
  onStatusChange?: (bookingId: string, newStatus: BookingStatus) => Promise<void> | void;
  onViewProfile?: (providerId: string) => void;
  onLeaveReview?: (booking: BookingCardProps) => void;
  onAcceptQuote?: (bookingId: string) => Promise<void> | void;
  onDeclineQuote?: (bookingId: string) => Promise<void> | void;
  hasReview?: boolean;
}

export default function BookingCard({
  id,
  serviceName,
  serviceType,
  providerId,
  providerName,
  date,
  time,
  status = "confirmed",
  notes,
  quoteStatus = "none",
  quotedPrice,
  quoteNote,
  quoteExpiry,
  currency = "XOF",
  onEdit,
  onCancel,
  onStatusChange,
  onViewProfile,
  onLeaveReview,
  onAcceptQuote,
  onDeclineQuote,
  hasReview = false,
}: BookingCardComponentProps) {
  const [isCancelling, setIsCancelling] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<BookingStatus | null>(null);
  const [isAcceptingQuote, setIsAcceptingQuote] = useState(false);
  const [isDecliningQuote, setIsDecliningQuote] = useState(false);

  const t = useTranslations("bookingCard");

  const booking: BookingCardProps = {
    id,
    serviceName,
    serviceType,
    providerId,
    providerName,
    date,
    time,
    status,
    notes,
    quoteStatus,
    quotedPrice,
    quoteNote,
    quoteExpiry,
    currency,
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(booking);
  };

  const handleCancelConfirm = async () => {
    if (!onCancel) return;
    setIsCancelling(true);
    try {
      await onCancel(id);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleStatusChange = async (newStatus: BookingStatus) => {
    if (newStatus !== status && onStatusChange) {
      setIsChangingStatus(true);
      setPendingStatus(newStatus);
      try {
        await onStatusChange(id, newStatus);
      } finally {
        setIsChangingStatus(false);
        setPendingStatus(null);
      }
    }
  };

  const handleViewProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewProfile?.(providerId);
  };

  const handleLeaveReview = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLeaveReview?.(booking);
  };

  const handleAcceptQuote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onAcceptQuote) return;
    setIsAcceptingQuote(true);
    try {
      await onAcceptQuote(id);
    } finally {
      setIsAcceptingQuote(false);
    }
  };

  const handleDeclineQuote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDeclineQuote) return;
    setIsDecliningQuote(true);
    try {
      await onDeclineQuote(id);
    } finally {
      setIsDecliningQuote(false);
    }
  };

  const isQuotePending = status === "pending" && (quoteStatus === "none" || !quoteStatus);
  const isQuoteSent = quoteStatus === "sent";
  const isQuoteAccepted = quoteStatus === "accepted";

  const statusStyles: Record<BookingStatus, string> = {
    confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    under_review: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    assigned: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  };

  const statusLabels: Record<BookingStatus, string> = {
    confirmed: t("status.confirmed"),
    pending: t("status.pending"),
    cancelled: t("status.cancelled"),
    completed: t("status.completed"),
    under_review: t("status.under_review"),
    assigned: t("status.assigned"),
  };

  const statusIcons: Record<BookingStatus, typeof Check> = {
    confirmed: Check,
    pending: CircleDashed,
    cancelled: XCircle,
    completed: CheckCircle2,
    under_review: CircleDashed,
    assigned: Check,
  };

  return (
    <Card
      className="hover-elevate active-elevate-2 cursor-pointer transition-shadow duration-200"
      data-testid={`card-booking-${id}`}
    >
      <CardContent className="p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <h3
              className="text-lg font-semibold text-foreground"
              data-testid={`text-service-${id}`}
            >
              {serviceName}
            </h3>
            <div className="flex items-center gap-2">
              {onStatusChange ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`${statusStyles[status]} gap-1 text-xs font-medium px-2 py-1 h-auto`}
                      onClick={(e) => e.stopPropagation()}
                      disabled={isChangingStatus}
                      data-testid={`dropdown-status-${id}`}
                    >
                      {isChangingStatus ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>{t("updating")}</span>
                        </>
                      ) : (
                        <>
                          {statusLabels[status]}
                          <ChevronDown className="h-3 w-3" />
                        </>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" data-testid={`dropdown-status-menu-${id}`}>
                    {(Object.keys(statusLabels) as BookingStatus[]).map((statusOption) => {
                      const StatusIcon = statusIcons[statusOption];
                      const isUpdating = isChangingStatus && pendingStatus === statusOption;
                      return (
                        <DropdownMenuItem
                          key={statusOption}
                          onClick={() => handleStatusChange(statusOption)}
                          className={status === statusOption ? "bg-accent" : ""}
                          disabled={isChangingStatus}
                          data-testid={`status-option-${statusOption}`}
                        >
                          {isUpdating ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <StatusIcon className="mr-2 h-4 w-4" />
                          )}
                          {statusLabels[statusOption]}
                          {status === statusOption && !isUpdating && (
                            <Check className="ml-auto h-4 w-4" />
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Badge
                  variant="secondary"
                  className={`${statusStyles[status]} text-xs font-medium`}
                  data-testid={`badge-status-${id}`}
                >
                  {statusLabels[status]}
                </Badge>
              )}
              {onEdit && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleEditClick}
                  data-testid={`button-edit-${id}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {onCancel && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`button-cancel-${id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent data-testid="dialog-cancel-booking">
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("cancelTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("cancelDescription", { service: serviceName, provider: providerName, date, time })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-cancel-dialog-dismiss">
                        {t("keepBooking")}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancelConfirm}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        data-testid="button-cancel-dialog-confirm"
                      >
                        {t("cancelBooking")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" aria-hidden="true" />
              {onViewProfile ? (
                <button
                  type="button"
                  className="text-base font-medium text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm"
                  onClick={handleViewProfile}
                  data-testid={`link-provider-${id}`}
                  aria-label={t("viewProviderAriaLabel", { name: providerName })}
                >
                  {providerName}
                </button>
              ) : (
                <span
                  className="text-base font-medium"
                  data-testid={`text-provider-${id}`}
                >
                  {providerName}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                <span className="text-sm" data-testid={`text-date-${id}`}>
                  {date}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" aria-hidden="true" />
                <span className="text-sm" data-testid={`text-time-${id}`}>
                  {time}
                </span>
              </div>
            </div>
          </div>

          {/* Quote Status Section */}
          {isQuotePending && (
            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md space-y-1" data-testid={`quote-pending-${id}`}>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                  {t("quotePending")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("quotePendingDesc")}
              </p>
            </div>
          )}

          {isQuoteSent && quotedPrice !== undefined && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md space-y-2" data-testid={`quote-sent-${id}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs">
                    {t("quoteReceived")}
                  </Badge>
                </div>
                <span className="font-semibold text-foreground" data-testid={`text-quote-price-${id}`}>
                  {formatMoney(quotedPrice, currency)}
                </span>
              </div>
              {quoteNote && (
                <p className="text-xs text-muted-foreground">{quoteNote}</p>
              )}
              {quoteExpiry && (
                <p className="text-xs text-muted-foreground">{t("expires", { date: quoteExpiry })}</p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleAcceptQuote}
                  disabled={isAcceptingQuote || isDecliningQuote}
                  data-testid={`button-accept-quote-${id}`}
                >
                  {isAcceptingQuote ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Check className="h-4 w-4 mr-1" />
                  )}
                  {t("acceptQuote")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDeclineQuote}
                  disabled={isAcceptingQuote || isDecliningQuote}
                  data-testid={`button-decline-quote-${id}`}
                >
                  {isDecliningQuote ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-1" />
                  )}
                  {t("decline")}
                </Button>
              </div>
            </div>
          )}

          {isQuoteAccepted && quotedPrice !== undefined && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-md" data-testid={`quote-accepted-${id}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">
                    {t("quoteAccepted")}
                  </Badge>
                </div>
                <span className="font-semibold text-foreground" data-testid={`text-accepted-price-${id}`}>
                  {formatMoney(quotedPrice, currency)}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t mt-2 flex-wrap">
            {onViewProfile && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewProfile}
                data-testid={`button-view-profile-${id}`}
              >
                <UserCircle className="mr-1.5 h-4 w-4" />
                {t("viewProfile")}
              </Button>
            )}
            {onLeaveReview && status === "completed" && !hasReview && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLeaveReview}
                data-testid={`button-leave-review-${id}`}
              >
                <Star className="mr-1.5 h-4 w-4" />
                {t("leaveReview")}
              </Button>
            )}
            {hasReview && status === "completed" && (
              <Badge
                variant="secondary"
                className="text-xs"
                data-testid={`badge-reviewed-${id}`}
              >
                <Check className="mr-1 h-3 w-3" />
                {t("reviewed")}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
