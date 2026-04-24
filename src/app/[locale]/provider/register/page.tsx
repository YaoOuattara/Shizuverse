"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, CheckCircle, Sparkles, Droplets, Wrench, Zap, Hammer,
  Baby, Heart, Leaf, Wind, ArrowLeft, Camera, CreditCard,
  Smartphone, Upload, CheckCircle2, Lock,
} from "lucide-react";
import { COMMUNES } from "@/components/CommuneAutocomplete";
import type { LucideIcon } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com";

interface ApiCategory {
  id: number;
  name: string;
  name_fr: string;
  name_en: string;
}

const CATEGORY_ICON_MAP: Record<number, LucideIcon> = {
  13: Droplets,
  14: Wrench,
  15: Zap,
  16: Hammer,
  17: Baby,
  18: Sparkles,
  19: Heart,
  20: Leaf,
  21: Wind,
};

function displayCatName(cat: ApiCategory, locale: string): string {
  return locale === "fr" ? (cat.name_fr || cat.name) : (cat.name_en || cat.name);
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ step, isFr }: { step: number; isFr: boolean }) {
  const labels = isFr
    ? ["Qui êtes-vous ?", "Que proposez-vous ?", "Dernière étape"]
    : ["About you", "What you offer", "Last step"];
  return (
    <div className="mb-8">
      <div className="flex justify-between mb-3">
        {labels.map((label, i) => {
          const n = i + 1;
          const done    = n < step;
          const current = n === step;
          return (
            <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                  ${done    ? "bg-green-500 text-white shadow-sm"                          : ""}
                  ${current ? "bg-green-500 text-white shadow-md ring-4 ring-green-100"    : ""}
                  ${!done && !current ? "bg-gray-100 text-gray-400"                        : ""}`}
              >
                {done ? <CheckCircle className="h-4 w-4" /> : n}
              </div>
              <span className={`text-xs text-center leading-tight max-w-[72px]
                ${current ? "font-semibold text-green-700" : done ? "text-green-500" : "text-gray-400"}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="relative h-1.5 bg-gray-100 rounded-full">
        <div
          className="absolute h-1.5 bg-green-500 rounded-full transition-all duration-500"
          style={{ width: `${((step - 1) / 2) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function ProviderRegisterPage() {
  const t = useTranslations("providerRegister");
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";
  const isFr = locale === "fr";
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImprovingBio, setIsImprovingBio] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // ── Step 1 ────────────────────────────────────────────────────────────────
  const [accountType, setAccountType] = useState<"individual" | "company">("individual");
  const [account, setAccount] = useState({ full_name: "", phone: "", password: "" });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [rccmNumber, setRccmNumber] = useState("");

  // ── Step 2 ────────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [selectedCommunes, setSelectedCommunes] = useState<string[]>([]);
  const [tarifIndicatif, setTarifIndicatif] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    fetch(`${FLASK_API}/api/services/categories`)
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setCategoriesLoading(false));
  }, []);

  // ── Step 3 ────────────────────────────────────────────────────────────────
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [profilePhotoUploading, setProfilePhotoUploading] = useState(false);
  const [idDocType, setIdDocType] = useState("");
  const [idDocUrl, setIdDocUrl] = useState<string | null>(null);
  const [idDocUploading, setIdDocUploading] = useState(false);
  const [momoOperator, setMomoOperator] = useState<string | null>(null);
  const [momoNumber, setMomoNumber] = useState("");
  const [momoName, setMomoName] = useState("");

  // ── Validators ────────────────────────────────────────────────────────────
  const step1Valid =
    account.full_name.trim().length >= 2 &&
    account.phone.trim().length >= 8 &&
    account.password.length >= 6 &&
    confirmPassword === account.password &&
    (accountType === "individual" || businessName.trim().length >= 2);

  const step2Valid = selectedServices.length > 0 && selectedCommunes.length > 0;

  // ── Cloudinary upload helper ───────────────────────────────────────────────
  const uploadToCloudinary = async (file: File): Promise<string> => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !preset) throw new Error("Cloudinary non configuré");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", preset);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) throw new Error(`Upload échoué: ${res.status}`);
    const data = await res.json() as { secure_url: string };
    return data.secure_url;
  };

  const handleProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfilePhotoUploading(true);
    try {
      setProfilePhotoUrl(await uploadToCloudinary(file));
    } catch {
      toast({ title: isFr ? "Erreur upload" : "Upload error", description: isFr ? "Réessayez." : "Try again.", variant: "destructive" });
    } finally {
      setProfilePhotoUploading(false);
    }
  };

  const handleIdDocChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIdDocUploading(true);
    try {
      setIdDocUrl(await uploadToCloudinary(file));
    } catch {
      toast({ title: isFr ? "Erreur upload" : "Upload error", description: isFr ? "Réessayez." : "Try again.", variant: "destructive" });
    } finally {
      setIdDocUploading(false);
    }
  };

  // ── AI bio improvement ────────────────────────────────────────────────────
  const handleImproveBio = async () => {
    if (!bio.trim() || isImprovingBio) return;
    setIsImprovingBio(true);
    try {
      const res = await fetch("/api/improve-bio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio,
          services: selectedServices.map((id) =>
            displayCatName(
              categories.find((c) => c.id === id) ?? { id, name: String(id), name_fr: String(id), name_en: String(id) },
              locale
            )
          ),
        }),
      });
      const data = await res.json() as { improved_bio?: string; error?: string };
      if (data.improved_bio) {
        setBio(data.improved_bio);
        toast({ title: isFr ? "Bio améliorée !" : "Bio improved!", description: isFr ? "L'IA a réécrit votre bio." : "AI rewrote your bio." });
      } else {
        toast({ title: isFr ? "Erreur IA" : "AI Error", description: isFr ? "Réessayez dans un moment." : "Try again shortly.", variant: "destructive" });
      }
    } catch {
      toast({ title: isFr ? "Erreur IA" : "AI Error", description: isFr ? "Réessayez dans un moment." : "Try again shortly.", variant: "destructive" });
    } finally {
      setIsImprovingBio(false);
    }
  };

  // ── Final submit ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await fetch(`${FLASK_API}/api/provider/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...account,
          services: selectedServices,
          zones: selectedCommunes,
          bio,
          account_type: accountType,
          company_name: accountType === "company" ? businessName.trim() : undefined,
          rccm_number: accountType === "company" && rccmNumber.trim() ? rccmNumber.trim() : undefined,
          hourly_rate: tarifIndicatif ? Number(tarifIndicatif) : undefined,
          profile_photo_url: profilePhotoUrl || undefined,
          id_doc_type: idDocType || undefined,
          id_doc_url: idDocUrl || undefined,
          momo_operator: momoOperator || undefined,
          momo_number: momoNumber.trim() || undefined,
          momo_account_name: momoName.trim() || undefined,
          verification_status: "submitted",
        }),
      });
    } catch {
      // optimistic — show success anyway
    } finally {
      setIsSubmitting(false);
      setSubmitted(true);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
          <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("submittedTitle")}</h1>
          <p className="text-gray-500 mb-6">{t("submittedDesc")}</p>
          <Button onClick={() => router.push(`/${locale}`)} className="w-full bg-[#0F3A7A] hover:bg-[#0d3068]">
            {t("backHome")}
          </Button>
        </div>
      </div>
    );
  }

  // ── Shared input class ────────────────────────────────────────────────────
  const inputCls =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm " +
    "ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-ring";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-lg w-full">

        {/* Back button */}
        <button
          onClick={() => router.push(`/${locale}`)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6 -mt-1 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {isFr ? "Retour à l'accueil" : "Back to home"}
        </button>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-gray-500 mt-1 text-sm">{t("subtitle")}</p>
        </div>

        <ProgressBar step={step} isFr={isFr} />

        {/* Active step card */}
        <div className="rounded-2xl border border-gray-100 bg-white border-t-2 border-t-green-500 pt-6 pb-2 px-1">

        {/* ══════════════════════════════════════════════════════════════════
            Step 1 — Qui êtes-vous ?
        ══════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-7">
            <h2 className="font-semibold text-gray-800 text-lg">
              {isFr ? "Qui êtes-vous ?" : "About you"}
            </h2>

            {/* Account type cards */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {isFr ? "Type de compte" : "Account type"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(["individual", "company"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAccountType(type)}
                    className={`flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all text-sm font-medium
                      ${accountType === type
                        ? "border-green-500 bg-[#f0fdf4] text-green-800"
                        : "border-gray-100 bg-white text-gray-600 hover:border-gray-200"}`}
                  >
                    <span className="text-xl">{type === "individual" ? "👤" : "🏢"}</span>
                    <span>{type === "individual" ? (isFr ? "Particulier" : "Individual") : (isFr ? "Entreprise" : "Company")}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Company-only fields */}
            {accountType === "company" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="business_name">
                    {isFr ? "Nom de l'entreprise" : "Company name"}{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <input
                    id="business_name"
                    className={inputCls}
                    placeholder={isFr ? "Ex: Shizu Services SARL" : "e.g. Shizu Services Ltd"}
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rccm">
                    {isFr ? "Numéro RCCM" : "RCCM number"}
                    <span className="ml-1 text-xs text-gray-400">({isFr ? "optionnel" : "optional"})</span>
                  </Label>
                  <input
                    id="rccm"
                    className={inputCls}
                    placeholder="CI-ABJ-2024-XXXX"
                    value={rccmNumber}
                    onChange={(e) => setRccmNumber(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Full name */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {isFr ? "Identité" : "Identity"}
              </p>
              <Label htmlFor="full_name" className="text-sm text-gray-700">{t("fullName")}</Label>
              <Input
                id="full_name"
                placeholder={t("fullNamePlaceholder")}
                value={account.full_name}
                onChange={(e) => setAccount((a) => ({ ...a, full_name: e.target.value }))}
              />
            </div>

            {/* WhatsApp +225 */}
            <div className="space-y-1.5">
              <Label htmlFor="phone">
                WhatsApp <span className="text-red-500">*</span>
              </Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm font-medium">
                  +225
                </span>
                <input
                  id="phone"
                  type="tel"
                  value={account.phone}
                  onChange={(e) => setAccount((a) => ({ ...a, phone: e.target.value }))}
                  placeholder="07 XX XX XX XX"
                  className="flex-1 h-10 rounded-none rounded-r-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F3A7A]/30 focus:border-[#0F3A7A]"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {isFr ? "Sécurité" : "Security"}
              </p>
              <Label htmlFor="password" className="text-sm text-gray-700">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={account.password}
                onChange={(e) => setAccount((a) => ({ ...a, password: e.target.value }))}
              />
              <p className="text-xs text-gray-400">{t("passwordHint")}</p>
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirm_password">
                {isFr ? "Confirmer le mot de passe" : "Confirm password"}
              </Label>
              <Input
                id="confirm_password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {confirmPassword.length > 0 && confirmPassword !== account.password && (
                <p className="text-xs text-red-500">
                  {isFr ? "Les mots de passe ne correspondent pas." : "Passwords do not match."}
                </p>
              )}
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!step1Valid}
              className="w-full bg-[#0F3A7A] hover:bg-[#0d3068] mt-2"
            >
              {t("continue")}
            </Button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            Step 2 — Que proposez-vous ?
        ══════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-7">
            <h2 className="font-semibold text-gray-800 text-lg">
              {isFr ? "Que proposez-vous ?" : "What do you offer?"}
            </h2>

            {/* Category chips */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {isFr ? "Services proposés" : "Services offered"} <span className="text-red-400">*</span>
              </p>
              {categoriesLoading ? (
                <div className="flex items-center gap-2 text-gray-400 py-3">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">{isFr ? "Chargement…" : "Loading…"}</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((cat) => {
                    const selected = selectedServices.includes(cat.id);
                    const Icon = CATEGORY_ICON_MAP[cat.id] ?? Sparkles;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() =>
                          setSelectedServices((prev) =>
                            selected ? prev.filter((id) => id !== cat.id) : [...prev, cat.id]
                          )
                        }
                        className={`relative flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all
                          ${selected
                            ? "border-[#0F3A7A] bg-[#0F3A7A] text-white"
                            : "border-gray-100 hover:border-gray-200 bg-white"}`}
                      >
                        <Icon className={`h-5 w-5 shrink-0 ${selected ? "text-white" : "text-gray-400"}`} />
                        <span className={`text-sm font-medium leading-tight ${selected ? "text-white" : "text-gray-700"}`}>
                          {displayCatName(cat, locale)}
                        </span>
                        {selected && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                            <CheckCircle className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Commune chips */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {isFr ? "Communes d'intervention" : "Operating districts"} <span className="text-red-400">*</span>
              </p>
              <div className={`flex flex-wrap gap-2 ${COMMUNES.length > 10 ? "max-h-44 overflow-y-auto pr-1" : ""}`}>
                {COMMUNES.map((commune) => {
                  const selected = selectedCommunes.includes(commune);
                  return (
                    <button
                      key={commune}
                      type="button"
                      onClick={() =>
                        setSelectedCommunes((prev) =>
                          selected ? prev.filter((c) => c !== commune) : [...prev, commune]
                        )
                      }
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all
                        ${selected
                          ? "border-[#16a34a] bg-[#16a34a] text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"}`}
                    >
                      {commune}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tarif indicatif */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {isFr ? "Tarification" : "Pricing"}
              </p>
              <Label htmlFor="tarif" className="text-sm text-gray-700">
                {isFr ? "Tarif indicatif (FCFA/heure)" : "Indicative rate (FCFA/hour)"}
              </Label>
              <div className="flex items-center gap-2">
                <input
                  id="tarif"
                  type="number"
                  min="0"
                  value={tarifIndicatif}
                  onChange={(e) => setTarifIndicatif(e.target.value)}
                  placeholder={isFr ? "Ex: 5 000" : "e.g. 5000"}
                  className={inputCls}
                />
                <span className="text-sm text-gray-500 shrink-0">FCFA</span>
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {isFr ? "Présentation" : "About you"}
              </p>
              <Label htmlFor="bio" className="text-sm text-gray-700">{t("bio")}</Label>
              <Textarea
                id="bio"
                rows={4}
                placeholder={t("bioPlaceholder")}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="resize-none"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleImproveBio}
                disabled={bio.trim().length < 10 || isImprovingBio}
                className="w-full border-purple-200 text-purple-700 hover:bg-purple-50 gap-2"
              >
                {isImprovingBio ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {t("improveBio")}
              </Button>
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                {t("back")}
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!step2Valid}
                className="flex-1 bg-[#0F3A7A] hover:bg-[#0d3068]"
              >
                {t("continue")}
              </Button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            Step 3 — Dernière étape !
        ══════════════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="space-y-7">
            <h2 className="font-semibold text-gray-800 text-lg">
              {isFr ? "Dernière étape !" : "Last step!"}
            </h2>

            {/* Green motivational nudge */}
            <div className="rounded-xl border border-green-300 px-5 py-4" style={{ backgroundColor: "#f0fdf4" }}>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                <p className="text-sm font-bold text-green-800">
                  {isFr ? "Vous y êtes presque !" : "Almost there!"}
                </p>
              </div>
              <p className="text-sm text-green-700 leading-snug pl-7">
                {isFr
                  ? "Les prestataires avec une photo de profil reçoivent 3× plus de demandes. Prenez 30 secondes pour la télécharger."
                  : "Providers with a profile photo receive 3× more requests. Take 30 seconds to upload yours."}
              </p>
            </div>

            {/* Profile photo */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {isFr ? "Photo de profil" : "Profile photo"}
              </p>
              <Label className="flex items-center gap-2 text-sm text-gray-700">
                <Camera className="h-4 w-4 text-gray-500" />
                {isFr ? "Choisir une photo" : "Choose a photo"}
                <span className="text-xs text-gray-400 font-normal">({isFr ? "recommandée" : "recommended"})</span>
              </Label>
              <div className="flex items-center gap-4">
                {/* Circular thumbnail */}
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 overflow-hidden flex items-center justify-center bg-gray-50 shrink-0">
                  {profilePhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profilePhotoUrl} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="h-8 w-8 text-gray-300" />
                  )}
                </div>
                <div className="flex-1">
                  <label
                    htmlFor="profile-photo-input"
                    className={`inline-flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all
                      ${profilePhotoUploading
                        ? "opacity-50 cursor-not-allowed"
                        : "border-gray-200 hover:border-[#0F3A7A] hover:text-[#0F3A7A]"}`}
                  >
                    {profilePhotoUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : profilePhotoUrl ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {profilePhotoUploading
                      ? (isFr ? "Envoi…" : "Uploading…")
                      : profilePhotoUrl
                        ? (isFr ? "Changer la photo" : "Change photo")
                        : (isFr ? "Choisir une photo" : "Choose a photo")}
                  </label>
                  <input
                    id="profile-photo-input"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={profilePhotoUploading}
                    onChange={handleProfilePhotoChange}
                  />
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP · max 5 MB</p>
                </div>
              </div>
            </div>

            {/* ID document */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {isFr ? "Pièce d'identité" : "Identity document"}
                <span className="ml-1 normal-case font-normal text-gray-300">({isFr ? "optionnelle" : "optional"})</span>
              </p>
              <Label className="flex items-center gap-2 text-sm text-gray-700">
                <CreditCard className="h-4 w-4 text-gray-500" />
                {isFr ? "Type de document" : "Document type"}
              </Label>
              <select
                value={idDocType}
                onChange={(e) => { setIdDocType(e.target.value); setIdDocUrl(null); }}
                className={inputCls}
              >
                <option value="">{isFr ? "Choisir le type de document…" : "Select document type…"}</option>
                <option value="CNI">CNI — {isFr ? "Carte Nationale d'Identité" : "National ID Card"}</option>
                <option value="Passeport">Passeport</option>
                <option value="Permis">{isFr ? "Permis de conduire" : "Driver's license"}</option>
                <option value="Autre">{isFr ? "Autre" : "Other"}</option>
              </select>
              {idDocType && (
                <div className="flex items-center gap-3 mt-1">
                  <label
                    htmlFor="id-doc-input"
                    className={`inline-flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all
                      ${idDocUploading
                        ? "opacity-50 cursor-not-allowed"
                        : "border-gray-200 hover:border-[#0F3A7A] hover:text-[#0F3A7A]"}`}
                  >
                    {idDocUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : idDocUrl ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {idDocUploading
                      ? (isFr ? "Envoi…" : "Uploading…")
                      : idDocUrl
                        ? (isFr ? "Document envoyé ✓" : "Document sent ✓")
                        : (isFr ? `Envoyer mon ${idDocType}` : `Upload ${idDocType}`)}
                  </label>
                  <input
                    id="id-doc-input"
                    type="file"
                    accept="image/*,application/pdf"
                    className="sr-only"
                    disabled={idDocUploading}
                    onChange={handleIdDocChange}
                  />
                  <p className="text-xs text-gray-400">JPG, PNG, PDF</p>
                </div>
              )}
            </div>

            {/* Mobile Money */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Mobile Money
                <span className="ml-1 normal-case font-normal text-gray-300">({isFr ? "optionnel" : "optional"})</span>
              </p>
              <Label className="flex items-center gap-2 text-sm text-gray-700">
                <Smartphone className="h-4 w-4 text-gray-500" />
                {isFr ? "Opérateur" : "Operator"}
              </Label>
              <div className="flex gap-2">
                {(["Orange", "MTN", "Wave"] as const).map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setMomoOperator(momoOperator === op ? null : op)}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all
                      ${momoOperator === op
                        ? op === "Orange" ? "border-orange-500 bg-orange-50 text-orange-700"
                        : op === "MTN"    ? "border-yellow-400 bg-yellow-50 text-yellow-700"
                                          : "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}
                  >
                    {op === "Orange" ? "🟠" : op === "MTN" ? "🟡" : "🔵"} {op}
                  </button>
                ))}
              </div>
              {momoOperator && (
                <div className="space-y-2">
                  <input
                    type="tel"
                    placeholder={isFr ? "Numéro Mobile Money" : "Mobile Money number"}
                    value={momoNumber}
                    onChange={(e) => setMomoNumber(e.target.value)}
                    className={inputCls}
                  />
                  <input
                    type="text"
                    placeholder={isFr ? "Nom du titulaire du compte" : "Account holder name"}
                    value={momoName}
                    onChange={(e) => setMomoName(e.target.value)}
                    className={inputCls}
                  />
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="space-y-3 pt-2">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold rounded-xl py-3 gap-2 text-base"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                {isFr ? "Soumettre mon profil" : "Submit my profile"}
              </Button>
              <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
                <Lock className="h-3 w-3" />
                {isFr
                  ? "Vérification sous 48h · Vous serez notifié par WhatsApp"
                  : "Verified within 48h · You'll be notified by WhatsApp"}
              </p>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
              >
                ← {t("back")}
              </button>
            </div>
          </div>
        )}

        </div>{/* end active step card */}

        <p className="text-center text-xs text-gray-400 mt-6">
          {t("alreadyProvider")}{" "}
          <button
            onClick={() => router.push(`/${locale}/provider/login`)}
            className="text-[#0F3A7A] underline"
          >
            {t("loginLink")}
          </button>
        </p>
      </div>
    </div>
  );
}
