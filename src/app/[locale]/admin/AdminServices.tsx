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
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/currency";
import {
  DEFAULT_PRICING_RULES,
} from "@/utils/pricingEngine";

const FORM_CATEGORIES = [
  "Ménage et nettoyage",
  "Plomberie",
  "Électricité",
  "Bricolage & Réparations",
  "Nounou et baby-sitting",
  "Beauté à domicile",
  "Jardinage et piscine",
  "Climatisation et électroménager",
  "Autre",
];

interface FormErrors {
  name?: string;
  category?: string;
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
  const { services: apiServices, loading: servicesLoading } = useAdminServices();
  const { bookings = [] } = useAdminStore();

  const [services, setServices] = useState<AdminService[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Track which category sections are expanded (all open by default)
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  const [editingService, setEditingService] = useState<AdminService | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [formData, setFormData] = useState({
    name: "",
    category: FORM_CATEGORIES[0],
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
    if (!formData.category) {
      errors.category = isFr ? "La catégorie est obligatoire" : "Category is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenCreate = () => {
    setFormData({
      name: "",
      category: FORM_CATEGORIES[0],
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
    setFormData({
      name: service.name,
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
    await new Promise(resolve => setTimeout(resolve, 300));

    if (editingService) {
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
    } else {
      const newService: AdminService = {
        id: String(Date.now()),
        name: formData.name.trim(),
        category: formData.category,
        durationMins: formData.durationMins,
        basePrice: formData.basePrice,
        description: formData.description.trim(),
        active: true,
        pricingMode: formData.pricingMode,
        minPrice: formData.minPrice,
        maxPrice: formData.maxPrice,
        pricingRules: formData.pricingRules,
      };
      setServices(prev => [...prev, newService]);
      setOpenCategories(prev => new Set([...prev, formData.category]));
      toast({ title: isFr ? "Service créé" : "Service Created", description: formData.name });
      setIsCreating(false);
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
    await new Promise(resolve => setTimeout(resolve, 200));
    setServices(prev => prev.filter(s => s.id !== serviceId));
    setDeleteConfirm(null);
    toast({ title: isFr ? "Service supprimé" : "Service Deleted" });
    setIsSaving(false);
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
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                          isOpen ? "" : "-rotate-90"
                        }`}
                      />
                      <span className="font-semibold text-sm">{cat}</span>
                      <Badge variant="secondary" className="text-xs tabular-nums">
                        {catServices.length}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {activeCount}/{catServices.length}{" "}
                      {isFr ? "actif" : "active"}
                    </span>
                  </button>

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
                value={formData.category}
                onValueChange={value => {
                  setFormData(prev => ({ ...prev, category: value }));
                  if (formErrors.category) setFormErrors(prev => ({ ...prev, category: undefined }));
                }}
              >
                <SelectTrigger className={formErrors.category ? "border-destructive" : ""}>
                  <SelectValue placeholder={isFr ? "Choisir une catégorie" : "Select category"} />
                </SelectTrigger>
                <SelectContent>
                  {FORM_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
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
              <Label htmlFor="service-price">
                {isFr ? "Prix de base (CFA)" : "Base Price (CFA)"}
              </Label>
              <Input
                id="service-price"
                type="number"
                min={0}
                value={formData.basePrice}
                onChange={e =>
                  setFormData(prev => ({ ...prev, basePrice: parseInt(e.target.value) || 0 }))
                }
              />
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

            {/* Pricing rules (advanced) */}
            <Accordion type="single" collapsible defaultValue="">
              <AccordionItem value="pricing" className="border rounded-md">
                <AccordionTrigger className="px-3 py-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Settings2 className="h-4 w-4" />
                    {isFr ? "Règles de tarification" : "Pricing Rules"}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>{isFr ? "Mode de tarification" : "Pricing Mode"}</Label>
                      <Select
                        value={formData.pricingMode}
                        onValueChange={(v: "instant" | "range" | "quote_required") =>
                          setFormData(prev => ({ ...prev, pricingMode: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="instant">
                            {isFr ? "Devis instantané" : "Instant Quote"}
                          </SelectItem>
                          <SelectItem value="range">
                            {isFr ? "Fourchette de prix" : "Price Range"}
                          </SelectItem>
                          <SelectItem value="quote_required">
                            {isFr ? "Devis manuel" : "Quote Required"}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.pricingMode === "range" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">
                            {isFr ? "Prix min (CFA)" : "Min Price (CFA)"}
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            value={formData.minPrice}
                            onChange={e =>
                              setFormData(prev => ({ ...prev, minPrice: parseInt(e.target.value) || 0 }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">
                            {isFr ? "Prix max (CFA)" : "Max Price (CFA)"}
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            value={formData.maxPrice}
                            onChange={e =>
                              setFormData(prev => ({ ...prev, maxPrice: parseInt(e.target.value) || 0 }))
                            }
                          />
                        </div>
                      </div>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setFormData(prev => ({ ...prev, pricingRules: { ...DEFAULT_PRICING_RULES } }))
                      }
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      {isFr ? "Réinitialiser" : "Reset to Defaults"}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
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
