"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import AdminLayout from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Send,
  Clock,
  Users,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { adminApi } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RetentionClient {
  phone: string;
  masked_phone: string;
  client_name: string;
  last_service: string;
  last_commune: string;
  days_since: number;
  threshold: number;
  booking_count: number;
  threshold_label: string;
  message_preview: string;
}

interface CampaignHistory {
  campaign_date: string;
  sent: number;
  total: number;
}

interface LaunchResult {
  sent: number;
  skipped: number;
  errors: number;
  total: number;
}

// ── Client card ───────────────────────────────────────────────────────────────

function ClientCard({
  client,
  onOptOut,
}: {
  client: RetentionClient;
  onOptOut: (phone: string) => void;
}) {
  const dayColor =
    client.days_since > 60
      ? "text-red-600 font-bold"
      : client.days_since > 30
      ? "text-amber-600 font-semibold"
      : "text-muted-foreground";

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <p className="text-sm font-semibold text-foreground">{client.masked_phone}</p>
          <p className="text-xs text-muted-foreground truncate">
            {client.last_service}{client.last_commune ? ` · ${client.last_commune}` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm ${dayColor}`}>{client.days_since}j sans réservation</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{client.threshold_label}</p>
        </div>
      </div>

      <blockquote className="border-l-4 border-green-300 pl-3 py-1.5 bg-green-50/60 rounded-r-lg">
        <p className="text-xs text-green-800 italic leading-relaxed">{client.message_preview}</p>
      </blockquote>

      <div className="flex items-center justify-between pt-0.5">
        <span className="text-xs text-muted-foreground">
          {client.booking_count} réservation{client.booking_count > 1 ? "s" : ""} au total
        </span>
        <button
          type="button"
          onClick={() => onOptOut(client.phone)}
          className="text-xs text-red-500 hover:text-red-700 font-medium underline underline-offset-2 transition-colors"
        >
          Opt-out
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminRetention() {
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";
  const isFr = locale === "fr";
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"preview" | "history">("preview");

  // Stats
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);
  const [lastCampaignDate, setLastCampaignDate] = useState<string | null>(null);
  const [totalMessagesSent, setTotalMessagesSent] = useState(0);

  // Preview
  const [previewLoading, setPreviewLoading] = useState(false);
  const [clients, setClients] = useState<RetentionClient[]>([]);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [optedOut, setOptedOut] = useState<Set<string>>(new Set());

  // Launch
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [ranToday, setRanToday] = useState(false);

  // History
  const [history, setHistory] = useState<CampaignHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadCount();
    loadHistory();
  }, []);

  async function loadCount() {
    try {
      const data = await adminApi.retentionCount();
      setEligibleCount(data.count ?? 0);
    } catch {
      setEligibleCount(0);
    }
  }

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const data = await adminApi.retentionHistory();
      const campaigns: CampaignHistory[] = data.campaigns ?? [];
      setHistory(campaigns);
      if (campaigns.length > 0) {
        setLastCampaignDate(campaigns[0].campaign_date);
        setTotalMessagesSent(campaigns.reduce((s, c) => s + (c.sent || 0), 0));
        const today = new Date().toISOString().split("T")[0];
        if (campaigns[0].campaign_date === today) setRanToday(true);
      }
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handlePreview() {
    setPreviewLoading(true);
    setPreviewLoaded(false);
    try {
      const data = await adminApi.retentionPreview();
      setClients(data.clients ?? []);
      setEligibleCount(data.count ?? 0);
      setPreviewLoaded(true);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger la prévisualisation.", variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleOptOut(phone: string) {
    try {
      await adminApi.retentionOptOut(phone);
      setOptedOut(prev => new Set([...prev, phone]));
      setClients(prev => prev.filter(c => c.phone !== phone));
    } catch {
      toast({ title: "Erreur", description: "Impossible de désabonner ce client.", variant: "destructive" });
    }
  }

  async function handleLaunch() {
    setLaunching(true);
    setConfirmOpen(false);
    try {
      const data = await adminApi.retentionRun();
      if (data.error) {
        if (data.ran_today) setRanToday(true);
        toast({ title: "Erreur", description: data.error, variant: "destructive" });
      } else {
        setLaunchResult(data as LaunchResult);
        setRanToday(true);
        await loadHistory();
      }
    } catch {
      toast({ title: "Erreur réseau", variant: "destructive" });
    } finally {
      setLaunching(false);
    }
  }

  const activeClients = clients.filter(c => !optedOut.has(c.phone));

  return (
    <AdminLayout title={isFr ? "Réengagement IA" : "AI Re-engagement"}>

      {/* ── AI context label ──────────────────────────────────────────────── */}
      <p className="text-xs text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-full inline-block mb-4">
        {isFr
          ? "Messages personnalisés par l'IA · Envoi supervisé par l'admin"
          : "AI-personalised messages · Sending supervised by admin"}
      </p>

      {/* ── Top Stats ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {isFr ? "Clients éligibles" : "Eligible clients"}
          </p>
          <p className="text-2xl font-bold text-foreground">
            {eligibleCount === null
              ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              : eligibleCount}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {isFr ? "Dernière campagne" : "Last campaign"}
          </p>
          <p className="text-sm font-semibold text-foreground">
            {lastCampaignDate
              ? new Date(lastCampaignDate).toLocaleDateString("fr-FR")
              : "—"}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1.5">
            <Send className="h-3.5 w-3.5" />
            {isFr ? "Messages envoyés total" : "Total messages sent"}
          </p>
          <p className="text-2xl font-bold text-foreground">{totalMessagesSent}</p>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-6 border-b">
        {(["preview", "history"] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "preview"
              ? <><Sparkles className="h-4 w-4" />{isFr ? "Prévisualiser" : "Preview"}</>
              : <><Clock className="h-4 w-4" />{isFr ? "Historique" : "History"}</>
            }
          </button>
        ))}
      </div>

      {/* ── Preview Tab ───────────────────────────────────────────────────── */}
      {activeTab === "preview" && (
        <div>
          {!previewLoaded && (
            <div className="flex flex-col items-center py-16 text-center">
              <Sparkles className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                {isFr
                  ? "Générez les messages personnalisés pour tous les clients inactifs. L'IA rédige un message par client."
                  : "Generate personalised messages for all inactive clients. AI drafts one message per client."}
              </p>
              <Button
                onClick={handlePreview}
                disabled={previewLoading}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {previewLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{isFr ? "Génération…" : "Generating…"}</>
                  : <><Sparkles className="h-4 w-4 mr-2" />{isFr ? "Prévisualiser la campagne" : "Preview campaign"}</>
                }
              </Button>
            </div>
          )}

          {previewLoaded && (
            <>
              <div className="space-y-3 mb-6">
                {activeClients.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-10">
                    {isFr ? "Aucun client éligible au réengagement." : "No eligible clients."}
                  </p>
                ) : (
                  activeClients.map(client => (
                    <ClientCard key={client.phone} client={client} onOptOut={handleOptOut} />
                  ))
                )}
              </div>

              {/* Launch section */}
              {activeClients.length > 0 && !launchResult && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-3">
                  <p className="text-sm font-semibold text-green-800">
                    {activeClients.length} client{activeClients.length > 1 ? "s" : ""}{" "}
                    {isFr ? "seront contactés via WhatsApp" : "will be contacted via WhatsApp"}
                  </p>
                  {ranToday && (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <p className="text-xs text-amber-700">
                        {isFr ? "Une campagne a déjà été lancée aujourd'hui." : "A campaign has already been sent today."}
                      </p>
                    </div>
                  )}
                  <Button
                    onClick={() => setConfirmOpen(true)}
                    disabled={launching || ranToday}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    {launching
                      ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{isFr ? "Envoi…" : "Sending…"}</>
                      : <><Send className="h-4 w-4 mr-2" />{isFr ? "Lancer la campagne" : "Launch campaign"}</>
                    }
                  </Button>
                </div>
              )}

              {/* Result card */}
              {launchResult && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <p className="font-semibold text-emerald-800">
                      {isFr ? "Campagne lancée !" : "Campaign launched!"}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-white border border-emerald-100 py-3">
                      <p className="text-2xl font-bold text-emerald-700">{launchResult.sent}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{isFr ? "Envoyés" : "Sent"}</p>
                    </div>
                    <div className="rounded-lg bg-white border border-amber-100 py-3">
                      <p className="text-2xl font-bold text-amber-600">{launchResult.skipped}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{isFr ? "Ignorés" : "Skipped"}</p>
                    </div>
                    <div className="rounded-lg bg-white border border-red-100 py-3">
                      <p className="text-2xl font-bold text-red-500">{launchResult.errors}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{isFr ? "Erreurs" : "Errors"}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── History Tab ───────────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <div>
          {historyLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-16">
              {isFr ? "Aucune campagne lancée pour l'instant." : "No campaigns launched yet."}
            </p>
          ) : (
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
                  <p className="text-sm font-medium">
                    {new Date(h.campaign_date).toLocaleDateString("fr-FR", {
                      weekday: "short", day: "numeric", month: "long", year: "numeric",
                    })}
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-emerald-600 font-semibold">{h.sent} {isFr ? "envoyés" : "sent"}</span>
                    <span className="text-muted-foreground">{Math.max(0, h.total - h.sent)} {isFr ? "ignorés" : "skipped"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Confirmation modal ─────────────────────────────────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isFr ? "Confirmer la campagne" : "Confirm campaign"}</DialogTitle>
            <DialogDescription>
              {isFr
                ? `Vous allez envoyer ${activeClients.length} messages WhatsApp personnalisés. Cette action ne peut pas être annulée.`
                : `You are about to send ${activeClients.length} personalised WhatsApp messages. This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {isFr ? "Annuler" : "Cancel"}
            </Button>
            <Button onClick={handleLaunch} className="bg-green-600 hover:bg-green-700 text-white">
              <Send className="h-4 w-4 mr-2" />
              {isFr ? "Confirmer et envoyer" : "Confirm and send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AdminLayout>
  );
}
