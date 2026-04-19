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

const suspensionReasons = [
  { value: 'customer_complaints', label: 'Multiple Customer Complaints' },
  { value: 'policy_violation', label: 'Policy Violation' },
  { value: 'quality_issues', label: 'Service Quality Issues' },
  { value: 'fraud_suspected', label: 'Suspected Fraudulent Activity' },
  { value: 'inactive', label: 'Extended Inactivity' },
  { value: 'other', label: 'Other Reason' },
];

const getVerificationBadge = (status: VerificationStatus) => {
  const styles: Record<VerificationStatus, string> = {
    draft: "bg-muted text-muted-foreground",
    submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    suspended: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  };
  const labels: Record<VerificationStatus, string> = {
    draft: "Draft",
    submitted: "Submitted",
    approved: "Approved",
    rejected: "Rejected",
    suspended: "Suspended",
  };
  return (
    <Badge className={styles[status]}>
      {labels[status]}
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
        hasIdProof: false,
        hasWorkPhoto: false,
        hasReference: false,
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
    try {
      await adminApi.portalToggleActivation(Number(providerId), action);
      updateLocalProvider(providerId, { status: newStatus });
      toast({ title: "Status Updated", description: `Provider is now ${newStatus}.` });
    } catch (err) {
      console.error("Failed to update status:", err);
      toast({ title: "Error", description: "Failed to update provider status.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApprove = async (providerId: string) => {
    setIsUpdating(true);
    try {
      await adminApi.portalApproveProvider(Number(providerId));
      updateLocalProvider(providerId, {
        verificationStatus: 'approved',
        listed: true,
        status: 'active',
        reviewedAt: new Date().toISOString().split('T')[0],
      });
      toast({ title: "Provider Approved", description: "Provider has been approved and listed." });
    } catch (err) {
      console.error("Failed to approve provider:", err);
      toast({ title: "Error", description: "Failed to approve provider.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReject = async (providerId: string) => {
    setIsUpdating(true);
    const fullReason = rejectionReasons.find(r => r.value === rejectionReason)?.label || rejectionReason;
    try {
      await adminApi.portalRejectProvider(Number(providerId), fullReason, customRejectionNote || undefined);
      updateLocalProvider(providerId, {
        verificationStatus: 'rejected',
        listed: false,
        reviewedAt: new Date().toISOString().split('T')[0],
        rejectionReason: customRejectionNote ? `${fullReason}: ${customRejectionNote}` : fullReason,
      });
      toast({ title: "Application Rejected", description: "Provider application has been rejected.", variant: "destructive" });
      setCustomRejectionNote("");
    } catch (err) {
      console.error("Failed to reject provider:", err);
      toast({ title: "Error", description: "Failed to reject provider.", variant: "destructive" });
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
      await adminApi.portalSuspendProvider(Number(idToSuspend), fullReason);
      updateLocalProvider(idToSuspend, {
        verificationStatus: 'suspended',
        listed: false,
        status: 'paused',
        reviewedAt: new Date().toISOString().split('T')[0],
        rejectionReason: fullReason,
      });
      toast({ title: "Provider Suspended", description: `Provider has been suspended.`, variant: "destructive" });
      setSuspendModalOpen(false);
      setSuspensionNote("");
      setPendingActionProviderId(null);
    } catch (err) {
      console.error("Failed to suspend provider:", err);
      toast({ title: "Error", description: "Failed to suspend provider.", variant: "destructive" });
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
    try {
      await adminApi.portalToggleListing(Number(providerId), "list");
      updateLocalProvider(providerId, { listed: true });
      toast({ title: "Provider Listed", description: "Provider is now visible to clients." });
    } catch (err) {
      console.error("Failed to list provider:", err);
      toast({ title: "Error", description: "Failed to list provider.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUnlist = async () => {
    const idToUnlist = pendingActionProviderId ?? selectedProvider?.id;
    if (!idToUnlist) return;
    setIsUpdating(true);
    try {
      await adminApi.portalToggleListing(Number(idToUnlist), "unlist");
      updateLocalProvider(idToUnlist, { listed: false });
      toast({
        title: "Provider Unlisted",
        description: unlistReason ? `Provider hidden. Reason: ${unlistReason}` : "Provider is now hidden from clients.",
      });
      setUnlistModalOpen(false);
      setUnlistReason("");
      setPendingActionProviderId(null);
    } catch (err) {
      console.error("Failed to unlist provider:", err);
      toast({ title: "Error", description: "Failed to unlist provider.", variant: "destructive" });
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
                <p>No providers found</p>
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
                        {/* Verification Status */}
                        {getVerificationBadge(provider.verificationStatus)}
                        
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
                              <><Eye className="h-3 w-3 mr-1" /> Listed</>
                            ) : (
                              <><EyeOff className="h-3 w-3 mr-1" /> Unlisted</>
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
                          {provider.status === "active" ? "Active" : "Paused"}
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
            <SheetTitle>Provider Details</SheetTitle>
            <SheetDescription>
              ID: {selectedProvider?.id}
            </SheetDescription>
          </SheetHeader>

          {selectedProvider && (
            <div className="space-y-6 mt-6">
              {/* Status Chips */}
              <div className="flex items-center gap-2 flex-wrap">
                {getVerificationBadge(selectedProvider.verificationStatus)}
                {selectedProvider.verificationStatus === 'approved' && (
                  <Badge 
                    variant="outline"
                    className={selectedProvider.listed 
                      ? "border-emerald-500 text-emerald-700 dark:text-emerald-400"
                      : "border-muted"
                    }
                  >
                    {selectedProvider.listed ? (
                      <><Eye className="h-3 w-3 mr-1" /> Listed</>
                    ) : (
                      <><EyeOff className="h-3 w-3 mr-1" /> Unlisted</>
                    )}
                  </Badge>
                )}
                <Badge 
                  className={selectedProvider.status === "active" 
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                  }
                >
                  {selectedProvider.status === "active" ? "Active" : "Paused"}
                </Badge>
              </div>

              {/* Rejection Reason (if applicable) */}
              {selectedProvider.verificationStatus === 'rejected' && selectedProvider.rejectionReason && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Rejection Reason
                  </h4>
                  <p className="text-sm bg-red-50 dark:bg-red-950/30 p-3 rounded-md">
                    {selectedProvider.rejectionReason}
                  </p>
                </div>
              )}

              {/* Verification Checklist */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">Verification Documents</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    {selectedProvider.hasIdProof ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className={selectedProvider.hasIdProof ? "" : "text-muted-foreground"}>
                      ID Proof
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {selectedProvider.hasWorkPhoto ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    <span className={selectedProvider.hasWorkPhoto ? "" : "text-muted-foreground"}>
                      Work Photos
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {selectedProvider.hasReference ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className={selectedProvider.hasReference ? "" : "text-muted-foreground"}>
                      References
                    </span>
                  </div>
                </div>
              </div>

              {/* Provider Info */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">Contact</h4>
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
                <h4 className="font-medium text-sm text-muted-foreground">Services</h4>
                <div className="flex flex-wrap gap-1">
                  {selectedProvider.services.map((service) => (
                    <Badge key={service} variant="secondary" className="text-xs">
                      {service}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">Performance</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-3 rounded-md bg-muted/50">
                    <Star className="h-4 w-4 mx-auto mb-1 text-amber-500" />
                    <p className="text-lg font-bold">{selectedProvider.rating || "-"}</p>
                    <p className="text-xs text-muted-foreground">Rating</p>
                  </div>
                  <div className="text-center p-3 rounded-md bg-muted/50">
                    <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
                    <p className="text-lg font-bold">{selectedProvider.completedBookings}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                  <div className="text-center p-3 rounded-md bg-muted/50">
                    <Banknote className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
                    <p className="text-lg font-bold">{formatMoney(selectedProvider.revenue)}</p>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Joined: {selectedProvider.joinedAt}</p>
                {selectedProvider.submittedAt && (
                  <p>Application submitted: {selectedProvider.submittedAt}</p>
                )}
                {selectedProvider.reviewedAt && (
                  <p>Last reviewed: {selectedProvider.reviewedAt}</p>
                )}
              </div>

              {/* Verification Actions */}
              {selectedProvider.verificationStatus === 'submitted' && (
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="font-medium text-sm text-muted-foreground">Review Application</h4>
                  
                  <Button
                    className="w-full"
                    onClick={() => handleApprove(selectedProvider.id)}
                    disabled={isUpdating}
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
                        <SelectValue placeholder="Select rejection reason" />
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
                  <h4 className="font-medium text-sm text-muted-foreground">Manage Provider</h4>
                  
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
                    {selectedProvider.listed ? t("unlistButton") : "List Provider"}
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
                  <Button
                    className="w-full"
                    onClick={() => handleApprove(selectedProvider.id)}
                    disabled={isUpdating}
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
                        toast({ title: "Provider Reinstated", description: "Provider is now active and listed." });
                      } catch (err) {
                        console.error("Failed to reinstate provider:", err);
                        toast({ title: "Error", description: "Failed to reinstate provider.", variant: "destructive" });
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
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Suspend Provider Modal */}
      <Dialog open={suspendModalOpen} onOpenChange={setSuspendModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend Provider</DialogTitle>
            <DialogDescription>
              This will suspend the provider and remove them from the marketplace. Please provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Suspension Reason</Label>
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
              <Label htmlFor="suspension-note">Additional Notes (optional)</Label>
              <Textarea
                id="suspension-note"
                value={suspensionNote}
                onChange={(e) => setSuspensionNote(e.target.value)}
                placeholder="Add details about the suspension..."
                rows={3}
                data-testid="textarea-suspension-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendModalOpen(false)}>
              Cancel
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
              <Label htmlFor="unlist-reason">Reason (optional)</Label>
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
              Cancel
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
