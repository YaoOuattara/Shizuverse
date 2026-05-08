"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "../AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Activity, AlertCircle, AlertTriangle, CheckCircle2, RefreshCw, Send, ChevronDown, ChevronUp, Clock, Phone, CreditCard, Scale, TrendingDown, Target } from "lucide-react";
import { adminApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type AnomalyEntry = {
  id: number;
  anomaly_type: string;
  severity: string;
  description: string;
  booking_id: number | null;
  provider_id: number | null;
  detected_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200",
  warning:  "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200",
  info:     "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200",
};

const SEVERITY_LABELS: Record<string, { fr: string; en: string }> = {
  critical: { fr: "Critique",       en: "Critical"  },
  warning:  { fr: "Avertissement",  en: "Warning"   },
  info:     { fr: "Info",           en: "Info"      },
};

const TYPE_LABELS: Record<string, { fr: string; en: string }> = {
  booking_stuck_unassigned:    { fr: "Réservation non assignée",         en: "Unassigned booking"         },
  provider_no_response:        { fr: "Prestataire sans réponse",         en: "Provider no response"       },
  payment_confirmation_delay:  { fr: "Paiement en attente",              en: "Payment pending"            },
  dispute_unresolved:          { fr: "Litige non résolu",                en: "Unresolved dispute"         },
  low_provider_acceptance:     { fr: "Faible taux d'acceptation",        en: "Low acceptance rate"        },
  low_completion_rate:         { fr: "Faible taux de complétion",        en: "Low completion rate"        },
};

function formatDate(iso: string, isFr: boolean) {
  return new Date(iso).toLocaleString(isFr ? "fr-FR" : "en-US", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AnomaliesPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const locale = (params?.locale as string) ?? "fr";
  const isFr = locale === "fr";

  const [tab, setTab] = useState<"current" | "history">("current");
  const [log, setLog] = useState<AnomalyEntry[]>([]);
  const [logLoading, setLogLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [running, setRunning] = useState(false);
  const [liveResults, setLiveResults] = useState<AnomalyEntry[] | null>(null);
  const [resolving, setResolving] = useState<number | null>(null);
  const [checksOpen, setChecksOpen] = useState(false);

  const loadLog = useCallback(async () => {
    setLogLoading(true);
    try {
      const data = await adminApi.anomalyLog();
      setLog(data);
    } catch {
      toast({ title: isFr ? "Erreur de chargement" : "Load error", variant: "destructive" });
    } finally {
      setLogLoading(false);
    }
  }, [isFr, toast]);

  useEffect(() => { loadLog(); }, [loadLog]);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const res = await adminApi.anomalyCheck();
      const items: AnomalyEntry[] = (res.anomalies ?? []).map((a: Record<string, unknown>, i: number) => ({
        id: -(i + 1),
        anomaly_type: a.type as string,
        severity: a.severity as string,
        description: a.description as string,
        booking_id: (a.booking_id as number | null) ?? null,
        provider_id: (a.provider_id as number | null) ?? null,
        detected_at: (a.detected_at as string) ?? new Date().toISOString(),
        resolved_at: null,
        resolved_by: null,
      }));
      setLiveResults(items);
      if (items.length === 0) {
        toast({
          title: isFr ? "Aucune anomalie" : "No anomalies",
          description: isFr ? "La plateforme fonctionne normalement." : "Platform is operating normally.",
        });
      }
    } catch {
      toast({ title: isFr ? "Erreur de vérification" : "Check failed", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await adminApi.anomalyRun();
      toast({
        title: res.detected > 0
          ? (isFr ? `${res.detected} anomalie(s) détectée(s)` : `${res.detected} anomaly(ies) detected`)
          : (isFr ? "Aucune anomalie" : "No anomalies"),
        description: res.alert_sent
          ? (isFr ? "Alerte WhatsApp envoyée à l'admin." : "WhatsApp alert sent to admin.")
          : (isFr ? "SHIZU_ADMIN_PHONE non configuré." : "SHIZU_ADMIN_PHONE not configured."),
      });
      await loadLog();
      setLiveResults(null);
    } catch {
      toast({ title: isFr ? "Erreur" : "Error", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const handleResolve = async (id: number) => {
    setResolving(id);
    try {
      await adminApi.anomalyResolve(id, "admin");
      toast({
        title: isFr ? "Anomalie résolue" : "Anomaly resolved",
      });
      await loadLog();
    } catch {
      toast({ title: isFr ? "Erreur" : "Error", variant: "destructive" });
    } finally {
      setResolving(null);
    }
  };

  const activeAnomalies = log.filter(a => !a.resolved_at);
  const resolvedAnomalies = log.filter(a => !!a.resolved_at);

  const hasCritical = activeAnomalies.some(a => a.severity === 'critical');

  const AnomalyCard = ({ entry, showResolve = false }: { entry: AnomalyEntry; showResolve?: boolean }) => {
    const label = TYPE_LABELS[entry.anomaly_type];
    const sevLabel = SEVERITY_LABELS[entry.severity] ?? { fr: entry.severity, en: entry.severity };
    return (
      <div className={`rounded-lg border p-4 space-y-2 ${SEVERITY_STYLES[entry.severity] ?? ""}`}>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {entry.severity === "critical"
              ? <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              : <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
            <span className="font-medium text-sm">
              {label ? (isFr ? label.fr : label.en) : entry.anomaly_type}
            </span>
            <Badge className={`text-xs border ${SEVERITY_STYLES[entry.severity] ?? ""}`}>
              {isFr ? sevLabel.fr : sevLabel.en}
            </Badge>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {entry.booking_id && entry.booking_id > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => router.push(`/${locale}/admin/bookings`)}
              >
                {isFr ? "Réservation" : "Booking"} #{entry.booking_id}
              </Button>
            )}
            {entry.provider_id && entry.provider_id > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => router.push(`/${locale}/admin/providers`)}
              >
                {isFr ? "Prestataire" : "Provider"} #{entry.provider_id}
              </Button>
            )}
            {showResolve && entry.id > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={resolving === entry.id}
                onClick={() => handleResolve(entry.id)}
              >
                {resolving === entry.id
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : (isFr ? "Résoudre" : "Resolve")}
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm">{entry.description}</p>
        <p className="text-xs text-muted-foreground">
          {isFr ? "Détecté" : "Detected"}: {formatDate(entry.detected_at, isFr)}
          {entry.resolved_at && (
            <> · {isFr ? "Résolu" : "Resolved"}: {formatDate(entry.resolved_at, isFr)}
            {entry.resolved_by ? ` (${entry.resolved_by})` : ""}</>
          )}
        </p>
      </div>
    );
  };

  return (
    <AdminLayout title={isFr ? "Anomalies" : "Anomalies"}>
      <div className="space-y-4">
        {/* Action bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={handleCheck} disabled={checking || running}>
            {checking
              ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
              : <RefreshCw className="h-4 w-4 mr-2" />}
            {isFr ? "Vérifier sans alerter" : "Check (no alert)"}
          </Button>
          <Button onClick={handleRun} disabled={running || checking}>
            {running
              ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
              : <Send className="h-4 w-4 mr-2" />}
            {isFr ? "Lancer vérification complète" : "Run full check + WhatsApp"}
          </Button>
          <Button variant="ghost" size="icon" onClick={loadLog} disabled={logLoading} className="ml-auto">
            <RefreshCw className={`h-4 w-4 ${logLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Collapsible: what the detector monitors */}
        {(() => {
          const checks = [
            {
              icon: <Clock className="h-4 w-4 text-amber-500 shrink-0" />,
              name: isFr ? "Réservations en attente" : "Pending bookings",
              desc: isFr
                ? "Réservations sans prestataire depuis plus de 3h"
                : "Bookings with no provider assigned for more than 3h",
              threshold: isFr ? "Seuil : 3h (critique : 6h)" : "Threshold: 3h (critical: 6h)",
            },
            {
              icon: <Phone className="h-4 w-4 text-orange-500 shrink-0" />,
              name: isFr ? "Réponse prestataire" : "Provider response",
              desc: isFr
                ? "Prestataire assigné mais n'a pas accepté depuis plus de 1h"
                : "Provider assigned but hasn't accepted for more than 1h",
              threshold: isFr ? "Seuil : 1h" : "Threshold: 1h",
            },
            {
              icon: <CreditCard className="h-4 w-4 text-blue-500 shrink-0" />,
              name: isFr ? "Paiement non confirmé" : "Payment unconfirmed",
              desc: isFr
                ? "Client a déclaré payer mais l'admin n'a pas confirmé depuis plus de 24h"
                : "Client declared payment but admin hasn't confirmed for more than 24h",
              threshold: isFr ? "Seuil : 24h" : "Threshold: 24h",
            },
            {
              icon: <Scale className="h-4 w-4 text-red-500 shrink-0" />,
              name: isFr ? "Litige ouvert" : "Open dispute",
              desc: isFr
                ? "Litige ouvert sans résolution depuis plus de 48h"
                : "Dispute open without resolution for more than 48h",
              threshold: isFr ? "Seuil : 48h (toujours critique)" : "Threshold: 48h (always critical)",
            },
            {
              icon: <TrendingDown className="h-4 w-4 text-purple-500 shrink-0" />,
              name: isFr ? "Taux d'acceptation" : "Acceptance rate",
              desc: isFr
                ? "Prestataire avec taux d'acceptation < 50% sur les 7 derniers jours (min 3 réservations)"
                : "Provider with acceptance rate < 50% over the last 7 days (min 3 bookings)",
              threshold: isFr ? "Seuil : 50%" : "Threshold: 50%",
            },
            {
              icon: <Target className="h-4 w-4 text-emerald-500 shrink-0" />,
              name: isFr ? "Taux de complétion" : "Completion rate",
              desc: isFr
                ? "Taux de complétion de la plateforme < 70% cette semaine (min 5 réservations)"
                : "Platform completion rate < 70% this week (min 5 bookings)",
              threshold: isFr ? "Seuil : 70%" : "Threshold: 70%",
            },
          ];
          return (
            <div className="rounded-lg border border-border bg-muted/40">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setChecksOpen(o => !o)}
              >
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  {isFr ? "Vérifications effectuées" : "What the detector monitors"}
                  <span className="text-xs font-normal opacity-60">
                    ({isFr ? "6 contrôles" : "6 checks"})
                  </span>
                </span>
                {checksOpen
                  ? <ChevronUp className="h-4 w-4" />
                  : <ChevronDown className="h-4 w-4" />}
              </button>
              {checksOpen && (
                <div className="border-t border-border divide-y divide-border">
                  {checks.map((c, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3">
                      <div className="mt-0.5">{c.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.desc}</p>
                      </div>
                      <span className="text-xs text-muted-foreground/70 shrink-0 mt-0.5 whitespace-nowrap">
                        {c.threshold}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Live check results */}
        {liveResults !== null && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                {isFr ? "Résultats de la vérification" : "Check results"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {liveResults.length === 0 ? (
                <p className="text-sm text-emerald-600 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {isFr ? "Aucune anomalie détectée." : "No anomalies detected."}
                </p>
              ) : (
                <div className="space-y-2">
                  {liveResults.map((a, i) => <AnomalyCard key={i} entry={a} showResolve={false} />)}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b">
          {(["current", "history"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "current"
                ? (isFr ? `Actives (${activeAnomalies.length})` : `Active (${activeAnomalies.length})`)
                : (isFr ? `Historique (${resolvedAnomalies.length})` : `History (${resolvedAnomalies.length})`)}
            </button>
          ))}
        </div>

        {logLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">{isFr ? "Chargement…" : "Loading…"}</span>
          </div>
        ) : tab === "current" ? (
          activeAnomalies.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-400" />
                <p className="font-medium">{isFr ? "Aucune anomalie active" : "No active anomalies"}</p>
                <p className="text-sm mt-1">
                  {isFr
                    ? "La plateforme fonctionne normalement."
                    : "Platform is operating normally."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {hasCritical && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm dark:bg-red-950/30 dark:border-red-900/40 dark:text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <strong>{isFr ? "Anomalies critiques détectées — action immédiate requise." : "Critical anomalies detected — immediate action required."}</strong>
                </div>
              )}
              {activeAnomalies.map(a => (
                <AnomalyCard key={a.id} entry={a} showResolve />
              ))}
            </div>
          )
        ) : (
          resolvedAnomalies.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p className="text-sm">{isFr ? "Aucun historique disponible." : "No history available."}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {resolvedAnomalies.map(a => (
                <AnomalyCard key={a.id} entry={a} showResolve={false} />
              ))}
            </div>
          )
        )}
      </div>
    </AdminLayout>
  );
}
