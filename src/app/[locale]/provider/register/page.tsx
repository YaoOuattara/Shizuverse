"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import PhoneInput from "@/components/PhoneInput";
import { normalizeCiMomo, isValidCiMomo } from "@/lib/momo";
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

function getCategoryIcon(cat: ApiCategory): LucideIcon {
  const name = (cat.name_en || cat.name || "").toLowerCase();
  if (name.includes("clean") || name.includes("nettoy"))           return Sparkles;
  if (name.includes("plumb") || name.includes("plomb") || name.includes("water") || name.includes("eau")) return Droplets;
  if (name.includes("electr"))                                     return Zap;
  if (name.includes("carpen") || name.includes("menuiser") || name.includes("construct") || name.includes("handyman")) return Hammer;
  if (name.includes("baby") || name.includes("child") || name.includes("enfant") || name.includes("nanny")) return Baby;
  if (name.includes("massage") || name.includes("wellness") || name.includes("beauty") || name.includes("beaut")) return Heart;
  if (name.includes("garden") || name.includes("jardin") || name.includes("green") || name.includes("plant")) return Leaf;
  if (name.includes("ac") || name.includes("air") || name.includes("clim") || name.includes("hvac") || name.includes("wind") || name.includes("cool")) return Wind;
  if (name.includes("plumb") || name.includes("pipe") || name.includes("wrench") || name.includes("repair") || name.includes("réparat")) return Wrench;
  return Sparkles;
}

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
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";
  const isFr = locale === "fr";
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [isImprovingBio, setIsImprovingBio] = useState(false);
  const [submitted, setSubmitted]         = useState(false);

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
  const [serviceRates, setServiceRates] = useState<Record<number, { min: string; max: string }>>({});
  const [bio, setBio] = useState("");

  useEffect(() => {
    fetch(`${FLASK_API}/api/services/categories`)
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setCategoriesLoading(false));
  }, []);

  // ── Step 1 extra ──────────────────────────────────────────────────────────
  const [commune, setCommune] = useState("");

  // ── Step 3 ────────────────────────────────────────────────────────────────
  const [experienceText, setExperienceText] = useState("");
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
    account.phone.replace(/\D/g, "").length >= 6 &&
    account.password.length >= 8 &&
    confirmPassword === account.password &&
    commune.trim().length > 0 &&
    (accountType === "individual" || businessName.trim().length >= 2);

  const step2Valid = selectedServices.length > 0 && selectedCommunes.length > 0;

  // ── Cloudinary upload helper ───────────────────────────────────────────────
  const uploadToCloudinary = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", "shizu_uploads");
    const res = await fetch("https://api.cloudinary.com/v1_1/ddilgv5ir/upload", {
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

  // ── Step 1 → 2 transition: auto-add home commune to zones ────────────────
  const handleStep1Continue = () => {
    if (commune && !selectedCommunes.includes(commune)) {
      setSelectedCommunes(prev => [commune, ...prev]);
    }
    setStep(2);
  };

  // ── Final submit ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Mobile Money is optional, but if provided it must normalize to a valid local number.
    const momoLocal = normalizeCiMomo(momoNumber);
    if (momoNumber.trim() && !isValidCiMomo(momoLocal)) {
      toast({
        title: isFr ? "Numéro Mobile Money invalide" : "Invalid Mobile Money number",
        description: isFr
          ? "Le numéro doit contenir 10 chiffres et commencer par 0 (ex. 0707050154)."
          : "The number must have 10 digits and start with 0 (e.g. 0707050154).",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    const payload = {
      ...account,
      services: selectedServices,
      zones: selectedCommunes,
      bio,
      experience_text: experienceText.trim() || undefined,
      account_type: accountType,
      company_name: accountType === "company" ? businessName.trim() : undefined,
      rccm_number: accountType === "company" && rccmNumber.trim() ? rccmNumber.trim() : undefined,
      // Stable key: String(category_id) — a localized display name orphans the
      // data on rename and splits FR/EN registrations (remap migration handles
      // the legacy name-keyed rows).
      service_rates: Object.fromEntries(
        Object.entries(serviceRates).map(([id, r]) =>
          [String(id), { min: Number(r.min) || 0, max: Number(r.max) || 0 }]
        )
      ),
      profile_photo_url: profilePhotoUrl || undefined,
      id_doc_type: idDocType || undefined,
      id_doc_url: idDocUrl || undefined,
      mobile_money_operator: momoOperator || undefined,
      mobile_money_number: momoLocal || undefined,
      mobile_money_name: momoName.trim() || undefined,
      verification_status: "submitted",
    };
    console.log("[register] payload:", JSON.stringify(payload, null, 2));
    try {
      const res = await fetch(`${FLASK_API}/api/provider/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      console.log("[register] response status:", res.status, "body:", data);
    } catch (err) {
      console.error("[register] fetch error:", err);
      // optimistic — show success anyway
    } finally {
      setIsSubmitting(false);
      setSubmitted(true);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    const shizuWa = (process.env.NEXT_PUBLIC_SHIZU_WHATSAPP ?? "2250700000000").replace(/\D/g, "");
    const waText = encodeURIComponent(
      isFr
        ? "Bonjour Shizu, je viens de soumettre mon profil prestataire et j'ai une question."
        : "Hello Shizu, I just submitted my provider profile and have a question."
    );
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-9 w-9 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            {isFr ? "Profil soumis !" : "Profile Submitted!"}
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed mb-6">
            {isFr
              ? "Votre profil a été soumis avec succès. L'équipe Shizu vous contactera sous 48h sur WhatsApp pour valider votre compte."
              : "Your profile has been successfully submitted. The Shizu team will contact you within 48 hours on WhatsApp to validate your account."}
          </p>

          {/* WhatsApp contact button */}
          <a
            href={`https://wa.me/${shizuWa}?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1ebe5a] text-white font-semibold py-3 px-4 rounded-xl transition-colors mb-3 text-sm"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white shrink-0" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {isFr ? "Contacter Shizu sur WhatsApp" : "Contact Shizu on WhatsApp"}
          </a>

          <Button
            onClick={() => router.push(`/${locale}/provider`)}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
          >
            {isFr ? "Accéder à mon tableau de bord" : "Go to my dashboard"}
          </Button>
          <button
            type="button"
            onClick={() => router.push(`/${locale}`)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors mt-2 block w-full text-center"
          >
            {isFr ? "Retour à l'accueil" : "Back to home"}
          </button>
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

        <img
          src="https://res.cloudinary.com/ddilgv5ir/image/upload/v1779646648/shizu_logo_horizontal_dark_khesrn.png"
          alt="Shizu"
          style={{ height: '48px', width: 'auto', objectFit: 'contain', margin: '0 auto 20px', display: 'block' }}
        />

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
          <h1 className="text-2xl font-bold text-gray-900">
            {isFr ? "Rejoindre Shizu en tant que prestataire" : "Join Shizu as a Provider"}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {isFr
              ? "Développez votre clientèle à Abidjan. 3 étapes rapides."
              : "Grow your client base in Abidjan. 3 quick steps."}
          </p>
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
              <Label htmlFor="full_name" className="text-sm text-gray-700">
                {isFr ? "Nom complet" : "Full name"} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="full_name"
                placeholder="Kouassi Amon"
                value={account.full_name}
                onChange={(e) => setAccount((a) => ({ ...a, full_name: e.target.value }))}
              />
            </div>

            {/* WhatsApp */}
            <div className="space-y-1.5">
              <Label htmlFor="phone">
                WhatsApp <span className="text-red-500">*</span>
              </Label>
              <PhoneInput
                id="phone"
                defaultValue={account.phone}
                onChange={(v) => setAccount((a) => ({ ...a, phone: v }))}
                placeholder="07 XX XX XX XX"
                selectClassName="rounded-l-md border-gray-300 bg-gray-50 text-gray-500 focus:ring-[#0F3A7A]/30"
                inputClassName="rounded-none rounded-r-md border-gray-300 bg-white py-2 focus:ring-[#0F3A7A]/30 focus:border-[#0F3A7A]"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {isFr ? "Sécurité" : "Security"}
              </p>
              <Label htmlFor="password" className="text-sm text-gray-700">
                {isFr ? "Mot de passe" : "Password"} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={account.password}
                onChange={(e) => setAccount((a) => ({ ...a, password: e.target.value }))}
              />
              {account.password.length > 0 && account.password.length < 8 ? (
                <p className="text-xs text-red-500">
                  {isFr
                    ? "Le mot de passe doit contenir au moins 8 caractères"
                    : "Password must be at least 8 characters"}
                </p>
              ) : (
                <p className="text-xs text-gray-400">
                  {isFr ? "Minimum 8 caractères" : "Minimum 8 characters"}
                </p>
              )}
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

            {/* Commune */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {isFr ? "Localisation" : "Location"}
              </p>
              <Label htmlFor="commune" className="text-sm text-gray-700">
                {isFr ? "Votre commune" : "Your commune"} <span className="text-red-500">*</span>
              </Label>
              <select
                id="commune"
                value={commune}
                onChange={(e) => setCommune(e.target.value)}
                className={inputCls}
              >
                <option value="">{isFr ? "Choisir votre commune…" : "Select your commune…"}</option>
                {COMMUNES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400">
                {isFr
                  ? "La commune où vous êtes basé — elle sera incluse dans vos zones d'intervention."
                  : "The commune where you are based — it will be included in your coverage zones."}
              </p>
            </div>

            <Button
              onClick={handleStep1Continue}
              disabled={!step1Valid}
              className="w-full bg-green-600 hover:bg-green-700 mt-2"
            >
              {isFr ? "Continuer" : "Continue"}
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {categories.map((cat) => {
                    const selected = selectedServices.includes(cat.id);
                    const Icon = getCategoryIcon(cat);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          if (selected) {
                            setSelectedServices((prev) => prev.filter((id) => id !== cat.id));
                            setServiceRates((prev) => { const n = { ...prev }; delete n[cat.id]; return n; });
                          } else {
                            setSelectedServices((prev) => [...prev, cat.id]);
                          }
                        }}
                        className={`relative flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all
                          ${selected
                            ? "border-[#0D2B6B] bg-[#0D2B6B] text-white"
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
                {isFr ? "Zones d'intervention" : "Operating districts"} <span className="text-red-400">*</span>
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
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all
                        ${selected
                          ? "border-[#0D2B6B] bg-[#0D2B6B] text-white"
                          : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"}`}
                    >
                      {commune}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Per-service price ranges */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {isFr ? "Tarif indicatif" : "Pricing per service"}
              </p>
              {selectedServices.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-1">
                  {isFr
                    ? "Sélectionnez vos services pour définir vos tarifs"
                    : "Select your services to set your rates"}
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedServices.map((id) => {
                    const cat = categories.find((c) => c.id === id);
                    if (!cat) return null;
                    const name = displayCatName(cat, locale);
                    const rates = serviceRates[id] ?? { min: "", max: "" };
                    const setRate = (field: "min" | "max", val: string) =>
                      setServiceRates((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { min: "", max: "" }), [field]: val } }));
                    return (
                      <div key={id} className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-700 w-32 truncate shrink-0">{name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-gray-400">De</span>
                          <input
                            type="number" min="0"
                            value={rates.min}
                            onChange={(e) => setRate("min", e.target.value)}
                            placeholder="5 000"
                            className="w-24 h-8 text-sm rounded-md border border-input bg-background px-2 py-1 text-right focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-gray-400">À</span>
                          <input
                            type="number" min="0"
                            value={rates.max}
                            onChange={(e) => setRate("max", e.target.value)}
                            placeholder="15 000"
                            className="w-24 h-8 text-sm rounded-md border border-input bg-background px-2 py-1 text-right focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                        </div>
                        <span className="text-xs text-gray-500 font-medium shrink-0">FCFA</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                {isFr ? "Retour" : "Back"}
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!step2Valid}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isFr ? "Continuer" : "Continue"}
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

            {/* Bio */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {isFr ? "Présentation" : "Bio"} <span className="text-red-400">*</span>
              </p>
              <Textarea
                id="bio"
                rows={4}
                placeholder={isFr
                  ? "J'ai 5 ans d'expérience et je livre toujours des résultats impeccables…"
                  : "I have 5 years of experience and always deliver excellent results..."}
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
                {isFr ? "Améliorer avec l'IA" : "Improve with AI"}
              </Button>
            </div>

            {/* Experience */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {isFr ? "Expérience professionnelle" : "Professional experience"}
                <span className="ml-1 normal-case font-normal text-gray-300">({isFr ? "optionnelle" : "optional"})</span>
              </p>
              <Textarea
                rows={3}
                placeholder={isFr
                  ? "Ex : 5 ans de plomberie, formations suivies, certifications…"
                  : "E.g. 5 years of plumbing, training attended, certifications..."}
                value={experienceText}
                onChange={(e) => setExperienceText(e.target.value)}
                className="resize-none"
              />
            </div>

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
                  {/* Free input — normalized to LOCAL 10 digits (never E.164). */}
                  <input
                    type="tel"
                    inputMode="tel"
                    value={momoNumber}
                    onChange={(e) => setMomoNumber(e.target.value.slice(0, 20))}
                    placeholder="0707050154"
                    aria-invalid={momoNumber.trim().length > 0 && !isValidCiMomo(normalizeCiMomo(momoNumber))}
                    className={inputCls}
                  />
                  <p className="text-xs text-gray-500">
                    {isFr
                      ? "Numéro Mobile Money au format local (10 chiffres)."
                      : "Mobile Money number in local format (10 digits)."}
                  </p>
                  {momoNumber.trim().length > 0 && !isValidCiMomo(normalizeCiMomo(momoNumber)) && (
                    <p className="text-xs text-red-600">
                      {isFr
                        ? "Le numéro doit contenir 10 chiffres et commencer par 0 (ex. 0707050154)."
                        : "The number must have 10 digits and start with 0 (e.g. 0707050154)."}
                    </p>
                  )}
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
                ← {isFr ? "Retour" : "Back"}
              </button>
            </div>
          </div>
        )}

        </div>{/* end active step card */}

        <p className="text-center text-xs text-gray-400 mt-6">
          {isFr ? "Déjà inscrit ?" : "Already registered?"}{" "}
          <button
            onClick={() => router.push(`/${locale}/provider/login`)}
            className="text-[#0F3A7A] underline"
          >
            {isFr ? "Accéder à mon tableau de bord" : "Access your dashboard"}
          </button>
        </p>
      </div>
    </div>
  );
}
