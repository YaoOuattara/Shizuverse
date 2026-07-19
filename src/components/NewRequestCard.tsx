"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, User, Wrench, MapPin, Calendar } from "lucide-react";
import type { ProviderBooking } from "@/data/mockProviderBookings";

interface NewRequestCardProps {
  booking: ProviderBooking;
  locale?: string;
  onAccept: (bookingId: string) => Promise<void>;
  onDecline: (bookingId: string, reason: string) => Promise<void>;
}

/** Format date + time into "Jeudi 13 mars à 09h30" (fr) or "Thursday, March 13 at 9:30 AM" (en) */
function formatAppointmentDate(date: string, time: string, locale: string): string {
  if (!date || !time) return "";
  const [year, month, day] = date.split("-").map(Number);
  const [h, m] = time.split(":").map(Number);
  if (isNaN(year) || isNaN(h)) return `${date} ${time}`;
  const d = new Date(year, month - 1, day, h, m, 0);
  if (locale === "fr") {
    const raw = format(d, "EEEE d MMMM 'à' HH'h'mm", { locale: fr });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  return format(d, "EEEE, MMMM d 'at' h:mm a", { locale: enUS });
}

export default function NewRequestCard({
  booking,
  locale = "fr",
  onAccept,
  onDecline,
}: NewRequestCardProps) {
  const isFr = locale === "fr";

  const [isAccepting, setIsAccepting] = useState(false);
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [isDeclining, setIsDeclining] = useState(false);

  const formattedDate = formatAppointmentDate(booking.date, booking.time, locale);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await onAccept(booking.id);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDeclineSubmit = async () => {
    setIsDeclining(true);
    try {
      await onDecline(booking.id, declineReason);
    } finally {
      setIsDeclining(false);
      setShowDeclineForm(false);
      setDeclineReason("");
    }
  };

  const isAnyLoading = isAccepting || isDeclining;

  return (
    <Card className="hover-elevate transition-all border-amber-100 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-900/30">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-3">

          {/* Client + service */}
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0 mt-0.5">
              <User className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-sm leading-snug truncate">
                {booking.masked
                  ? (booking.commune || (isFr ? "Nouvelle demande" : "New request"))
                  : booking.customerName}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                <Wrench className="h-3 w-3 shrink-0" />
                {booking.serviceName}
              </p>
              {booking.estimatedPayout != null && booking.estimatedPayout > 0 && (
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {new Intl.NumberFormat('fr-FR').format(booking.estimatedPayout)} FCFA
                  <span className="text-[10px] text-muted-foreground ml-1">
                    {isFr ? "(estimé)" : "(estimated)"}
                  </span>
                </p>
              )}
              {booking.masked && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {isFr ? "Coordonnées visibles après attribution" : "Contact details visible after assignment"}
                </p>
              )}
            </div>
          </div>

          {/* Date + commune */}
          <div className="flex flex-col gap-1.5 text-xs text-muted-foreground border-t pt-2.5">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span className="font-medium text-foreground">{formattedDate}</span>
            </span>
            {booking.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>{booking.location}</span>
              </span>
            )}
          </div>

          {/* Notes */}
          {booking.notes && (
            <p className="text-xs text-muted-foreground italic border-t pt-2">
              {booking.notes}
            </p>
          )}

          {/* Decline reason input */}
          {showDeclineForm && (
            <div className="border-t pt-2.5 space-y-2">
              <p className="text-xs font-medium text-destructive">
                {isFr ? "Raison du déclin (optionnel)" : "Decline reason (optional)"}
              </p>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder={isFr ? "Ex: déjà occupé ce créneau..." : "e.g. already booked this slot..."}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => { setShowDeclineForm(false); setDeclineReason(""); }}
                  disabled={isDeclining}
                >
                  {isFr ? "Annuler" : "Cancel"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1 text-xs"
                  onClick={handleDeclineSubmit}
                  disabled={isDeclining}
                >
                  {isDeclining && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  {isFr ? "Confirmer" : "Confirm"}
                </Button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!showDeclineForm && (
            <div className="flex max-[380px]:flex-col gap-2 border-t pt-2.5">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold min-h-[44px]"
                onClick={handleAccept}
                disabled={isAnyLoading}
              >
                {isAccepting
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : (isFr ? "Accepter" : "Accept")
                }
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-destructive text-destructive hover:bg-destructive/10 text-sm font-semibold min-h-[44px]"
                onClick={() => setShowDeclineForm(true)}
                disabled={isAnyLoading}
              >
                {isFr ? "Décliner" : "Decline"}
              </Button>
            </div>
          )}

        </div>
      </CardContent>
    </Card>
  );
}
