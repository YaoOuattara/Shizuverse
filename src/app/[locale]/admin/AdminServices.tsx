"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import AdminLayout from "./AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Wrench,
  Loader2,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Settings2,
} from "lucide-react";
import { useAdminStore, type AdminService, type PricingRules } from "@/data/adminStore";
import { useAdminServices, type ApiService } from "@/hooks/useAdminApi";
import { adminApi } from "@/lib/api";
import ErrorBanner from "@/components/ErrorBanner";
import { formatPrice } from "@/lib/formatPrice";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/currency";
import {
  DEFAULT_PRICING_RULES,
} from "@/utils/pricingEngine";

interface FormErrors {
  name?: string;
  category?: string;
}

interface CatPricing {
  id: number;
  price_min: number | null;
  price_max: number | null;
  is_quote_based: boolean;
}

interface ApiCategoryPricing {
  id: number;
  name: string;
  name_fr?: string;
  name_en?: string;
  price_min: number | null;
  price_max: number | null;
  is_quote_based: boolean;
}

function adaptApiService(s: ApiService): AdminService {
  return {
    id: String(s.id),
    name: s.name,
    category: s.category ?? "",
    basePrice: s.price ?? 0,
    durationMins: s.duration ?? 60,
    active: s.active,
  };
}

export default function AdminServices() {
  const params = useParams();
  const isFr = ((params?.locale as string) ?? "fr") === "fr";
  const { toast } = useToast();
  const { services: apiServices, loading: servicesLoading, error: servicesError, retry: retryServices } = useAdminServices();
  const { bookings = [] } = useAdminStore();

  const [services, setServices] = useState<AdminService[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Track which category sections are expanded (all open by default)
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  // ── Category indicative pricing (display only) ──────────────────────────
  // Keyed by lowercased category name (name / name_fr / name_en) so we can
  // resolve the pricing entry from the grouping key used in the service list.
  const [catPricing, setCatPricing] = useState<Record<string, CatPricing>>({});
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [catForm, setCatForm] = useState({ price_min: "", price_max: "", is_quote_based: false });
  const [savingCat, setSavingCat] = useState(false);

  // Full category catalogue from the API — the single source for the
  // create/edit dropdown (id + display label), replacing the old hardcoded
  // FORM_CATEGORIES list.
  const [apiCategories, setApiCategories] = useState<ApiCategoryPricing[]>([]);

  useEffect(() => {
    adminApi.getPublicCategories()
      .then((cats: ApiCategoryPricing[]) => {
        setApiCategories(cats);
        const map: Record<string, CatPricing> = {};
        for (const c of cats) {
          const entry: CatPricing = {
            id: c.id,
            price_min: c.price_min ?? null,
            price_max: c.price_max ?? null,
            is_quote_based: !!c.is_quote_based,
          };
          for (const key of [c.name, c.name_fr, c.name_en]) {
            if (key) map[key.toLowerCase()] = entry;
          }
        }
        setCatPricing(map);
      })
      .catch(() => {});
  }, []);

  // Dropdown options: display name_fr (fallback name), value = category id.
  const categoryOptions = useMemo(
    () =>
      apiCategories
        .map(c => ({ id: c.id, label: c.name_fr || c.name }))
        .sort((a, b) => a.label.localeCompare(b.label, "fr")),
    [apiCategories],
  );

  const pricingForCategory = (cat: string): CatPricing | null =>
    catPricing[cat.toLowerCase()] ?? null;

  const openCatPriceEditor = (cat: string) => {
    const p = pricingForCategory(cat);
    setCatForm({
      price_min: p?.price_min != null ? String(p.price_min) : "",
      price_max: p?.price_max != null ? String(p.price_max) : "",
      is_quote_based: p?.is_quote_based ?? false,
    });
    setEditingCat(cat);
  };

  const handleSaveCatPrice = async (cat: string) => {
    const p = pricingForCategory(cat);
    if (!p) return;
    const toNum = (s: string): number | null => {
      const t = s.trim();
      if (t === "") return null;
      const n = Number(t);
      return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
    };
    const body = {
      price_min: catForm.is_quote_based ? null : toNum(catForm.price_min),
      price_max: catForm.is_quote_based ? null : toNum(catForm.price_max),
      is_quote_based: catForm.is_quote_based,
    };
    if (!body.is_quote_based && body.price_min != null && body.price_max != null && body.price_max < body.price_min) {
      toast({ title: isFr ? "Fourchette invalide" : "Invalid range", description: isFr ? "Le max doit être ≥ au min." : "Max must be ≥ min.", variant: "destructive" });
      return;
    }
    setSavingCat(true);
    try {
      const res = await adminApi.patchCategoryPricing(p.id, body) as CatPricing;
      const updated: CatPricing = {
        id: p.id,
        price_min: res.price_min ?? null,
        price_max: res.price_max ?? null,
        is_quote_based: !!res.is_quote_based,
      };
      setCatPricing(prev => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (next[k].id === p.id) next[k] = updated;
        }
        return next;
      });
      setEditingCat(null);
      toast({ title: isFr ? "Prix mis à jour" : "Price updated" });
    } catch {
      toast({ title: isFr ? "Échec de la mise à jour" : "Update failed", variant: "destructive" });
    } finally {
      setSavingCat(false);
    }
  };

  const [editingService, setEditingService] = useState<AdminService | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [formData, setFormData] = useState({
    name: "",
    categoryId: null as number | null,
    category: "",            // display label, for local grouping only
    durationMins: 60,
    basePrice: 100,
    description: "",
    pricingMode: "instant" as "instant" | "range" | "quote_required",
    minPrice: 0,
    maxPrice: 0,
    pricingRules: { ...DEFAULT_PRICING_RULES } as PricingRules,
  });

  useEffect(() => {
    if (Array.isArray(apiServices) && apiServices.length > 0) {
      const mapped = apiServices.map(adaptApiService);
      setServices(mapped);
      if (!initialized) {
        setOpenCategories(new Set(mapped.map(s => s.category).filter(Boolean)));
        setInitialized(true);
      }
    }
  }, [apiServices]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter by search only — category grouping replaces the category filter
  const filteredServices = useMemo(() => {
    if (!searchQuery) return services;
    const q = searchQuery.toLowerCase();
    return services.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q),
    );
  }, [services, searchQuery]);

  // Group filtered services by category
  const grouped = useMemo(() => {
    const map: Record<string, AdminService[]> = {};
    filteredServices.forEach(s => {
      const cat = s.category || (isFr ? "Sans catégorie" : "Uncategorized");
      if (!map[cat]) map[cat] = [];
      map[cat].push(s);
    });
    return map;
  }, [filteredServices, isFr]);

  const categoryKeys = useMemo(
    () => Object.keys(grouped).sort((a, b) => a.localeCompare(b, "fr")),
    [grouped],
  );

  const toggleCategory = (cat: string) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const getServiceBookingCount = (serviceName: string) =>
    bookings.filter(b => b.serviceName === serviceName).length;

  // ── Toggle active — optimistic, calls real API ────────────────────────────
  const handleToggleActive = async (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    const newActive = !service.active;
    setServices(prev =>
      prev.map(s => (s.id === serviceId ? { ...s, active: newActive } : s)),
    );
    try {
      await adminApi.patchService(Number(serviceId), { is_active: newActive });
      toast({
        title: newActive
          ? isFr ? "Service activé" : "Service activated"
          : isFr ? "Service désactivé" : "Service deactivated",
      });
    } catch {
      // Revert on failure
      setServices(prev =>
        prev.map(s => (s.id === serviceId ? { ...s, active: !newActive } : s)),
      );
      toast({
        title: isFr ? "Erreur" : "Error",
        description: isFr ? "Impossible de mettre à jour le service." : "Could not update service.",
        variant: "destructive",
      });
    }
  };

  // ── Form helpers ──────────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    if (!formData.name.trim()) {
      errors.name = isFr ? "Le nom est obligatoire" : "Service name is required";
    } else if (formData.name.trim().length < 3) {
      errors.name = isFr ? "Minimum 3 caractères" : "Name must be at least 3 characters";
    }
    const isDuplicate = services.some(
      s =>
        s.name.toLowerCase() === formData.name.trim().toLowerCase() &&
        s.id !== editingService?.id,
    );
    if (isDuplicate) {
      errors.name = isFr ? "Ce service existe déjà" : "A service with this name already exists";
    }
    // A category id is required to create a service (edit never re-persists it).
    if (!editingService && formData.categoryId == null) {
      errors.category = isFr ? "La catégorie est obligatoire" : "Category is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenCreate = () => {
    setFormData({
      name: "",
      categoryId: null,
      category: "",
      durationMins: 60,
      basePrice: 100,
      description: "",
      pricingMode: "instant",
      minPrice: 0,
      maxPrice: 0,
      pricingRules: { ...DEFAULT_PRICING_RULES },
    });
    setFormErrors({});
    setIsCreating(true);
  };

  const handleOpenEdit = (service: AdminService) => {
    // Resolve the category id from the service's display label (name_fr|name).
    const match = apiCategories.find(
      c => (c.name_fr || c.name).toLowerCase() === service.category.toLowerCase()
        || c.name.toLowerCase() === service.category.toLowerCase(),
    );
    setFormData({
      name: service.name,
      categoryId: match?.id ?? null,
      category: service.category,
      durationMins: service.durationMins,
      basePrice: service.basePrice,
      description: service.description || "",
      pricingMode: service.pricingMode || "instant",
      minPrice: service.minPrice || 0,
      maxPrice: service.maxPrice || 0,
      pricingRules: service.pricingRules || { ...DEFAULT_PRICING_RULES },
    });
    setFormErrors({});
    setEditingService(service);
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast({
        title: isFr ? "Erreur de validation" : "Validation Error",
        description: isFr ? "Corrigez les erreurs dans le formulaire." : "Please fix the errors in the form.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);

    if (editingService) {
      try {
        await adminApi.patchService(Number(editingService.id), { name: formData.name.trim() });
        setServices(prev =>
          prev.map(s =>
            s.id === editingService.id
              ? {
                  ...s,
                  name: formData.name.trim(),
                  category: formData.category,
                  durationMins: formData.durationMins,
                  basePrice: formData.basePrice,
                  description: formData.description.trim(),
                  pricingMode: formData.pricingMode,
                  minPrice: formData.minPrice,
                  maxPrice: formData.maxPrice,
                  pricingRules: formData.pricingRules,
                }
              : s,
          ),
        );
        toast({ title: isFr ? "Service mis à jour" : "Service Updated", description: formData.name });
        setEditingService(null);
      } catch {
        toast({
          title: isFr ? "Erreur" : "Error",
          description: isFr ? "Impossible de mettre à jour le service." : "Could not update service.",
          variant: "destructive",
        });
      }
    } else {
      try {
        const created = await adminApi.createService({
          name: formData.name.trim(),
          category_id: formData.categoryId ?? undefined,
          category: formData.category || undefined,
        }) as { id: number; name: string; category: string; active: boolean };
        const newService: AdminService = {
          id: String(created.id),
          name: created.name,
          // Group under the chosen display label so the new row lands in the
          // same section as existing services (which group by name_fr|name).
          category: formData.category || created.category,
          durationMins: formData.durationMins,
          basePrice: formData.basePrice,
          description: formData.description.trim(),
          active: created.active ?? true,
          pricingMode: formData.pricingMode,
          minPrice: formData.minPrice,
          maxPrice: formData.maxPrice,
          pricingRules: formData.pricingRules,
        };
        setServices(prev => [...prev, newService]);
        setOpenCategories(prev => new Set([...prev, formData.category]));
        toast({ title: isFr ? "Service créé" : "Service Created", description: formData.name });
        setIsCreating(false);
      } catch {
        toast({
          title: isFr ? "Erreur" : "Error",
          description: isFr ? "Impossible de créer le service." : "Could not create service.",
          variant: "destructive",
        });
      }
    }
    setIsSaving(false);
  };

  const handleDeleteClick = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    const bookingCount = getServiceBookingCount(service.name);
    if (bookingCount > 0) {
      toast({
        title: isFr ? "Suppression impossible" : "Cannot Delete Service",
        description: isFr
          ? `Ce service a ${bookingCount} réservation(s). Désactivez-le plutôt.`
          : `This service has ${bookingCount} booking(s). Consider deactivating it instead.`,
        variant: "destructive",
      });
      return;
    }
    setDeleteConfirm(serviceId);
  };

  const handleDelete = async (serviceId: string) => {
    setIsSaving(true);
    try {
      await adminApi.deleteService(Number(serviceId));
      setServices(prev => prev.filter(s => s.id !== serviceId));
      setDeleteConfirm(null);
      toast({ title: isFr ? "Service supprimé" : "Service Deleted" });
    } catch {
      toast({
        title: isFr ? "Erreur" : "Error",
        description: isFr ? "Impossible de supprimer le service." : "Could not delete service.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    const mapped = apiServices.map(adaptApiService);
    setServices(mapped);
    setOpenCategories(new Set(mapped.map(s => s.category).filter(Boolean)));
    setResetConfirm(false);
    toast({ title: isFr ? "Catalogue réinitialisé" : "Catalog Reset" });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AdminLayout title={isFr ? "Services" : "Services"}>
      <div className="space-y-4">
        {servicesError && <ErrorBanner isFr={isFr} onRetry={retryServices} />}

        {/* Search bar + actions */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={isFr ? "Rechercher un service..." : "Search services..."}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleOpenCreate}>
                  <Plus className="h-4 w-4 mr-1" />
                  {isFr ? "Ajouter" : "Add Service"}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setResetConfirm(true)}
                  title={isFr ? "Réinitialiser" : "Reset to defaults"}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grouped category sections */}
        {servicesLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
            <p>{isFr ? "Chargement..." : "Loading services..."}</p>
          </div>
        ) : categoryKeys.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{isFr ? "Aucun service trouvé" : "No services found"}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {categoryKeys.map(cat => {
              const catServices = grouped[cat];
              const isOpen = openCategories.has(cat);
              const activeCount = catServices.filter(s => s.active).length;

              return (
                <Card key={cat} className="overflow-hidden">
                  {/* Category header */}
                  <div className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className="flex-1 flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left min-w-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${
                            isOpen ? "" : "-rotate-90"
                          }`}
                        />
                        <span className="font-semibold text-sm truncate">{cat}</span>
                        <Badge variant="secondary" className="text-xs tabular-nums shrink-0">
                          {catServices.length}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {activeCount}/{catServices.length}{" "}
                        {isFr ? "actif" : "active"}
                      </span>
                    </button>

                    {/* Indicative price + edit trigger (display only) */}
                    <div className="flex items-center gap-2 px-3 shrink-0 border-l">
                      <span className="text-xs font-medium text-[#0F3A7A] whitespace-nowrap hidden sm:block">
                        {formatPrice(pricingForCategory(cat), isFr)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openCatPriceEditor(cat)}
                        disabled={!pricingForCategory(cat)}
                        title={isFr ? "Modifier le prix indicatif" : "Edit indicative price"}
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Inline indicative-price editor */}
                  {editingCat === cat && (
                    <div className="border-t bg-muted/30 px-4 py-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {isFr ? "Prix indicatif (affichage client)" : "Indicative price (client display)"}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{isFr ? "Sur devis" : "On request"}</span>
                          <Switch
                            checked={catForm.is_quote_based}
                            onCheckedChange={(v) => setCatForm(f => ({ ...f, is_quote_based: v }))}
                          />
                        </div>
                      </div>

                      {!catForm.is_quote_based && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number" min={0} inputMode="numeric"
                            placeholder={isFr ? "Min (FCFA)" : "Min (FCFA)"}
                            value={catForm.price_min}
                            onChange={(e) => setCatForm(f => ({ ...f, price_min: e.target.value }))}
                            className="h-9"
                          />
                          <span className="text-muted-foreground">–</span>
                          <Input
                            type="number" min={0} inputMode="numeric"
                            placeholder={isFr ? "Max (vide = plancher)" : "Max (empty = from)"}
                            value={catForm.price_max}
                            onChange={(e) => setCatForm(f => ({ ...f, price_max: e.target.value }))}
                            className="h-9"
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          {isFr ? "Aperçu : " : "Preview: "}
                          <span className="font-medium text-foreground">
                            {formatPrice({
                              price_min: catForm.is_quote_based ? null : (Number(catForm.price_min) || null),
                              price_max: catForm.is_quote_based ? null : (Number(catForm.price_max) || null),
                              is_quote_based: catForm.is_quote_based,
                            }, isFr)}
                          </span>
                        </p>
                        <div className="flex justify-end gap-2 shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => setEditingCat(null)} disabled={savingCat}>
                            {isFr ? "Annuler" : "Cancel"}
                          </Button>
                          <Button size="sm" onClick={() => handleSaveCatPrice(cat)} disabled={savingCat}>
                            {savingCat ? <Loader2 className="h-4 w-4 animate-spin" /> : (isFr ? "Enregistrer" : "Save")}
                          </Button>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground/80">
                        {isFr
                          ? "Indicatif uniquement — n'affecte pas le montant verrouillé sur une réservation."
                          : "Indicative only — does not affect the amount locked on a booking."}
                      </p>
                    </div>
                  )}

                  {/* Service rows */}
                  {isOpen && (
                    <div className="border-t divide-y">
                      {catServices.map(service => (
                        <div
                          key={service.id}
                          className="flex items-center gap-3 px-4 py-2.5"
                        >
                          <span className="flex-1 text-sm font-medium truncate">
                            {service.name}
                          </span>

                          <div className="flex items-center gap-2 shrink-0">
                            <Switch
                              checked={service.active}
                              onCheckedChange={() => handleToggleActive(service.id)}
                              aria-label={service.active ? "Deactivate" : "Activate"}
                            />
                            <span className="text-xs text-muted-foreground w-12 text-right hidden sm:block">
                              {service.active
                                ? isFr ? "Actif" : "Active"
                                : isFr ? "Inactif" : "Inactive"}
                            </span>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(service)}
                            title={isFr ? "Modifier" : "Edit"}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteClick(service.id)}
                            title={isFr ? "Supprimer" : "Delete"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create / Edit Dialog ───────────────────────────────────────────── */}
      <Dialog
        open={isCreating || !!editingService}
        onOpenChange={() => {
          setIsCreating(false);
          setEditingService(null);
          setFormErrors({});
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingService
                ? isFr ? "Modifier le service" : "Edit Service"
                : isFr ? "Créer un service" : "Create Service"}
            </DialogTitle>
            <DialogDescription>
              {editingService
                ? isFr ? "Mettez à jour les détails du service" : "Update service details"
                : isFr ? "Ajoutez un nouveau service au catalogue" : "Add a new service to the catalog"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="service-name">
                {isFr ? "Nom" : "Name"} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="service-name"
                value={formData.name}
                onChange={e => {
                  setFormData(prev => ({ ...prev, name: e.target.value }));
                  if (formErrors.name) setFormErrors(prev => ({ ...prev, name: undefined }));
                }}
                placeholder={isFr ? "Nom du service" : "Service name"}
                className={formErrors.name ? "border-destructive" : ""}
              />
              {formErrors.name && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {formErrors.name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-category">
                {isFr ? "Catégorie" : "Category"} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.categoryId != null ? String(formData.categoryId) : ""}
                onValueChange={value => {
                  const opt = categoryOptions.find(o => String(o.id) === value);
                  setFormData(prev => ({ ...prev, categoryId: opt?.id ?? null, category: opt?.label ?? "" }));
                  if (formErrors.category) setFormErrors(prev => ({ ...prev, category: undefined }));
                }}
              >
                <SelectTrigger className={formErrors.category ? "border-destructive" : ""}>
                  <SelectValue placeholder={isFr ? "Choisir une catégorie" : "Select category"} />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[60]">
                  {categoryOptions.map(opt => (
                    <SelectItem key={opt.id} value={String(opt.id)}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.category && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {formErrors.category}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-duration">
                {isFr ? "Durée (minutes)" : "Duration (minutes)"}
              </Label>
              <Input
                id="service-duration"
                type="number"
                min={15}
                max={480}
                step={15}
                value={formData.durationMins}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    durationMins: parseInt(e.target.value) || 60,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-description">
                {isFr ? "Description" : "Description"}
              </Label>
              <Textarea
                id="service-description"
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={isFr ? "Description optionnelle" : "Optional description"}
                rows={3}
              />
            </div>

            {/* "Règles de tarification" removed — the mode & range live on the
                category (price_min / price_max / is_quote_based), not per service. */}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreating(false);
                setEditingService(null);
                setFormErrors({});
              }}
            >
              {isFr ? "Annuler" : "Cancel"}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1" />
              )}
              {editingService ? isFr ? "Mettre à jour" : "Update" : isFr ? "Créer" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ─────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isFr ? "Supprimer ce service ?" : "Delete Service?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isFr
                ? "Cette action est irréversible. Le service sera supprimé du catalogue."
                : "This action cannot be undone. The service will be permanently removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isFr ? "Annuler" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isFr ? "Supprimer" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Reset Confirmation ──────────────────────────────────────────────── */}
      <AlertDialog open={resetConfirm} onOpenChange={setResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isFr ? "Réinitialiser le catalogue ?" : "Reset Service Catalog?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isFr
                ? "Les services seront réinitialisés à leur état actuel en base de données."
                : "Services will be reset to the current database state."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isFr ? "Annuler" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isFr ? "Réinitialiser" : "Reset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
