"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  Clock,
  Calendar,
  Check,
  X,
  MessageCircle,
  Phone,
  FileText,
  Loader2,
  CheckCircle2,
  CircleDashed,
  XCircle,
  Clock3,
  MapPin,
  Flag,
  Zap,
} from "lucide-react";
import { useState } from "react";
import type { ProviderBooking, ProviderBookingStatus } from "@/data/mockProviderBookings";
import { formatMoney } from "@/lib/currency";
import { useTranslations } from "next-intl";

// Numéro support Shizu (wa.me) — le bouton « Contacter Shizu » remplace
// l'ancien Reprogrammer (qui ne persistait rien).
const SHIZU_WA = (process.env.NEXT_PUBLIC_SHIZU_WHATSAPP ?? "").replace(/\D/g, "");

// « 30 juil. 2026 » depuis le YYYY-MM-DD de l'API ; la valeur brute si illisible.
function humanDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

// « Awa C. » — une mission close est un reçu, pas une fiche contact.
function shortName(full: string): string {
  const parts = (full || "").trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "—";
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

// Date LOCALE du jour (pas toISOString : UTC décale la journée hors d'Abidjan).
function todayLocalISO(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

interface ProviderBookingCardProps {
  booking: ProviderBooking;
  conflictWarning?: string | null;
  onAccept?: (bookingId: string) => Promise<void> | void;
  onReject?: (bookingId: string) => Promise<void> | void;
  onStart?: (bookingId: string) => Promise<void> | void;
  onComplete?: (bookingId: string) => Promise<void> | void;
}

export default function ProviderBookingCard({
  booking,
  conflictWarning,
  onAccept,
  onReject,
  onStart,
  onComplete,
}: ProviderBookingCardProps) {
  const t = useTranslations("providerBookingCard");
  // Référence canonique SHZ-{année}-{id} (année depuis requestedAt).
  const shzRef = `SHZ-${!isNaN(Date.parse(booking.requestedAt)) ? new Date(booking.requestedAt).getFullYear() : new Date().getFullYear()}-${booking.id}`;
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const handleAccept = async () => {
    if (!onAccept) return;
    setIsAccepting(true);
    try {
      await onAccept(booking.id);
    } catch (error) {
      console.error("Accept booking failed:", error);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!onReject) return;
    setIsRejecting(true);
    try {
      await onReject(booking.id);
    } catch (error) {
      console.error("Reject booking failed:", error);
    } finally {
      setIsRejecting(false);
    }
  };

  const statusStyles: Record<ProviderBookingStatus, string> = {
    confirmed:   "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    pending:     "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    requested:   "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    cancelled:   "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    completed:   "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    assigned:    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
    accepted:    "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  };

  // Provider-facing labels are always French (providers are francophone — T-19).
  const statusLabels: Record<ProviderBookingStatus, string> = {
    confirmed:   t("status.confirmed"),
    pending:     t("status.pending"),
    requested:   t("status.pending"),
    cancelled:   t("status.cancelled"),
    completed:   t("status.completed"),
    in_progress: "En cours",
    assigned:    "Nouvelle mission",
    accepted:    "Acceptée",
  };

  const statusIcons: Record<ProviderBookingStatus, typeof CheckCircle2> = {
    confirmed:   CheckCircle2,
    pending:     CircleDashed,
    requested:   CircleDashed,
    cancelled:   XCircle,
    completed:   Check,
    in_progress: MapPin,
    assigned:    CircleDashed,
    accepted:    Check,
  };

  const handleStart = async () => {
    if (!onStart) return;
    setIsStarting(true);
    try { await onStart(booking.id); } catch { /* noop */ } finally { setIsStarting(false); }
  };

  const handleComplete = async () => {
    if (!onComplete) return;
    setIsCompleting(true);
    try { await onComplete(booking.id); } catch { /* noop */ } finally { setIsCompleting(false); }
  };

  const StatusIcon = statusIcons[booking.status as ProviderBookingStatus] ?? CircleDashed;
  const isCompleted = booking.status === "completed";
  const isPending = booking.status === "pending" || booking.status === "requested";
  const isAssigned = booking.status === "assigned";
  const isAccepted = booking.status === "accepted";
  const isConfirmed = booking.status === "confirmed";
  const isInProgress = booking.status === "in_progress";
  // Accept/refuse is offered on open requests AND on missions the admin assigned.
  const canAcceptReject = isPending || isAssigned;
  // Start is offered once the mission is confirmed (paid) or accepted by the provider.
  const canStart = isConfirmed || isAccepted;
  const isActionable = canAcceptReject || isConfirmed || isAccepted || isInProgress;
  const isAnyLoading = isAccepting || isRejecting || isRescheduling || isStarting || isCompleting;

  // ── Mission terminée : un REÇU, pas une mission à venir en gris ────────────
  // Le montant est verrouillé et acquis — « estimée » sèmerait le doute sur de
  // l'argent dû, la durée « 60 min » est une constante backend fabriquée, et le
  // téléphone complet du client n'a plus d'usage sur une mission close. Une
  // ligne de contexte suffit ; les cartes ACTIVES gardent la mise en page riche.
  if (isCompleted) {
    return (
      <Card className="hover-elevate transition-all" data-testid={`provider-booking-card-${booking.id}`}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground truncate">{booking.serviceName}</p>
              {booking.estimatedPayout != null && booking.estimatedPayout > 0 ? (
                <p className="text-xl sm:text-2xl font-bold text-foreground mt-0.5"
                   data-testid={`text-payout-${booking.id}`}>
                  {formatMoney(booking.estimatedPayout)}
                  <span className="ml-2 text-xs font-normal text-muted-foreground align-middle">
                    Rémunération
                  </span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-0.5">Montant à confirmer par Shizu</p>
              )}
            </div>
            <Badge
              variant="secondary"
              className={`${statusStyles.completed} text-xs font-medium shrink-0`}
              data-testid={`badge-status-${booking.id}`}
            >
              <Check className="mr-1 h-3 w-3" />
              {statusLabels.completed}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2 truncate"
             data-testid={`text-context-${booking.id}`}>
            {shortName(booking.customerName)}
            {(booking.commune || booking.location) && <> · {booking.commune || (booking.location ?? "").split(",")[0].trim()}</>}
            {booking.date && <> · {humanDate(booking.date)}</>}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card
        className="hover-elevate transition-all"
        data-testid={`provider-booking-card-${booking.id}`}
      >
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex-1 min-w-0">
                <h3
                  className="font-semibold text-foreground text-base sm:text-lg truncate"
                  data-testid={`text-service-${booking.id}`}
                >
                  {booking.serviceName}
                </h3>
                {/* booking.duration n'est PAS affiché : c'est une constante
                    backend fabriquée ('duration': 60 pour toutes les missions,
                    api/admin.py:867) — une donnée inventée qui prétend informer.
                    Dette consignée : vraie estimation par catégorie, ou
                    suppression du champ. */}
                {booking.estimatedPayout != null && booking.estimatedPayout > 0 && (
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {formatMoney(booking.estimatedPayout)} <span className="text-[11px]">(rémunération estimée)</span>
                  </p>
                )}
              </div>
              <Badge
                variant="secondary"
                className={`${statusStyles[booking.status as ProviderBookingStatus] ?? ""} text-xs font-medium shrink-0`}
                data-testid={`badge-status-${booking.id}`}
              >
                <StatusIcon className="mr-1 h-3 w-3" />
                {statusLabels[booking.status as ProviderBookingStatus] ?? booking.status}
              </Badge>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t">
              {booking.masked ? (
                /* PII masked until the mission is assigned to this provider —
                   show only the commune, never name/phone/exact address. */
                <div className="flex items-center gap-2 text-foreground">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="text-sm font-medium truncate">
                    {booking.commune || booking.location || "—"}
                  </span>
                  <Badge variant="outline" className="text-[10px] ml-1">
                    Coordonnées visibles après attribution
                  </Badge>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-foreground">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                    <span
                      className="text-sm font-medium truncate"
                      data-testid={`text-customer-${booking.id}`}
                    >
                      {booking.customerName}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-muted-foreground">
                    {booking.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="text-xs sm:text-sm truncate">{booking.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="text-xs sm:text-sm" data-testid={`text-phone-${booking.id}`}>
                        {booking.customerPhone}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-muted-foreground pt-2 border-t">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="text-sm" data-testid={`text-date-${booking.id}`}>
                  {booking.date}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="text-sm" data-testid={`text-time-${booking.id}`}>
                  {booking.time}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="text-xs text-muted-foreground/70">
                  {t("requested", { date: booking.requestedAt })}
                </span>
              </div>
            </div>

            {/* Urgency + time preference chips */}
            {(booking.urgency || booking.time_preference) && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t">
                {/* Le chip décrit le TYPE de demande (fait intemporel), jamais
                    un compte à rebours : « 2h » affiché indéfiniment était une
                    échéance morte. La priorisation survit, le chiffre meurt. */}
                {booking.urgency === 'urgent_2h' && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full">
                    <Zap className="h-3 w-3" />
                    Demande urgente
                  </span>
                )}
                {/* « Aujourd'hui » n'est vrai que le jour J : l'urgence same_day
                    est figée à la demande, et le badge s'affichait des jours plus
                    tard sur une mission datée d'ailleurs — un badge qui ment. */}
                {booking.urgency === 'same_day' && booking.date === todayLocalISO() && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                    <Clock className="h-3 w-3" />
                    Aujourd&apos;hui
                  </span>
                )}
                {/* under_24h : cas nominal — aucun chip. Un badge sur le cas
                    normal n'est pas une information, c'est du bruit. */}
                {booking.time_preference === 'morning' && (
                  <span className="inline-flex items-center gap-1 text-xs bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full">
                    🌅 Matin · 8h–12h
                  </span>
                )}
                {booking.time_preference === 'afternoon' && (
                  <span className="inline-flex items-center gap-1 text-xs bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full">
                    ☀️ Après-midi · 12h–17h
                  </span>
                )}
                {booking.time_preference === 'evening' && (
                  <span className="inline-flex items-center gap-1 text-xs bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full">
                    🌆 Soirée · 17h–20h
                  </span>
                )}
              </div>
            )}

            {booking.notes && (
              <div className="flex items-start gap-2 text-muted-foreground pt-2 border-t">
                <FileText className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs sm:text-sm italic" data-testid={`text-notes-${booking.id}`}>
                  {booking.notes}
                </p>
              </div>
            )}

            {conflictWarning && isPending && (
              <div
                className="flex items-start gap-2 pt-2 border-t text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2"
                data-testid={`conflict-warning-${booking.id}`}
              >
                <Clock3 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs sm:text-sm font-medium">
                  {conflictWarning}
                </p>
              </div>
            )}

            {/* "Je suis arrivé" button — shown when confirmed (paid) or accepted */}
            {canStart && onStart && (
              <div className="pt-3 border-t -mx-4 sm:-mx-6 mt-3 -mb-4 sm:-mb-6 bg-amber-50/60">
                <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                  <button
                    onClick={handleStart}
                    disabled={isAnyLoading}
                    className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
                  >
                    {isStarting
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <MapPin className="h-4 w-4" />}
                    {isStarting ? "Démarrage…" : "Je suis arrivé — Démarrer la mission"}
                  </button>
                </div>
              </div>
            )}

            {/* "Terminer la mission" button — shown when in_progress */}
            {isInProgress && onComplete && (
              <div className="pt-3 border-t -mx-4 sm:-mx-6 mt-3 -mb-4 sm:-mb-6 bg-green-50/60">
                <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                  <button
                    onClick={handleComplete}
                    disabled={isAnyLoading}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
                  >
                    {isCompleting
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Flag className="h-4 w-4" />}
                    {isCompleting ? "Finalisation…" : "Terminer la mission"}
                  </button>
                </div>
              </div>
            )}

            {canAcceptReject && (
              <div className="pt-3 border-t -mx-4 sm:-mx-6 mt-3 -mb-4 sm:-mb-6 bg-muted/30">
                <div className="flex flex-col sm:flex-row gap-2 px-4 sm:px-6 pb-4 sm:pb-6">
                  {canAcceptReject && onAccept && (
                    <Button
                      onClick={handleAccept}
                      disabled={isAnyLoading}
                      className="w-full sm:w-auto"
                      data-testid={`button-accept-${booking.id}`}
                    >
                      {isAccepting ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-1.5 h-4 w-4" />
                      )}
                      {isAccepting ? t("accepting") : t("accept")}
                    </Button>
                  )}

                  <div className="flex gap-2 w-full sm:w-auto">
                    {canAcceptReject && onReject && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            disabled={isAnyLoading}
                            className="flex-1 sm:flex-none"
                            data-testid={`button-reject-${booking.id}`}
                          >
                            {isRejecting ? (
                              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            ) : (
                              <X className="mr-1.5 h-4 w-4" />
                            )}
                            {isRejecting ? t("rejecting") : t("reject")}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent data-testid="dialog-reject-booking">
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("rejectTitle")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("rejectDescription", {
                                customerName: booking.customerName || booking.commune || "ce client",
                                serviceName: booking.serviceName,
                                date: booking.date,
                                time: booking.time,
                              })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-testid="button-reject-dialog-cancel">
                              {t("cancel")}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleReject}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-testid="button-reject-dialog-confirm"
                            >
                              {t("rejectBooking")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    {/* Reprogrammer retiré : le bouton ne persistait RIEN (simulation
                        locale). Tout changement d'horaire passe par Shizu, qui
                        reprogramme côté admin et notifie le client. */}
                    {SHIZU_WA && (
                      <Button
                        variant="outline"
                        asChild
                        className="flex-1 sm:flex-none"
                        data-testid={`button-contact-shizu-${booking.id}`}
                      >
                        <a
                          href={`https://wa.me/${SHIZU_WA}?text=${encodeURIComponent(t("contactShizuMessage", { ref: shzRef }))}`}
                          target="_blank" rel="noopener noreferrer"
                        >
                          <MessageCircle className="mr-1.5 h-4 w-4" />
                          {t("contactShizu")}
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

    </>
  );
}
