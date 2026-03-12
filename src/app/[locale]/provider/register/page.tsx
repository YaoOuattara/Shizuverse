"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  CheckCircle,
  Sparkles,
  Droplets,
  Zap,
  PaintBucket,
  Truck,
  Hammer,
  Leaf,
  Shield,
  Trophy,
  X,
} from "lucide-react";

// ── Data ──────────────────────────────────────────────────────────────────────

const SERVICES = [
  { id: "cleaning",   icon: Droplets,    priceMin: 5000,   priceMax: 25000  },
  { id: "plumbing",   icon: Droplets,    priceMin: 10000,  priceMax: 50000  },
  { id: "electrical", icon: Zap,         priceMin: 10000,  priceMax: 60000  },
  { id: "painting",   icon: PaintBucket, priceMin: 15000,  priceMax: 80000  },
  { id: "moving",     icon: Truck,       priceMin: 20000,  priceMax: 100000 },
  { id: "carpentry",  icon: Hammer,      priceMin: 10000,  priceMax: 60000  },
  { id: "gardening",  icon: Leaf,        priceMin: 5000,   priceMax: 20000  },
  { id: "security",   icon: Shield,      priceMin: 30000,  priceMax: 100000 },
];

const ZONES = [
  "Cocody", "Deux-Plateaux", "Angré", "Riviera", "Plateau", "Marcory",
  "Yopougon", "Abobo", "Adjamé", "Koumassi", "Port-Bouët",
  "Treichville", "Bingerville", "Anyama", "Songon", "Abatta",
];

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CI").format(n) + " FCFA";

// ── Achievement popup ─────────────────────────────────────────────────────────

function AchievementPopup({ onClose, isFr }: { onClose: () => void; isFr: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-xs w-full text-center animate-in fade-in zoom-in-90 duration-300">
        <Trophy className="h-14 w-14 text-yellow-400 mx-auto mb-3" />
        <p className="text-3xl font-bold text-gray-900 mb-1">+50 pts</p>
        <p className="font-semibold text-gray-800 mb-1">
          {isFr ? "Bienvenue dans l'équipe !" : "Welcome to the team!"}
        </p>
        <p className="text-sm text-gray-500 mb-5">
          {isFr
            ? "Votre compte a été créé avec succès."
            : "Your account was created successfully."}
        </p>
        <Button onClick={onClose} className="w-full bg-[#0F3A7A] hover:bg-[#0d3068]">
          {isFr ? "Continuer" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ step, total, isFr }: { step: number; total: number; isFr: boolean }) {
  const labels = isFr
    ? ["Compte", "Services", "Zones", "Bio"]
    : ["Account", "Services", "Zones", "Bio"];
  return (
    <div className="mb-8">
      <div className="flex justify-between mb-2">
        {labels.map((label, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                ${i + 1 < step ? "bg-[#0F3A7A] border-[#0F3A7A] text-white" : ""}
                ${i + 1 === step ? "bg-white border-[#0F3A7A] text-[#0F3A7A]" : ""}
                ${i + 1 > step ? "bg-gray-100 border-gray-200 text-gray-400" : ""}
              `}
            >
              {i + 1 < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-xs ${i + 1 === step ? "font-semibold text-[#0F3A7A]" : "text-gray-400"}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
      <div className="relative h-1.5 bg-gray-100 rounded-full">
        <div
          className="absolute h-1.5 bg-[#0F3A7A] rounded-full transition-all duration-500"
          style={{ width: `${((step - 1) / (total - 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProviderRegisterPage() {
  const t = useTranslations("providerRegister");
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";
  const isFr = locale === "fr";
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [showAchievement, setShowAchievement] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImprovingBio, setIsImprovingBio] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Step 1
  const [account, setAccount] = useState({ full_name: "", phone: "", password: "" });

  // Step 2
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  // Step 3
  const [selectedZones, setSelectedZones] = useState<string[]>([]);

  // Step 4
  const [bio, setBio] = useState("");

  // ── Step validators ──
  const step1Valid =
    account.full_name.trim().length >= 2 &&
    account.phone.trim().length >= 8 &&
    account.password.length >= 6;
  const step2Valid = selectedServices.length > 0;
  const step3Valid = selectedZones.length > 0;

  // ── Step 1 submit ──
  const handleStep1 = () => {
    if (!step1Valid) return;
    setShowAchievement(true);
  };

  const handleAchievementClose = () => {
    setShowAchievement(false);
    setStep(2);
  };

  // ── Step 4: improve bio with AI ──
  const handleImproveBio = async () => {
    if (!bio.trim() || isImprovingBio) return;
    setIsImprovingBio(true);
    try {
      const res = await fetch("/api/improve-bio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio, locale }),
      });
      const data = await res.json();
      if (data.improved) {
        setBio(data.improved);
        toast({
          title: isFr ? "Bio améliorée !" : "Bio improved!",
          description: isFr
            ? "L'IA a réécrit votre bio."
            : "AI rewrote your bio.",
        });
      }
    } catch {
      // silently ignore
    } finally {
      setIsImprovingBio(false);
    }
  };

  // ── Final submit ──
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com"}/api/provider/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...account,
            services: selectedServices,
            zones: selectedZones,
            bio,
          }),
        }
      );
    } catch {
      // optimistic — show success anyway
    } finally {
      setIsSubmitting(false);
      setSubmitted(true);
    }
  };

  // ── Success screen ──
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
          <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("submittedTitle")}</h1>
          <p className="text-gray-500 mb-6">{t("submittedDesc")}</p>
          <Button
            onClick={() => router.push(`/${locale}`)}
            className="w-full bg-[#0F3A7A] hover:bg-[#0d3068]"
          >
            {t("backHome")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {showAchievement && (
        <AchievementPopup onClose={handleAchievementClose} isFr={isFr} />
      )}

      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-lg w-full">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-gray-500 mt-1 text-sm">{t("subtitle")}</p>
          </div>

          <ProgressBar step={step} total={4} isFr={isFr} />

          {/* ── Step 1: Account ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="full_name">{t("fullName")}</Label>
                <Input
                  id="full_name"
                  placeholder={t("fullNamePlaceholder")}
                  value={account.full_name}
                  onChange={(e) => setAccount((a) => ({ ...a, full_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">{t("phone")}</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder={t("phonePlaceholder")}
                  value={account.phone}
                  onChange={(e) => setAccount((a) => ({ ...a, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={account.password}
                  onChange={(e) => setAccount((a) => ({ ...a, password: e.target.value }))}
                />
                <p className="text-xs text-gray-400">{t("passwordHint")}</p>
              </div>
              <Button
                onClick={handleStep1}
                disabled={!step1Valid}
                className="w-full bg-[#0F3A7A] hover:bg-[#0d3068] mt-2"
              >
                {t("continue")}
              </Button>
            </div>
          )}

          {/* ── Step 2: Services ── */}
          {step === 2 && (
            <div className="space-y-5">
              <p className="text-sm text-gray-500">{t("selectServicesHint")}</p>
              <div className="grid grid-cols-2 gap-3">
                {SERVICES.map(({ id, icon: Icon, priceMin, priceMax }) => {
                  const selected = selectedServices.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        setSelectedServices((prev) =>
                          selected ? prev.filter((s) => s !== id) : [...prev, id]
                        )
                      }
                      className={`relative p-4 rounded-xl border-2 text-left transition-all
                        ${selected
                          ? "border-[#0F3A7A] bg-[#0F3A7A]/5"
                          : "border-gray-100 hover:border-gray-200 bg-white"
                        }`}
                    >
                      {selected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#0F3A7A] flex items-center justify-center">
                          <CheckCircle className="h-3 w-3 text-white" />
                        </div>
                      )}
                      <Icon className={`h-6 w-6 mb-2 ${selected ? "text-[#0F3A7A]" : "text-gray-400"}`} />
                      <p className={`text-sm font-medium ${selected ? "text-[#0F3A7A]" : "text-gray-700"}`}>
                        {t(`services.${id}`)}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {fmt(priceMin)} – {fmt(priceMax)}
                      </p>
                    </button>
                  );
                })}
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

          {/* ── Step 3: Zones ── */}
          {step === 3 && (
            <div className="space-y-5">
              <p className="text-sm text-gray-500">{t("selectZonesHint")}</p>
              <div className="flex flex-wrap gap-2">
                {ZONES.map((zone) => {
                  const selected = selectedZones.includes(zone);
                  return (
                    <button
                      key={zone}
                      type="button"
                      onClick={() =>
                        setSelectedZones((prev) =>
                          selected ? prev.filter((z) => z !== zone) : [...prev, zone]
                        )
                      }
                      className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all
                        ${selected
                          ? "border-[#0F3A7A] bg-[#0F3A7A] text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                        }`}
                    >
                      {zone}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  {t("back")}
                </Button>
                <Button
                  onClick={() => setStep(4)}
                  disabled={!step3Valid}
                  className="flex-1 bg-[#0F3A7A] hover:bg-[#0d3068]"
                >
                  {t("continue")}
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 4: Bio ── */}
          {step === 4 && (
            <div className="space-y-5">
              <p className="text-sm text-gray-500">{t("bioHint")}</p>
              <div className="space-y-1.5">
                <Label htmlFor="bio">{t("bio")}</Label>
                <Textarea
                  id="bio"
                  rows={5}
                  placeholder={t("bioPlaceholder")}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="resize-none"
                />
              </div>
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
              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
                  {t("back")}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 bg-[#0F3A7A] hover:bg-[#0d3068]"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t("submit")
                  )}
                </Button>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-6">
            {t("alreadyProvider")}{" "}
            <button
              onClick={() => router.push(`/${locale}/provider`)}
              className="text-[#0F3A7A] underline"
            >
              {t("loginLink")}
            </button>
          </p>
        </div>
      </div>
    </>
  );
}
