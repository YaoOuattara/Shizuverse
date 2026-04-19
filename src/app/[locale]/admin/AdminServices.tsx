"use client";
/**
 * Admin Services Page
 * 
 * CRUD operations for services catalog with validation.
 * Uses centralized admin store.
 */

import { useState, useMemo, useEffect } from "react";
import AdminLayout from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Search,
  Plus,
  Edit,
  Trash2,
  Clock,
  Wrench,
  Loader2,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { useAdminStore, type AdminService, type PricingRules } from "@/data/adminStore";
import { useAdminServices, type ApiService } from "@/hooks/useAdminApi";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/currency";
import { 
  DEFAULT_PRICING_RULES,
  ZONES_LIST,
  URGENCY_OPTIONS,
  TIME_PREFERENCE_OPTIONS,
} from "@/utils/pricingEngine";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Banknote, Settings2 } from "lucide-react";

const categories = [
  "Home Cleaning",
  "Plumbing",
  "Electrical",
  "Landscaping",
  "HVAC",
  "Painting",
  "General Repairs",
  "Other",
];

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

interface FormErrors {
  name?: string;
  category?: string;
  durationMins?: string;
  basePrice?: string;
}

function adaptApiService(s: ApiService): AdminService {
  return {
    id: String(s.id),
    name: s.name,
    category: s.category,
    basePrice: s.price,
    durationMins: s.duration,
    active: s.active,
  };
}

export default function AdminServices() {
  const { toast } = useToast();
  const { services: apiServices, loading: servicesLoading } = useAdminServices();
  const { bookings = [] } = useAdminStore();
  const [services, setServices] = useState<AdminService[]>([]);

  useEffect(() => {
    if (Array.isArray(apiServices) && apiServices.length > 0) {
      setServices(apiServices.map(adaptApiService));
    }
  }, [apiServices]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editingService, setEditingService] = useState<AdminService | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [formData, setFormData] = useState({
    name: "",
    category: categories[0],
    durationMins: 60,
    basePrice: 100,
    description: "",
    pricingMode: "instant" as "instant" | "range" | "quote_required",
    minPrice: 0,
    maxPrice: 0,
    pricingRules: { ...DEFAULT_PRICING_RULES } as PricingRules,
  });

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesSearch =
        searchQuery === "" ||
        service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (service.description || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = categoryFilter === "all" || service.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [services, searchQuery, categoryFilter]);

  const usedCategories = useMemo(() => {
    return Array.from(new Set(services.map(s => s.category).filter(c => c && c.trim() !== "")));
  }, [services]);

  const getServiceBookingCount = (serviceName: string) => {
    return bookings.filter(b => b.serviceName === serviceName).length;
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    
    if (!formData.name.trim()) {
      errors.name = "Service name is required";
    } else if (formData.name.trim().length < 3) {
      errors.name = "Name must be at least 3 characters";
    } else if (formData.name.trim().length > 100) {
      errors.name = "Name must be less than 100 characters";
    }
    
    const isDuplicate = services.some(s => 
      s.name.toLowerCase() === formData.name.trim().toLowerCase() && 
      s.id !== editingService?.id
    );
    if (isDuplicate) {
      errors.name = "A service with this name already exists";
    }
    
    if (!formData.category) {
      errors.category = "Category is required";
    }
    
    if (formData.durationMins < 15) {
      errors.durationMins = "Duration must be at least 15 minutes";
    } else if (formData.durationMins > 480) {
      errors.durationMins = "Duration cannot exceed 8 hours";
    }
    
    if (formData.basePrice < 0) {
      errors.basePrice = "Price cannot be negative";
    } else if (formData.basePrice > 10000000) {
      errors.basePrice = "Price cannot exceed 10 000 000 CFA";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenCreate = () => {
    setFormData({
      name: "",
      category: categories[0],
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
        title: "Validation Error",
        description: "Please fix the errors in the form.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 300));

    if (editingService) {
      const updates = {
        name: formData.name.trim(),
        category: formData.category,
        durationMins: formData.durationMins,
        basePrice: formData.basePrice,
        description: formData.description.trim(),
        pricingMode: formData.pricingMode,
        minPrice: formData.minPrice,
        maxPrice: formData.maxPrice,
        pricingRules: formData.pricingRules,
      };
      setServices(prev => prev.map(s => s.id === editingService.id ? { ...s, ...updates } : s));
      toast({
        title: "Service Updated",
        description: `${formData.name} has been updated.`,
      });
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
      toast({
        title: "Service Created",
        description: `${formData.name} has been added to the catalog.`,
      });
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
        title: "Cannot Delete Service",
        description: `This service has ${bookingCount} associated booking${bookingCount > 1 ? 's' : ''}. Consider deactivating it instead.`,
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
    
    toast({
      title: "Service Deleted",
      description: "The service has been removed from the catalog.",
    });
    setIsSaving(false);
  };

  const handleToggleActive = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    setServices(prev => prev.map(s => s.id === serviceId ? { ...s, active: !s.active } : s));
    toast({
      title: "Status Updated",
      description: `Service is now ${service?.active ? "inactive" : "active"}.`,
    });
  };

  const handleResetConfirm = () => {
    setResetConfirm(true);
  };

  const handleReset = () => {
    setServices(apiServices.map(adaptApiService));
    setResetConfirm(false);
    toast({
      title: "Catalog Reset",
      description: "Services have been reset to defaults.",
    });
  };

  return (
    <AdminLayout title="Services">
      <div className="space-y-4">
        {/* Filters & Actions */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search services..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-services"
                />
              </div>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-category-filter">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {usedCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Button onClick={handleOpenCreate} data-testid="button-create-service">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Service
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handleResetConfirm} 
                  title="Reset to defaults"
                  data-testid="button-reset-catalog"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Services List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Services Catalog ({filteredServices.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {servicesLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
                <p>Loading services...</p>
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No services found</p>
              </div>
            ) : (
              <div className="divide-y" data-testid="services-list">
                {filteredServices.map((service) => {
                  const bookingCount = getServiceBookingCount(service.name);
                  return (
                    <div
                      key={service.id}
                      className="flex items-center justify-between gap-4 p-3"
                      data-testid={`service-row-${service.id}`}
                    >
                      <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4">
                        <div>
                          <p className="font-medium text-sm truncate">{service.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">{service.category}</Badge>
                            {bookingCount > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {bookingCount} booking{bookingCount > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{formatDuration(service.durationMins)}</span>
                        </div>
                        <div className="hidden sm:flex items-center text-sm">
                          <span>{formatMoney(service.basePrice)}</span>
                        </div>
                        <div className="flex items-center gap-2 sm:justify-end">
                          <Badge
                            variant={service.active ? "default" : "secondary"}
                            className="cursor-pointer"
                            onClick={() => handleToggleActive(service.id)}
                            data-testid={`toggle-active-${service.id}`}
                          >
                            {service.active ? "Active" : "Inactive"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(service)}
                            data-testid={`button-edit-${service.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteClick(service.id)}
                            data-testid={`button-delete-${service.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog 
        open={isCreating || !!editingService} 
        onOpenChange={() => { setIsCreating(false); setEditingService(null); setFormErrors({}); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingService ? "Edit Service" : "Create Service"}</DialogTitle>
            <DialogDescription>
              {editingService ? "Update service details" : "Add a new service to the catalog"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="service-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="service-name"
                value={formData.name}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, name: e.target.value }));
                  if (formErrors.name) setFormErrors(prev => ({ ...prev, name: undefined }));
                }}
                placeholder="Service name"
                className={formErrors.name ? "border-destructive" : ""}
                data-testid="input-service-name"
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
                Category <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.category}
                onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, category: value }));
                  if (formErrors.category) setFormErrors(prev => ({ ...prev, category: undefined }));
                }}
              >
                <SelectTrigger 
                  className={formErrors.category ? "border-destructive" : ""}
                  data-testid="select-service-category"
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
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
              <Label htmlFor="service-duration">
                Duration (minutes) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="service-duration"
                type="number"
                min={15}
                max={480}
                step={15}
                value={formData.durationMins}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setFormData(prev => ({ ...prev, durationMins: isNaN(val) ? 0 : val }));
                  if (formErrors.durationMins) setFormErrors(prev => ({ ...prev, durationMins: undefined }));
                }}
                className={formErrors.durationMins ? "border-destructive" : ""}
                data-testid="input-service-duration"
              />
              {formErrors.durationMins && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {formErrors.durationMins}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Min: 15 min, Max: 8 hours (480 min)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-price">
                Base Price (CFA) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="service-price"
                type="number"
                min={0}
                max={10000}
                value={formData.basePrice}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setFormData(prev => ({ ...prev, basePrice: isNaN(val) ? 0 : val }));
                  if (formErrors.basePrice) setFormErrors(prev => ({ ...prev, basePrice: undefined }));
                }}
                className={formErrors.basePrice ? "border-destructive" : ""}
                data-testid="input-service-price"
              />
              {formErrors.basePrice && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {formErrors.basePrice}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-description">Description</Label>
              <Textarea
                id="service-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Service description (optional)"
                rows={3}
                data-testid="textarea-service-description"
              />
            </div>

            {/* Pricing Configuration */}
            <Accordion type="single" collapsible defaultValue="">
              <AccordionItem value="pricing" className="border rounded-md">
                <AccordionTrigger className="px-3 py-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Settings2 className="h-4 w-4" />
                    Pricing Rules
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Pricing Mode</Label>
                      <Select
                        value={formData.pricingMode}
                        onValueChange={(v: "instant" | "range" | "quote_required") => 
                          setFormData(prev => ({ ...prev, pricingMode: v }))
                        }
                      >
                        <SelectTrigger data-testid="select-pricing-mode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="instant">Instant Quote</SelectItem>
                          <SelectItem value="range">Price Range</SelectItem>
                          <SelectItem value="quote_required">Quote Required</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {formData.pricingMode === "instant" && "Auto-calculate price based on rules"}
                        {formData.pricingMode === "range" && "Show min-max price range to client"}
                        {formData.pricingMode === "quote_required" && "Manual quote required for each booking"}
                      </p>
                    </div>

                    {formData.pricingMode === "range" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Min Price (CFA)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={formData.minPrice}
                            onChange={(e) => setFormData(prev => ({ 
                              ...prev, 
                              minPrice: parseInt(e.target.value) || 0 
                            }))}
                            data-testid="input-min-price"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Max Price (CFA)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={formData.maxPrice}
                            onChange={(e) => setFormData(prev => ({ 
                              ...prev, 
                              maxPrice: parseInt(e.target.value) || 0 
                            }))}
                            data-testid="input-max-price"
                          />
                        </div>
                      </div>
                    )}

                    {/* Zone Multipliers */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Zone Multipliers</Label>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(formData.pricingRules?.zoneMultipliers || DEFAULT_PRICING_RULES.zoneMultipliers).map(([zone, mult]) => (
                          <div key={zone} className="flex items-center gap-2">
                            <span className="flex-1 capitalize text-muted-foreground truncate">
                              {zone.replace('_', ' ')}
                            </span>
                            <Input
                              type="number"
                              step={0.05}
                              min={0.5}
                              max={2.0}
                              value={mult}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 1.0;
                                setFormData(prev => ({
                                  ...prev,
                                  pricingRules: {
                                    ...prev.pricingRules,
                                    zoneMultipliers: {
                                      ...prev.pricingRules?.zoneMultipliers,
                                      [zone]: val,
                                    },
                                  },
                                }));
                              }}
                              className="w-16 h-7 text-xs"
                              data-testid={`input-zone-${zone}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Urgency Multipliers */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Urgency Multipliers</Label>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {Object.entries(formData.pricingRules?.urgencyMultipliers || DEFAULT_PRICING_RULES.urgencyMultipliers).map(([urg, mult]) => (
                          <div key={urg} className="flex flex-col gap-1">
                            <span className="capitalize text-muted-foreground text-center">
                              {urg.replace('_', ' ')}
                            </span>
                            <Input
                              type="number"
                              step={0.05}
                              min={1.0}
                              max={2.0}
                              value={mult}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 1.0;
                                setFormData(prev => ({
                                  ...prev,
                                  pricingRules: {
                                    ...prev.pricingRules,
                                    urgencyMultipliers: {
                                      ...prev.pricingRules?.urgencyMultipliers,
                                      [urg]: val,
                                    },
                                  },
                                }));
                              }}
                              className="h-7 text-xs text-center"
                              data-testid={`input-urgency-${urg}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Time Preference Multipliers */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Time Preference Multipliers</Label>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {Object.entries(formData.pricingRules?.timeMultipliers || DEFAULT_PRICING_RULES.timeMultipliers).map(([pref, mult]) => (
                          <div key={pref} className="flex flex-col gap-1">
                            <span className="capitalize text-muted-foreground text-center">
                              {pref.replace('_', ' ')}
                            </span>
                            <Input
                              type="number"
                              step={0.05}
                              min={1.0}
                              max={2.0}
                              value={mult}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 1.0;
                                setFormData(prev => ({
                                  ...prev,
                                  pricingRules: {
                                    ...prev.pricingRules,
                                    timeMultipliers: {
                                      ...prev.pricingRules?.timeMultipliers,
                                      [pref]: val,
                                    },
                                  },
                                }));
                              }}
                              className="h-7 text-xs text-center"
                              data-testid={`input-timepref-${pref}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        pricingRules: { ...DEFAULT_PRICING_RULES },
                      }))}
                      data-testid="button-reset-pricing-rules"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Reset to Defaults
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreating(false); setEditingService(null); setFormErrors({}); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-service">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              {editingService ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The service will be permanently removed from the catalog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Confirmation */}
      <AlertDialog open={resetConfirm} onOpenChange={setResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Service Catalog?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all current services with the default catalog. Any custom services you have added will be removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-reset"
            >
              Reset Catalog
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
