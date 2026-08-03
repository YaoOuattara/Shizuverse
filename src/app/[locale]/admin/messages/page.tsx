"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "../AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, MessageCircle, RefreshCw, AlertTriangle, Inbox,
  ExternalLink, Check, Paperclip, ArrowDownLeft, ArrowUpRight,
} from "lucide-react";
import { adminApi } from "@/lib/api";
import { waTemplateLabel } from "@/lib/waTemplateLabels";
import { useToast } from "@/hooks/use-toast";

// Mirrors WhatsAppMessage.to_dict() on the backend.
type MessageItem = {
  id: number;
  message_sid: string;
  direction: "inbound" | "outbound";
  from_phone: string | null;
  to_phone: string | null;
  body: string | null;
  num_media: number;
  template_key: string | null;
  status: string;
  error_code: string | null;
  booking_id: number | null;
  provider_id: number | null;
  matched_role: string;
  is_read: boolean;
  received_at: string | null;
};

const ROLE_LABELS: Record<string, { fr: string; en: string; cls: string }> = {
  provider: { fr: "Prestataire", en: "Provider", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  client:   { fr: "Client",      en: "Client",   cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  both:     { fr: "Les deux rôles", en: "Both roles", cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  none:     { fr: "Non rattaché", en: "Unmatched", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
};

const STATUS_LABELS: Record<string, { fr: string; en: string }> = {
  received:    { fr: "reçu",      en: "received" },
  queued:      { fr: "en file",   en: "queued" },
  sent:        { fr: "envoyé",    en: "sent" },
  delivered:   { fr: "remis",     en: "delivered" },
  read:        { fr: "lu",        en: "read" },
  failed:      { fr: "ÉCHEC",     en: "FAILED" },
  undelivered: { fr: "NON REMIS", en: "UNDELIVERED" },
};

// Same hints as the booking drawer — an unknown code still shows raw.
const ERROR_HINTS: Record<string, { fr: string; en: string }> = {
  "63016": {
    fr: "hors fenêtre 24h — un message libre ne passe que si la personne a écrit dans les 24h",
    en: "outside the 24h window — free-form only reaches people who wrote in the last 24h",
  },
  "63028": { fr: "variables du template incorrectes", en: "template variable mismatch" },
  "63003": { fr: "destinataire introuvable sur WhatsApp", en: "recipient not reachable on WhatsApp" },
  "63024": { fr: "numéro invalide", en: "invalid phone number" },
};

function formatDate(iso: string | null, isFr: boolean) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(isFr ? "fr-FR" : "en-US", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

type Tab = "all" | "unread" | "unmatched";

export default function AdminMessagesPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const locale = (params?.locale as string) ?? "fr";
  const isFr = locale === "fr";

  const [tab, setTab] = useState<Tab>("all");
  const [items, setItems] = useState<MessageItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [marking, setMarking] = useState<number | null>(null);

  const load = useCallback(async (which: Tab) => {
    setLoading(true);
    setError(false);
    try {
      const data = await adminApi.portalGetMessages({
        unread: which === "unread",
        unmatched: which === "unmatched",
        limit: 200,
      });
      // Aucun re-filtrage client : les onglets partagent la définition de leur
      // badge CÔTÉ BACKEND (unread et unmatched filtrent direction='inbound' à
      // la source). Un filtre client par-dessus serait une seconde définition
      // du même prédicat — celle qui coïncide un temps, puis diverge.
      setItems(Array.isArray(data?.items) ? data.items : []);
      setUnreadCount(data?.unread_count ?? 0);
      setUnmatchedCount(data?.unmatched_count ?? 0);
    } catch {
      // Never a silent empty screen — an empty list and a failed load look the
      // same to the eye, and here they mean opposite things.
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  const handleMarkRead = async (id: number) => {
    setMarking(id);
    try {
      await adminApi.portalMarkMessageRead(id);
      setItems((prev) => prev.map((m) => (m.id === id ? { ...m, is_read: true } : m)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      toast({
        title: isFr ? "Impossible de marquer comme lu" : "Could not mark as read",
        variant: "destructive",
      });
    } finally {
      setMarking(null);
    }
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "all", label: isFr ? "Tous" : "All" },
    { key: "unread", label: isFr ? "Non lus" : "Unread", count: unreadCount },
    { key: "unmatched", label: isFr ? "Non rattachés" : "Unmatched", count: unmatchedCount },
  ];

  return (
    <AdminLayout title={isFr ? "Messages WhatsApp" : "WhatsApp messages"}>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageCircle className="h-6 w-6" />
              {isFr ? "Messages WhatsApp" : "WhatsApp messages"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isFr
                ? "Réponses reçues dans le fil et statuts de livraison de ce que nous envoyons."
                : "Replies received in the thread and delivery status of what we send."}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => load(tab)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            {isFr ? "Rafraîchir" : "Refresh"}
          </Button>
        </div>

        {unmatchedCount > 0 && (
          <Card className="border-amber-200 bg-amber-50/60 dark:bg-amber-900/10">
            <CardContent className="pt-4 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900 dark:text-amber-200">
                {isFr
                  ? `${unmatchedCount} message(s) d'un numéro inconnu. Ils n'apparaissent dans aucun dossier — c'est ici, et seulement ici, qu'on les voit.`
                  : `${unmatchedCount} message(s) from an unknown number. They belong to no booking — this page is the only place they show up.`}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2 flex-wrap">
          {tabs.map((t) => (
            <Button
              key={t.key}
              variant={tab === t.key ? "default" : "outline"}
              size="sm"
              onClick={() => setTab(t.key)}
              data-testid={`tab-${t.key}`}
            >
              {t.label}
              {t.count ? <span className="ml-1.5 text-xs">({t.count})</span> : null}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <AlertTriangle className="h-8 w-8 mx-auto text-destructive" />
              <p className="text-sm text-muted-foreground">
                {isFr
                  ? "Impossible de charger les messages. Ce n'est pas une boîte vide."
                  : "Could not load messages. This is not an empty inbox."}
              </p>
              <Button variant="outline" size="sm" onClick={() => load(tab)}>
                {isFr ? "Réessayer" : "Try again"}
              </Button>
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Inbox className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">
                {isFr ? "Aucun message" : "No messages"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {tab === "all"
                  ? (isFr
                      ? "Les réponses reçues sur WhatsApp apparaîtront ici."
                      : "Replies received on WhatsApp will show up here.")
                  : (isFr ? "Rien dans ce filtre." : "Nothing in this filter.")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((m) => {
              const inbound = m.direction === "inbound";
              const failed = m.status === "failed" || m.status === "undelivered";
              const role = ROLE_LABELS[m.matched_role] ?? ROLE_LABELS.none;
              const hint = m.error_code ? ERROR_HINTS[m.error_code] : undefined;
              const status = STATUS_LABELS[m.status];
              return (
                <Card
                  key={m.id}
                  className={`${inbound && !m.is_read ? "border-l-4 border-l-primary" : ""} ${
                    failed ? "border-red-200 dark:border-red-900" : ""
                  }`}
                  data-testid={`message-${m.id}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {inbound
                          ? <ArrowDownLeft className="h-4 w-4 text-green-600" />
                          : <ArrowUpRight className="h-4 w-4 text-muted-foreground" />}
                        <span className="font-mono">
                          {inbound ? (m.from_phone ?? "—") : (m.to_phone ?? "—")}
                        </span>
                      </CardTitle>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Rôle : INBOUND uniquement, calé sur direction — pas sur
                            matched_role. Un sortant tracé (?b=) porte 'outbound'
                            que ROLE_LABELS rendait « Non rattaché », et un sortant
                            d'avant 6a89893 porte 'both' (résolu par téléphone) tout
                            aussi trompeur. La flèche ↗, le libellé de template et le
                            badge de statut disent déjà tout ce qu'un sortant a à dire. */}
                        {inbound && (
                          <Badge className={role.cls} variant="outline">
                            {role[isFr ? "fr" : "en"]}
                          </Badge>
                        )}
                        <Badge variant="outline" className={failed ? "text-red-600 border-red-300" : ""}>
                          {status ? status[isFr ? "fr" : "en"] : m.status}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription className="text-xs">
                      {formatDate(m.received_at, isFr)}
                      {inbound && m.matched_role === "both" && (
                        <span className="ml-2 text-purple-700 dark:text-purple-300">
                          {isFr
                            ? "· ce numéro est prestataire ET client — rattaché à la mission"
                            : "· this number is both provider AND client — attached to the mission"}
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-2">
                    {inbound ? (
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {m.body || (
                          <span className="italic text-muted-foreground">
                            {isFr ? "(sans texte)" : "(no text)"}
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground break-all">
                        {m.template_key
                          ? waTemplateLabel(m.template_key, isFr)
                          : (isFr ? "message libre" : "free-form message")}
                      </p>
                    )}

                    {m.num_media > 0 && (
                      <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <Paperclip className="h-3 w-3" />
                        {isFr
                          ? `${m.num_media} pièce(s) jointe(s) — non téléchargée(s), consultez WhatsApp`
                          : `${m.num_media} attachment(s) — not downloaded, check WhatsApp`}
                      </p>
                    )}

                    {failed && (
                      <p className="text-xs text-red-700 dark:text-red-400">
                        {isFr ? "Non délivré" : "Not delivered"}
                        {m.error_code ? ` — code ${m.error_code}` : ""}
                        {hint ? ` (${hint[isFr ? "fr" : "en"]})` : ""}
                      </p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {m.booking_id ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/${locale}/admin/bookings?open=${m.booking_id}`)}
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                          {isFr ? `Réservation #${m.booking_id}` : `Booking #${m.booking_id}`}
                        </Button>
                      ) : (
                        <span className="text-xs text-amber-700 dark:text-amber-400">
                          {isFr
                            ? "Numéro inconnu — aucun dossier à ouvrir"
                            : "Unknown number — no booking to open"}
                        </span>
                      )}

                      {inbound && !m.is_read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={marking === m.id}
                          onClick={() => handleMarkRead(m.id)}
                        >
                          {marking === m.id
                            ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            : <Check className="h-3.5 w-3.5 mr-1.5" />}
                          {isFr ? "Marquer comme lu" : "Mark as read"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
