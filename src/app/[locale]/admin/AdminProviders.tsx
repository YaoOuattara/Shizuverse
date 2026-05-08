"use client";
/**
 * Admin Providers Page
 * 
 * Providers list with verification status management, status chips, and detail drawer.
 * Uses centralized admin store.
 */

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import AdminLayout from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Star,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  Pause,
  Play,
  User,
  Loader2,
  Banknote,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Clock,
  Shield,
  Eye,
  EyeOff,
  FileText,
  Camera,
  Users,
  XCircle,
  AlertTriangle,
  Sparkles,
  Pencil,
  X,
  Plus,
  Lock,
  ChevronDown,
} from "lucide-react";
import { type AdminProvider, type VerificationStatus } from "@/data/adminStore";
import { COMMUNES } from "@/components/CommuneAutocomplete";
import { useAdminProviders, type ApiProvider } from "@/hooks/useAdminApi";
import { adminApi } from "@/lib/api";
import { formatMoney } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";

type VerificationFilterTab = 'all' | 'submitted' | 'approved' | 'rejected' | 'suspended';

const VERIFICATION_TAB_LABELS: Record<VerificationFilterTab, { fr: string; en: string }> = {
  all:       { fr: 'Tous',       en: 'All'       },
  submitted: { fr: 'Soumis',     en: 'Submitted' },
  approved:  { fr: 'Approuvés',  en: 'Approved'  },
  rejected:  { fr: 'Refusés',    en: 'Rejected'  },
  suspended: { fr: 'Suspendus',  en: 'Suspended' },
};

const verificationTabsDef: { value: VerificationFilterTab; icon: typeof Shield }[] = [
  { value: 'all',       icon: User       },
  { value: 'submitted', icon: Clock      },
  { value: 'approved',  icon: ShieldCheck },
  { value: 'rejected',  icon: ShieldX    },
  { value: 'suspended', icon: ShieldAlert },
];

const REJECTION_REASON_KEYS = [
  'missing_id',
  'name_mismatch',
  'unsupported_zone',
  'insufficient_experience',
  'no_pricing',
  'incomplete_profile',
  'duplicate_account',
  'other',
] as const;

const getSuspensionReasons = (isFr: boolean) => [
  { value: 'customer_complaints', label: isFr ? 'Plaintes clients multiples' : 'Multiple Customer Complaints' },
  { value: 'policy_violation',    label: isFr ? 'Violation des règles'        : 'Policy Violation' },
  { value: 'quality_issues',      label: isFr ? 'Problèmes de qualité'        : 'Service Quality Issues' },
  { value: 'fraud_suspected',     label: isFr ? 'Activité frauduleuse suspectée' : 'Suspected Fraudulent Activity' },
  { value: 'inactive',            label: isFr ? 'Inactivité prolongée'        : 'Extended Inactivity' },
  { value: 'other',               label: isFr ? 'Autre raison'                : 'Other Reason' },
];

const getVerificationBadge = (status: VerificationStatus, isFr: boolean) => {
  const styles: Record<VerificationStatus, string> = {
    draft: "bg-muted text-muted-foreground",
    submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    suspended: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  };
  const labels: Record<VerificationStatus, { fr: string; en: string }> = {
    draft:     { fr: "Brouillon",  en: "Draft"     },
    submitted: { fr: "Soumis",     en: "Submitted" },
    approved:  { fr: "Approuvé",   en: "Approved"  },
    rejected:  { fr: "Refusé",     en: "Rejected"  },
    suspended: { fr: "Suspendu",   en: "Suspended" },
  };
  return (
    <Badge className={styles[status]}>
      {labels[status][isFr ? 'fr' : 'en']}
    </Badge>
  );
};

export default function AdminProviders() {
  const { toast } = useToast();
  const params = useParams();
  const isFr = (params?.locale as string) === 'fr';
  const t = useTranslations("adminProviders");
  const rejectionReasons = REJECTION_REASON_KEYS.map((key) => ({
    value: key,
    label: t(`rejectionReasons.${key}`),
  }));
  const suspensionReasons = getSuspensionReasons(isFr);
  const { providers: apiProviders, loading: providersLoading } = useAdminProviders();
  const [localProviders, setLocalProviders] = useState<AdminProvider[]>([]);

  useEffect(() => {
    setLocalProviders(
      apiProviders.map((p: ApiProvider): AdminProvider => ({
        id: String(p.id),
        name: p.company_name || p.name || `Provider #${p.id}`,
        email: p.email || "",
        phone: p.phone_number || "",
        services: p.services || [],
        serviceArea: p.address || "",
        rating: 0,
        reviewCount: 0,
        status: (p.provider_status === "active" ? "active" : "paused") as "active" | "paused",
        joinedAt: p.created_at || "",
        totalBookings: 0,
        completedBookings: 0,
        revenue: 0,
        verificationStatus: (p.verification_status || (p.verified ? "approved" : "submitted")) as import("@/data/adminStore").VerificationStatus,
        listed: p.listed_status === "listed" || p.verified === true,
        submittedAt: p.submitted_at || undefined,
        reviewedAt: p.reviewed_at || undefined,
        rejectionReason: p.rejection_reason || undefined,
        hasIdProof: !!p.id_document_url,
        hasWorkPhoto: !!p.experience_photo_url,
        hasReference: false,
        idDocumentUrl: p.id_document_url || undefined,
        profilePhotoUrl: p.profile_photo_url || undefined,
        experiencePhotoUrl: p.experience_photo_url || undefined,
      }))
    );
  }, [apiProviders]);

  const providers = localProviders;
  
  const [searchQuery, setSearchQuery] = useState("");
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilterTab>("all");
  const [categoryFilter, setCategoryFilter] = useState("__all__");
  const [zoneFilter, setZoneFilter] = useState("__all__");
  const [selectedProvider, setSelectedProvider] = useState<AdminProvider | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("missing_id");
  const [customRejectionNote, setCustomRejectionNote] = useState("");
  
  // Modal states
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState("customer_complaints");
  const [suspensionNote, setSuspensionNote] = useState("");
  const [unlistModalOpen, setUnlistModalOpen] = useState(false);
  const [unlistReason, setUnlistReason] = useState("");
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  // Preserves the provider ID when a Dialog opens on top of the Sheet
  // (the Sheet's onOpenChange fires and clears selectedProvider)
  const [pendingActionProviderId, setPendingActionProviderId] = useState<string | null>(null);

  // Reset password state
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [resetPwNew, setResetPwNew] = useState('');
  const [resetPwSaving, setResetPwSaving] = useState(false);
  const [resetPwMsg, setResetPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const tabCounts = useMemo(() => {
    return {
      all: providers.length,
      submitted: providers.filter(p => p.verificationStatus === 'submitted').length,
      approved: providers.filter(p => p.verificationStatus === 'approved').length,
      rejected: providers.filter(p => p.verificationStatus === 'rejected').length,
      suspended: providers.filter(p => p.verificationStatus === 'suspended').length,
    };
  }, [providers]);

  const isJunk = (v: string) => {
    const t = v.trim().toLowerCase();
    return t.length < 3 || ['test', 'xxx', 'aaa', 'bbb', 'n/a', 'na'].includes(t);
  };

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    providers.forEach(p => p.services.forEach(s => { if (s && s.trim() !== "" && !isJunk(s)) cats.add(s.trim()); }));
    return Array.from(cats).sort();
  }, [providers]);

  // Only show communes that actually appear in at least one provider's serviceArea
  const allZones = useMemo(() => {
    return COMMUNES.filter(commune =>
      !isJunk(commune) &&
      providers.some(p =>
        p.serviceArea?.toLowerCase().includes(commune.toLowerCase())
      )
    ).sort();
  }, [providers]);

  const hasActiveFilters = searchQuery !== "" || verificationFilter !== "all" || categoryFilter !== "__all__" || zoneFilter !== "__all__";

  const filteredProviders = useMemo(() => {
    return providers.filter((provider) => {
      const matchesSearch =
        searchQuery === "" ||
        provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        provider.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        provider.services.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesVerification =
        verificationFilter === "all" ||
        provider.verificationStatus === verificationFilter;

      const matchesCategory =
        categoryFilter === "__all__" ||
        provider.services.some(s => s === categoryFilter);

      const matchesZone =
        zoneFilter === "__all__" ||
        provider.serviceArea?.toLowerCase().includes(zoneFilter.toLowerCase());

      return matchesSearch && matchesVerification && matchesCategory && matchesZone;
    });
  }, [providers, searchQuery, verificationFilter, categoryFilter, zoneFilter]);

  const updateLocalProvider = (id: string, patch: Partial<AdminProvider>) => {
    setLocalProviders(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    setSelectedProvider(prev => prev?.id === id ? { ...prev, ...patch } : prev);
  };

  const handleToggleStatus = async (providerId: string, currentStatus: AdminProvider["status"]) => {
    setIsUpdating(true);
    const action = currentStatus === "active" ? "pause" : "activate";
    const newStatus = action === "activate" ? "active" : "paused";
    updateLocalProvider(providerId, { status: newStatus });
    try {
      const res = await adminApi.portalToggleActivation(Number(providerId), action);
      console.log("[AdminProviders] toggleStatus response:", res);
      toast({ title: isFr ? "Statut mis à jour" : "Status Updated", description: isFr ? `Prestataire maintenant ${newStatus === "active" ? "actif" : "en pause"}.` : `Provider is now ${newStatus}.` });
    } catch (err) {
      updateLocalProvider(providerId, { status: currentStatus });
      console.error("Failed to update status:", err);
      toast({ title: isFr ? "Erreur" : "Error", description: isFr ? "Impossible de mettre à jour le statut du prestataire." : "Failed to update provider status.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApprove = async (providerId: string) => {
    setIsUpdating(true);
    try {
      const res = await adminApi.portalApproveProvider(Number(providerId));
      console.log("[AdminProviders] approve response:", res);
      updateLocalProvider(providerId, {
        verificationStatus: 'approved',
        listed: true,
        status: 'active',
        reviewedAt: new Date().toISOString().split('T')[0],
      });
      toast({ title: isFr ? "Prestataire approuvé" : "Provider Approved", description: isFr ? "Le prestataire a été approuvé et listé." : "Provider has been approved and listed." });
    } catch (err: unknown) {
      console.error("Failed to approve provider:", err);
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("422") || msg.includes("identit")) {
        toast({
          title: isFr ? "Document requis" : "Document Required",
          description: isFr
            ? "Ce prestataire beauté doit télécharger une pièce d'identité avant d'être approuvé."
            : "This beauty provider must upload an ID document before approval.",
          variant: "destructive",
        });
      } else {
        toast({ title: isFr ? "Erreur" : "Error", description: isFr ? "Impossible d'approuver le prestataire." : "Failed to approve provider.", variant: "destructive" });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReject = async (providerId: string) => {
    setIsUpdating(true);
    const fullReason = rejectionReasons.find(r => r.value === rejectionReason)?.label || rejectionReason;
    try {
      const res = await adminApi.portalRejectProvider(Number(providerId), fullReason, customRejectionNote || undefined);
      console.log("[AdminProviders] reject response:", res);
      updateLocalProvider(providerId, {
        verificationStatus: 'rejected',
        listed: false,
        reviewedAt: new Date().toISOString().split('T')[0],
        rejectionReason: customRejectionNote ? `${fullReason}: ${customRejectionNote}` : fullReason,
      });
      toast({ title: isFr ? "Candidature refusée" : "Application Rejected", description: isFr ? "La candidature du prestataire a été refusée." : "Provider application has been rejected.", variant: "destructive" });
      setCustomRejectionNote("");
    } catch (err) {
      console.error("Failed to reject provider:", err);
      toast({ title: isFr ? "Erreur" : "Error", description: isFr ? "Impossible de refuser le prestataire." : "Failed to reject provider.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSuspend = async () => {
    const idToSuspend = pendingActionProviderId ?? selectedProvider?.id;
    if (!idToSuspend) return;
    setIsUpdating(true);
    const fullReason = suspensionNote
      ? `${suspensionReasons.find(r => r.value === suspensionReason)?.label}: ${suspensionNote}`
      : suspensionReasons.find(r => r.value === suspensionReason)?.label || suspensionReason;
    try {
      const res = await adminApi.portalSuspendProvider(Number(idToSuspend), fullReason);
      console.log("[AdminProviders] suspend response:", res);
      updateLocalProvider(idToSuspend, {
        verificationStatus: 'suspended',
        listed: false,
        status: 'paused',
        reviewedAt: new Date().toISOString().split('T')[0],
        rejectionReason: fullReason,
      });
      toast({ title: isFr ? "Prestataire suspendu" : "Provider Suspended", description: isFr ? "Le prestataire a été suspendu." : "Provider has been suspended.", variant: "destructive" });
      setSuspendModalOpen(false);
      setSuspensionNote("");
      setPendingActionProviderId(null);
    } catch (err) {
      console.error("Failed to suspend provider:", err);
      toast({ title: isFr ? "Erreur" : "Error", description: isFr ? "Impossible de suspendre le prestataire." : "Failed to suspend provider.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleListed = async (providerId: string, currentListed: boolean) => {
    if (currentListed) {
      setPendingActionProviderId(providerId);
      setUnlistReason("");
      setUnlistModalOpen(true);
      return;
    }
    setIsUpdating(true);
    updateLocalProvider(providerId, { listed: true });
    try {
      const res = await adminApi.portalToggleListing(Number(providerId), "list");
      console.log("[AdminProviders] toggleListed(list) response:", res);
      toast({ title: isFr ? "Prestataire listé" : "Provider Listed", description: isFr ? "Le prestataire est maintenant visible aux clients." : "Provider is now visible to clients." });
    } catch (err) {
      updateLocalProvider(providerId, { listed: false });
      console.error("Failed to list provider:", err);
      toast({ title: isFr ? "Erreur" : "Error", description: isFr ? "Impossible de lister le prestataire." : "Failed to list provider.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUnlist = async () => {
    const idToUnlist = pendingActionProviderId ?? selectedProvider?.id;
    if (!idToUnlist) return;
    setIsUpdating(true);
    updateLocalProvider(idToUnlist, { listed: false });
    setUnlistModalOpen(false);
    setUnlistReason("");
    setPendingActionProviderId(null);
    try {
      const unlistRes = await adminApi.portalToggleListing(Number(idToUnlist), "unlist");
      console.log("[AdminProviders] toggleListed(unlist) response:", unlistRes);
      toast({
        title: isFr ? "Prestataire délisté" : "Provider Unlisted",
        description: unlistReason
          ? (isFr ? `Prestataire masqué. Raison : ${unlistReason}` : `Provider hidden. Reason: ${unlistReason}`)
          : (isFr ? "Le prestataire est maintenant masqué aux clients." : "Provider is now hidden from clients."),
      });
    } catch (err) {
      updateLocalProvider(idToUnlist, { listed: true });
      console.error("Failed to unlist provider:", err);
      toast({ title: isFr ? "Erreur" : "Error", description: isFr ? "Impossible de délister le prestataire." : "Failed to unlist provider.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleGenerateRejectionMessage = async () => {
    if (!selectedProvider || isGeneratingMessage) return;
    setIsGeneratingMessage(true);
    const fullReason = rejectionReasons.find(r => r.value === rejectionReason)?.label || rejectionReason;
    try {
      const res = await fetch("/api/smart-rejection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_name: selectedProvider.name,
          rejection_reason: fullReason,
          language: "fr",
        }),
      });
      const data = await res.json();
      if (data.message) setCustomRejectionNote(data.message);
    } catch (err) {
      console.error("[smart-rejection]", err);
      toast({ title: "Erreur IA", description: "Impossible de générer le message.", variant: "destructive" });
    } finally {
      setIsGeneratingMessage(false);
    }
  };

  const openSuspendModal = () => {
    if (selectedProvider) setPendingActionProviderId(selectedProvider.id);
    setSuspensionReason("customer_complaints");
    setSuspensionNote("");
    setSuspendModalOpen(true);
  };

  // ── Provider reviews state ────────────────────────────────────────────────
  const [providerReviews, setProviderReviews] = useState<{
    id: number; client_name: string; rating: number; comment: string; is_published: boolean; created_at: string;
  }[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  useEffect(() => {
    if (!selectedProvider) return;
    const base = process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com";
    const token = typeof window !== "undefined" ? localStorage.getItem("shizu_admin_token") : null;
    setReviewsLoading(true);
    fetch(`${base}/api/admin/providers/${selectedProvider.id}/reviews`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setProviderReviews(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  }, [selectedProvider?.id]);

  const handleUnpublishReview = async (reviewId: number) => {
    const base = process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com";
    const token = typeof window !== "undefined" ? localStorage.getItem("shizu_admin_token") : null;
    await fetch(`${base}/api/admin/reviews/${reviewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_published: false }),
    });
    setProviderReviews(prev => prev.map(r => r.id === reviewId ? { ...r, is_published: false } : r));
  };

  // ── Edit services state ───────────────────────────────────────────────────
  const [editServicesMode, setEditServicesMode] = useState(false);
  const [editingServices, setEditingServices] = useState<string[]>([]);
  const [serviceAddValue, setServiceAddValue] = useState("");
  const [isSavingServices, setIsSavingServices] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // ── Edit zones state ──────────────────────────────────────────────────────
  const [editZonesMode, setEditZonesMode] = useState(false);
  const [editingZones, setEditingZones] = useState<string[]>([]);
  const [isSavingZones, setIsSavingZones] = useState(false);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com";
    fetch(`${base}/api/services/categories`)
      .then((r) => r.json())
      .then((data: Array<{ name_fr?: string; name: string }>) =>
        setAvailableCategories(data.map((c) => c.name_fr || c.name).sort())
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    setEditServicesMode(false);
    setEditingServices([]);
    setServiceAddValue("");
    setEditZonesMode(false);
    setEditingZones([]);
  }, [selectedProvider?.id]);

  const handleSaveServices = async (providerId: string) => {
    setIsSavingServices(true);
    try {
      await adminApi.patchProviderServices(Number(providerId), editingServices);
      updateLocalProvider(providerId, { services: [...editingServices] });
      setEditServicesMode(false);
      toast({
        title: isFr ? "Services mis à jour" : "Services Updated",
        description: isFr ? "La liste des services a été mise à jour." : "Service list has been updated.",
      });
    } catch (err) {
      console.error("Failed to update services:", err);
      toast({ title: isFr ? "Erreur" : "Error", description: isFr ? "Impossible de mettre à jour les services." : "Failed to update services.", variant: "destructive" });
    } finally {
      setIsSavingServices(false);
    }
  };

  const handleSaveZones = async (providerId: string) => {
    setIsSavingZones(true);
    try {
      await adminApi.portalUpdateZones(Number(providerId), editingZones);
      updateLocalProvider(providerId, { serviceArea: editingZones.join(', ') });
      setEditZonesMode(false);
      toast({
        title: isFr ? "Zones mises à jour" : "Zones Updated",
        description: isFr ? "Les zones d'intervention ont été mises à jour." : "Service zones have been updated.",
      });
    } catch (err) {
      console.error("Failed to update zones:", err);
      toast({ title: isFr ? "Erreur" : "Error", description: isFr ? "Impossible de mettre à jour les zones." : "Failed to update zones.", variant: "destructive" });
    } finally {
      setIsSavingZones(false);
    }
  };

  const handleResetProviderPassword = async () => {
    if (!selectedProvider || resetPwSaving) return;
    setResetPwSaving(true);
    setResetPwMsg(null);
    const base = process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com";
    const token = typeof window !== "undefined" ? localStorage.getItem("shizu_admin_token") : null;
    try {
      const res = await fetch(`${base}/api/admin/providers/${selectedProvider.id}/reset-password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ new_password: resetPwNew }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setResetPwMsg({ type: 'success', text: isFr ? 'Mot de passe réinitialisé.' : 'Password reset successfully.' });
        setResetPwNew('');
      } else {
        setResetPwMsg({ type: 'error', text: data?.error ?? (isFr ? 'Erreur.' : 'Error.') });
      }
    } catch {
      setResetPwMsg({ type: 'error', text: isFr ? 'Erreur réseau.' : 'Network error.' });
    } finally {
      setResetPwSaving(false);
    }
  };

  return (
    <AdminLayout title={isFr ? "Prestataires" : "Providers"}>
      <div className="space-y-4">
        {/* Verification Status Tabs */}
        <ScrollArea className="w-full">
          <div className="flex gap-1 pb-2" data-testid="verification-tabs">
            {verificationTabsDef.map(({ value, icon: Icon }) => (
              <Button
                key={value}
                variant={verificationFilter === value ? "default" : "outline"}
                size="sm"
                onClick={() => setVerificationFilter(value)}
                className="shrink-0"
                data-testid={`tab-${value}`}
              >
                <Icon className="h-4 w-4 mr-1.5" />
                {VERIFICATION_TAB_LABELS[value][isFr ? 'fr' : 'en']}
                {tabCounts[value] > 0 && (
                  <span className="ml-1.5 text-xs bg-background/20 px-1.5 py-0.5 rounded-full">
                    {tabCounts[value]}
                  </span>
                )}
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Search + Category + Zone Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={isFr ? "Rechercher par nom, email ou service..." : "Search providers by name, email, or service..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-providers"
                />
              </div>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-48" data-testid="select-category-filter">
                  <SelectValue placeholder={isFr ? "Catégorie" : "Category"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{isFr ? "Toutes les catégories" : "All categories"}</SelectItem>
                  {allCategories.filter(cat => cat && cat.trim() !== "").map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={zoneFilter} onValueChange={setZoneFilter}>
                <SelectTrigger className="w-full sm:w-44" data-testid="select-zone-filter">
                  <SelectValue placeholder={isFr ? "Zone / Commune" : "Zone / Commune"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{isFr ? "Toutes les zones" : "All zones"}</SelectItem>
                  {(allZones.length > 0 ? allZones : COMMUNES).filter(z => z && z.trim() !== "").map(commune => (
                    <SelectItem key={commune} value={commune}>{commune}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setVerificationFilter("all");
                    setCategoryFilter("__all__");
                    setZoneFilter("__all__");
                  }}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  data-testid="button-reset-filters"
                >
                  {isFr ? "Réinitialiser" : "Reset"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Providers List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {isFr ? `Prestataires (${filteredProviders.length})` : `Providers (${filteredProviders.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {providersLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
                <p>{isFr ? "Chargement des prestataires..." : "Loading providers..."}</p>
              </div>
            ) : filteredProviders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{isFr ? "Aucun prestataire trouvé" : "No providers found"}</p>
              </div>
            ) : (
              <div className="divide-y" data-testid="providers-list">
                {filteredProviders.map((provider) => (
                  <button
                    key={provider.id}
                    className="w-full p-3 hover-elevate text-left"
                    onClick={() => setSelectedProvider(provider)}
                    data-testid={`provider-row-${provider.id}`}
                  >
                    <div className="space-y-2">
                      {/* Name & Rating */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{provider.name}</p>
                          <div className="flex items-center gap-0.5 text-sm">
                            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                            <span className="text-muted-foreground">{provider.rating || "-"}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Service Area */}
                      <p className="text-xs text-muted-foreground">{provider.serviceArea}</p>
                      
                      {/* Status Chips Row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Beauty gate warning badge */}
                        {provider.services.some(s => /beaut/i.test(s)) && !provider.idDocumentUrl && (
                          <Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {isFr ? "Vérif. renforcée" : "Enhanced check"}
                          </Badge>
                        )}
                        {/* Verification Status */}
                        {getVerificationBadge(provider.verificationStatus, isFr)}
                        
                        {/* Listed Status (only for approved) */}
                        {provider.verificationStatus === 'approved' && (
                          <Badge 
                            variant="outline"
                            className={`text-xs ${provider.listed 
                              ? "border-emerald-500/50 text-emerald-700 dark:text-emerald-400"
                              : "border-muted"
                            }`}
                          >
                            {provider.listed ? (
                              <><Eye className="h-3 w-3 mr-1" />{isFr ? "Listé" : "Listed"}</>
                            ) : (
                              <><EyeOff className="h-3 w-3 mr-1" />{isFr ? "Délisté" : "Unlisted"}</>
                            )}
                          </Badge>
                        )}
                        
                        {/* Operational Status */}
                        <Badge 
                          className={`text-xs ${provider.status === "active" 
                            ? "bg-emerald-100/50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
                            : "bg-amber-100/50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
                          }`}
                        >
                          {provider.status === "active" ? (isFr ? "Actif" : "Active") : (isFr ? "En pause" : "Paused")}
                        </Badge>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Provider Detail Sheet */}
      <Sheet open={!!selectedProvider} onOpenChange={(open) => !open && setSelectedProvider(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isFr ? "Détails du prestataire" : "Provider Details"}</SheetTitle>
            <SheetDescription>
              ID: {selectedProvider?.id}
            </SheetDescription>
          </SheetHeader>

          {selectedProvider && (
            <div className="space-y-6 mt-6">
              {/* Status Chips */}
              <div className="flex items-center gap-2 flex-wrap">
                {getVerificationBadge(selectedProvider.verificationStatus, isFr)}
                {selectedProvider.verificationStatus === 'approved' && (
                  <Badge 
                    variant="outline"
                    className={selectedProvider.listed 
                      ? "border-emerald-500 text-emerald-700 dark:text-emerald-400"
                      : "border-muted"
                    }
                  >
                    {selectedProvider.listed ? (
                      <><Eye className="h-3 w-3 mr-1" />{isFr ? "Listé" : "Listed"}</>
                    ) : (
                      <><EyeOff className="h-3 w-3 mr-1" />{isFr ? "Délisté" : "Unlisted"}</>
                    )}
                  </Badge>
                )}
                <Badge 
                  className={selectedProvider.status === "active" 
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                  }
                >
                  {selectedProvider.status === "active" ? (isFr ? "Actif" : "Active") : (isFr ? "En pause" : "Paused")}
                </Badge>
              </div>

              {/* Rejection Reason (if applicable) */}
              {selectedProvider.verificationStatus === 'rejected' && selectedProvider.rejectionReason && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    {isFr ? "Raison du refus" : "Rejection Reason"}
                  </h4>
                  <p className="text-sm bg-red-50 dark:bg-red-950/30 p-3 rounded-md">
                    {selectedProvider.rejectionReason}
                  </p>
                </div>
              )}

              {/* Documents soumis */}
              {(() => {
                const hasProfile    = !!selectedProvider.profilePhotoUrl;
                const hasId         = !!selectedProvider.idDocumentUrl;
                const hasExperience = !!selectedProvider.experiencePhotoUrl;
                const docCount      = [hasProfile, hasId, hasExperience].filter(Boolean).length;
                const isBeautyProvider = selectedProvider.services.some(s => /beaut/i.test(s));

                const MissingBadge = ({ required }: { required?: boolean }) =>
                  required ? (
                    <span className="text-xs text-red-600 font-medium">
                      🔴 {isFr ? "Requis — non soumis" : "Required — not submitted"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                      ⚠ {isFr ? "Manquant" : "Missing"}
                    </span>
                  );

                const isPdf = (url: string) => url.toLowerCase().includes(".pdf");

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm text-muted-foreground">
                        {isFr ? "Documents soumis" : "Submitted Documents"}
                      </h4>
                      <span className="text-xs text-muted-foreground">
                        {docCount}/3 {isFr ? "fournis" : "provided"}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {/* Profile photo */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          📷 {isFr ? "Photo de profil" : "Profile photo"}
                        </p>
                        {hasProfile ? (
                          <img
                            src={selectedProvider.profilePhotoUrl}
                            alt="Profile"
                            className="w-20 h-20 rounded-full object-cover border border-border"
                          />
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground border border-border shrink-0">
                              {selectedProvider.name.slice(0, 2).toUpperCase()}
                            </div>
                            <MissingBadge />
                          </div>
                        )}
                      </div>

                      {/* ID document */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          🪪 {isFr ? "Pièce d'identité" : "ID document"}
                        </p>
                        {hasId ? (
                          isPdf(selectedProvider.idDocumentUrl!) ? (
                            <a
                              href={selectedProvider.idDocumentUrl!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs text-blue-600 hover:underline border border-border rounded-lg p-2 w-fit"
                            >
                              <FileText className="h-5 w-5 text-red-500" />
                              {isFr ? "Voir le document" : "View document"}
                            </a>
                          ) : (
                            <a href={selectedProvider.idDocumentUrl!} target="_blank" rel="noopener noreferrer">
                              <img
                                src={selectedProvider.idDocumentUrl!}
                                alt="ID document"
                                className="w-36 h-24 object-cover rounded-lg border border-border hover:opacity-80 transition-opacity cursor-pointer"
                              />
                            </a>
                          )
                        ) : (
                          <MissingBadge required={isBeautyProvider} />
                        )}
                      </div>

                      {/* Experience / work photos */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          🖼️ {isFr ? "Photos de travaux" : "Work photos"}
                        </p>
                        {hasExperience ? (
                          <a href={selectedProvider.experiencePhotoUrl!} target="_blank" rel="noopener noreferrer">
                            <img
                              src={selectedProvider.experiencePhotoUrl!}
                              alt="Work photos"
                              className="w-36 h-24 object-cover rounded-lg border border-border hover:opacity-80 transition-opacity cursor-pointer"
                            />
                          </a>
                        ) : (
                          <MissingBadge />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Provider Info */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-muted-foreground">Contact</h4>
                  {selectedProvider.verificationStatus === 'approved' && (
                    <a
                      href={`/fr/provider/${selectedProvider.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-[#0F3A7A] hover:underline"
                    >
                      <Eye className="h-3 w-3" />
                      {isFr ? "Voir la fiche publique" : "View public profile"}
                    </a>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="font-medium text-lg">{selectedProvider.name}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedProvider.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedProvider.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedProvider.serviceArea}</span>
                  </div>
                </div>
              </div>

              {/* Services */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-muted-foreground">
                    {isFr ? "Services" : "Services"}
                  </h4>
                  {!editServicesMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingServices([...selectedProvider.services]);
                        setEditServicesMode(true);
                      }}
                      className="flex items-center gap-1 text-xs text-[#0F3A7A] hover:underline"
                    >
                      <Pencil className="h-3 w-3" />
                      {isFr ? "Éditer les services" : "Edit services"}
                    </button>
                  )}
                </div>

                {!editServicesMode ? (
                  <div className="flex flex-wrap gap-1">
                    {selectedProvider.services.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        {isFr ? "Aucun service" : "No services"}
                      </p>
                    ) : selectedProvider.services.map((service) => (
                      <Badge key={service} variant="secondary" className="text-xs">
                        {service}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Current services as removable chips */}
                    <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
                      {editingServices.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                          {isFr ? "Aucun service sélectionné" : "No services selected"}
                        </p>
                      ) : editingServices.map((svc) => (
                        <Badge key={svc} variant="secondary" className="text-xs flex items-center gap-1 pr-1">
                          {svc}
                          <button
                            type="button"
                            onClick={() => setEditingServices((prev) => prev.filter((s) => s !== svc))}
                            className="ml-0.5 hover:text-red-500 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>

                    {/* Add service dropdown */}
                    <Select
                      value={serviceAddValue}
                      onValueChange={(v) => {
                        if (v && !editingServices.includes(v)) {
                          setEditingServices((prev) => [...prev, v]);
                        }
                        setServiceAddValue("");
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={isFr ? "Ajouter un service…" : "Add a service…"} />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        {(availableCategories.length > 0 ? availableCategories : allCategories)
                          .filter((cat) => !editingServices.includes(cat))
                          .map((cat) => (
                            <SelectItem key={cat} value={cat} className="text-sm">
                              {cat}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>

                    {/* Save / Cancel */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setEditServicesMode(false);
                          setEditingServices([]);
                          setServiceAddValue("");
                        }}
                      >
                        {isFr ? "Annuler" : "Cancel"}
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={isSavingServices}
                        onClick={() => handleSaveServices(selectedProvider.id)}
                      >
                        {isSavingServices ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                        {isFr ? "Enregistrer" : "Save"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Zones */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-muted-foreground">
                    {isFr ? "Zones d'intervention" : "Service Zones"}
                  </h4>
                  {!editZonesMode && (
                    <button
                      type="button"
                      onClick={() => {
                        const current = selectedProvider.serviceArea
                          ? selectedProvider.serviceArea.split(',').map((z: string) => z.trim()).filter(Boolean)
                          : [];
                        setEditingZones(current);
                        setEditZonesMode(true);
                      }}
                      className="flex items-center gap-1 text-xs text-[#0F3A7A] hover:underline"
                    >
                      <Pencil className="h-3 w-3" />
                      {isFr ? "Éditer les zones" : "Edit zones"}
                    </button>
                  )}
                </div>

                {!editZonesMode ? (
                  <div className="flex flex-wrap gap-1">
                    {(!selectedProvider.serviceArea || selectedProvider.serviceArea.trim() === '') ? (
                      <p className="text-xs text-muted-foreground italic">
                        {isFr ? "Aucune zone" : "No zones"}
                      </p>
                    ) : selectedProvider.serviceArea.split(',').map((z: string) => z.trim()).filter(Boolean).map((zone: string) => (
                      <Badge key={zone} variant="outline" className="text-xs">
                        {zone}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto rounded-lg border p-2">
                      {COMMUNES.filter((c: string) => c.trim().length > 2).map((commune: string) => {
                        const active = editingZones.includes(commune);
                        return (
                          <button
                            key={commune}
                            type="button"
                            onClick={() => setEditingZones(prev =>
                              active ? prev.filter(z => z !== commune) : [...prev, commune]
                            )}
                            className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                              active
                                ? 'bg-[#0F3A7A] text-white border-[#0F3A7A]'
                                : 'bg-background text-muted-foreground border-border hover:border-[#0F3A7A]'
                            }`}
                          >
                            {commune}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {editingZones.length} {isFr ? "zone(s) sélectionnée(s)" : "zone(s) selected"}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => { setEditZonesMode(false); setEditingZones([]); }}
                      >
                        {isFr ? "Annuler" : "Cancel"}
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={isSavingZones}
                        onClick={() => handleSaveZones(selectedProvider.id)}
                      >
                        {isSavingZones ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        {isFr ? "Enregistrer" : "Save"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">{isFr ? "Performance" : "Performance"}</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-3 rounded-md bg-muted/50">
                    <Star className="h-4 w-4 mx-auto mb-1 text-amber-500" />
                    <p className="text-lg font-bold">{selectedProvider.rating || "-"}</p>
                    <p className="text-xs text-muted-foreground">{isFr ? "Note" : "Rating"}</p>
                  </div>
                  <div className="text-center p-3 rounded-md bg-muted/50">
                    <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
                    <p className="text-lg font-bold">{selectedProvider.completedBookings}</p>
                    <p className="text-xs text-muted-foreground">{isFr ? "Terminées" : "Completed"}</p>
                  </div>
                  <div className="text-center p-3 rounded-md bg-muted/50">
                    <Banknote className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
                    <p className="text-lg font-bold">{formatMoney(selectedProvider.revenue)}</p>
                    <p className="text-xs text-muted-foreground">{isFr ? "Revenus" : "Revenue"}</p>
                  </div>
                </div>
              </div>

              {/* Reviews */}
              <div className="space-y-3 pt-4 border-t">
                <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-amber-500" />
                  {isFr ? `Avis clients (${providerReviews.length})` : `Reviews (${providerReviews.length})`}
                </h4>
                {reviewsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
                ) : providerReviews.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    {isFr ? "Aucun avis pour ce prestataire." : "No reviews yet."}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {providerReviews.map(r => (
                      <div key={r.id} className={`rounded-lg border p-3 space-y-1 text-sm ${!r.is_published ? "opacity-50 bg-muted/30" : "bg-background"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-xs">{r.client_name}</span>
                          <div className="flex items-center gap-0.5">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} className={`h-3 w-3 ${s <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`} />
                            ))}
                          </div>
                        </div>
                        {r.comment && <p className="text-xs text-muted-foreground line-clamp-2">{r.comment}</p>}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-FR")}</span>
                          {r.is_published ? (
                            <button
                              onClick={() => handleUnpublishReview(r.id)}
                              className="text-[10px] text-red-500 hover:text-red-700 font-medium underline underline-offset-2 transition-colors"
                            >
                              {isFr ? "Dépublier" : "Unpublish"}
                            </button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">{isFr ? "Dépublié" : "Unpublished"}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Timestamps */}
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>{isFr ? "Inscrit :" : "Joined:"} {selectedProvider.joinedAt}</p>
                {selectedProvider.submittedAt && (
                  <p>{isFr ? "Candidature soumise :" : "Application submitted:"} {selectedProvider.submittedAt}</p>
                )}
                {selectedProvider.reviewedAt && (
                  <p>{isFr ? "Dernière révision :" : "Last reviewed:"} {selectedProvider.reviewedAt}</p>
                )}
              </div>

              {/* Verification Actions */}
              {selectedProvider.verificationStatus === 'submitted' && (
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="font-medium text-sm text-muted-foreground">{isFr ? "Examiner la candidature" : "Review Application"}</h4>

                  {/* Beauty gate warning */}
                  {selectedProvider.services.some(s => /beaut/i.test(s)) && !selectedProvider.idDocumentUrl && (
                    <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {isFr
                          ? "Ce prestataire propose des services beauté. Une pièce d'identité est obligatoire avant approbation."
                          : "This provider offers beauty services. An ID document is required before approval."}
                      </p>
                    </div>
                  )}

                  <Button
                    className="w-full"
                    onClick={() => handleApprove(selectedProvider.id)}
                    disabled={isUpdating || (selectedProvider.services.some(s => /beaut/i.test(s)) && !selectedProvider.idDocumentUrl)}
                    data-testid="button-approve"
                  >
                    {isUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 mr-2" />
                    )}
                    {t("approveButton")}
                  </Button>

                  <div className="space-y-2">
                    <Select value={rejectionReason} onValueChange={setRejectionReason}>
                      <SelectTrigger data-testid="select-rejection-reason" className="w-full">
                        <SelectValue placeholder={isFr ? "Choisir un motif de refus" : "Select rejection reason"} />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        sideOffset={4}
                        className="z-[9999] w-[var(--radix-select-trigger-width)] min-w-[280px] overflow-hidden rounded-md border border-border bg-white dark:bg-zinc-900 shadow-xl"
                      >
                        {rejectionReasons.map((reason) => (
                          <SelectItem
                            key={reason.value}
                            value={reason.value}
                            className="cursor-pointer py-3 px-4 text-sm leading-snug focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent"
                          >
                            {reason.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full border-purple-200 text-purple-700 hover:bg-purple-50 gap-2"
                      onClick={handleGenerateRejectionMessage}
                      disabled={isGeneratingMessage || isUpdating}
                      data-testid="button-generate-rejection-message"
                    >
                      {isGeneratingMessage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {isGeneratingMessage ? "Génération..." : "Générer un message"}
                    </Button>

                    <Textarea
                      value={customRejectionNote}
                      onChange={(e) => setCustomRejectionNote(e.target.value)}
                      placeholder="Message de rejet (modifiable)..."
                      rows={4}
                      data-testid="textarea-rejection-note"
                    />
                    
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => handleReject(selectedProvider.id)}
                      disabled={isUpdating}
                      data-testid="button-reject"
                    >
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ShieldX className="h-4 w-4 mr-2" />
                      )}
                      {t("rejectButton")}
                    </Button>
                  </div>
                </div>
              )}

              {/* Approved Provider Actions */}
              {selectedProvider.verificationStatus === 'approved' && (
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="font-medium text-sm text-muted-foreground">{isFr ? "Gérer le prestataire" : "Manage Provider"}</h4>
                  
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleToggleListed(selectedProvider.id, selectedProvider.listed)}
                    disabled={isUpdating}
                    data-testid="button-toggle-listed"
                  >
                    {isUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : selectedProvider.listed ? (
                      <EyeOff className="h-4 w-4 mr-2" />
                    ) : (
                      <Eye className="h-4 w-4 mr-2" />
                    )}
                    {selectedProvider.listed ? t("unlistButton") : (isFr ? "Lister le prestataire" : "List Provider")}
                  </Button>

                  <Button
                    variant={selectedProvider.status === "active" ? "outline" : "default"}
                    className="w-full"
                    onClick={() => handleToggleStatus(selectedProvider.id, selectedProvider.status)}
                    disabled={isUpdating}
                    data-testid="button-toggle-status"
                  >
                    {isUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : selectedProvider.status === "active" ? (
                      <Pause className="h-4 w-4 mr-2" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    {selectedProvider.status === "active" ? t("pauseButton") : t("resumeButton")}
                  </Button>

                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={openSuspendModal}
                    disabled={isUpdating}
                    data-testid="button-suspend"
                  >
                    <ShieldAlert className="h-4 w-4 mr-2" />
                    {t("suspendButton")}
                  </Button>
                </div>
              )}

              {/* Rejected -> Can re-approve */}
              {selectedProvider.verificationStatus === 'rejected' && (
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="font-medium text-sm text-muted-foreground">Actions</h4>
                  {selectedProvider.services.some(s => /beaut/i.test(s)) && !selectedProvider.idDocumentUrl && (
                    <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {isFr
                          ? "Pièce d'identité requise pour les prestataires beauté."
                          : "ID document required for beauty providers."}
                      </p>
                    </div>
                  )}
                  <Button
                    className="w-full"
                    onClick={() => handleApprove(selectedProvider.id)}
                    disabled={isUpdating || (selectedProvider.services.some(s => /beaut/i.test(s)) && !selectedProvider.idDocumentUrl)}
                    data-testid="button-reapprove"
                  >
                    {isUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 mr-2" />
                    )}
                    {t("approveButton")}
                  </Button>
                </div>
              )}

              {/* Suspended -> Can reinstate */}
              {selectedProvider.verificationStatus === 'suspended' && (
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="font-medium text-sm text-muted-foreground">Actions</h4>
                  <Button
                    className="w-full"
                    onClick={async () => {
                      setIsUpdating(true);
                      try {
                        await adminApi.portalReinstateProvider(Number(selectedProvider.id));
                        updateLocalProvider(selectedProvider.id, {
                          verificationStatus: 'approved',
                          listed: true,
                          status: 'active',
                          reviewedAt: new Date().toISOString().split('T')[0],
                        });
                        toast({ title: isFr ? "Prestataire réactivé" : "Provider Reinstated", description: isFr ? "Le prestataire est maintenant actif et listé." : "Provider is now active and listed." });
                      } catch (err) {
                        console.error("Failed to reinstate provider:", err);
                        toast({ title: isFr ? "Erreur" : "Error", description: isFr ? "Impossible de réactiver le prestataire." : "Failed to reinstate provider.", variant: "destructive" });
                      } finally {
                        setIsUpdating(false);
                      }
                    }}
                    disabled={isUpdating}
                    data-testid="button-reinstate"
                  >
                    {isUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 mr-2" />
                    )}
                    {t("reinstateButton")}
                  </Button>
                </div>
              )}
              {/* Reset Password */}
              <div className="rounded-xl border pt-0 mt-4">
                <button
                  type="button"
                  onClick={() => { setResetPwOpen(o => !o); setResetPwMsg(null); }}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors rounded-xl"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Lock className="h-4 w-4" />
                    {isFr ? 'Réinitialiser le mot de passe' : 'Reset password'}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${resetPwOpen ? 'rotate-180' : ''}`} />
                </button>
                {resetPwOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t pt-3">
                    <input
                      type="password"
                      value={resetPwNew}
                      onChange={e => setResetPwNew(e.target.value)}
                      placeholder={isFr ? 'Nouveau mot de passe (min. 6 car.)' : 'New password (min. 6 chars)'}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {resetPwMsg && (
                      <p className={`text-xs font-medium ${resetPwMsg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {resetPwMsg.type === 'success' ? '✓ ' : '✗ '}{resetPwMsg.text}
                      </p>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={handleResetProviderPassword}
                      disabled={resetPwSaving || resetPwNew.length < 6}
                    >
                      {resetPwSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                      {isFr ? 'Réinitialiser' : 'Reset'}
                    </Button>
                  </div>
                )}
              </div>

            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Suspend Provider Modal */}
      <Dialog open={suspendModalOpen} onOpenChange={setSuspendModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isFr ? "Suspendre le prestataire" : "Suspend Provider"}</DialogTitle>
            <DialogDescription>
              {isFr
                ? "Le prestataire sera suspendu et retiré du marketplace. Veuillez indiquer un motif."
                : "This will suspend the provider and remove them from the marketplace. Please provide a reason."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isFr ? "Motif de suspension" : "Suspension Reason"}</Label>
              <Select value={suspensionReason} onValueChange={setSuspensionReason}>
                <SelectTrigger data-testid="select-suspension-reason">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  sideOffset={4}
                  className="z-[9999] w-[var(--radix-select-trigger-width)] min-w-[280px] overflow-hidden rounded-md border border-border bg-white dark:bg-zinc-900 shadow-xl"
                >
                  {suspensionReasons.map((reason) => (
                    <SelectItem
                      key={reason.value}
                      value={reason.value}
                      className="cursor-pointer py-3 px-4 text-sm leading-snug focus:bg-accent focus:text-accent-foreground"
                    >
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="suspension-note">{isFr ? "Notes supplémentaires (optionnel)" : "Additional Notes (optional)"}</Label>
              <Textarea
                id="suspension-note"
                value={suspensionNote}
                onChange={(e) => setSuspensionNote(e.target.value)}
                placeholder={isFr ? "Ajouter des détails sur la suspension..." : "Add details about the suspension..."}
                rows={3}
                data-testid="textarea-suspension-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendModalOpen(false)}>
              {isFr ? "Annuler" : "Cancel"}
            </Button>
            <Button 
              variant="destructive"
              onClick={handleSuspend}
              disabled={isUpdating}
              data-testid="button-confirm-suspend"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("suspendButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlist Provider Modal */}
      <Dialog open={unlistModalOpen} onOpenChange={setUnlistModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("unlistTitle")}</DialogTitle>
            <DialogDescription>
              {t("unlistDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unlist-reason">{isFr ? "Raison (optionnel)" : "Reason (optional)"}</Label>
              <Textarea
                id="unlist-reason"
                value={unlistReason}
                onChange={(e) => setUnlistReason(e.target.value)}
                placeholder={t("unlistReason")}
                rows={3}
                data-testid="textarea-unlist-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlistModalOpen(false)}>
              {isFr ? "Annuler" : "Cancel"}
            </Button>
            <Button
              onClick={handleUnlist}
              disabled={isUpdating}
              data-testid="button-confirm-unlist"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("unlistButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
