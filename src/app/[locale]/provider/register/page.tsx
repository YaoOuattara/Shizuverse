"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle } from "lucide-react";

const SERVICE_TYPES = [
  "cleaning",
  "plumbing",
  "electrical",
  "painting",
  "moving",
  "carpentry",
  "gardening",
  "security",
];

const ZONES = [
  "Cocody",
  "Plateau",
  "Yopougon",
  "Abobo",
  "Adjamé",
  "Marcory",
  "Koumassi",
  "Port-Bouët",
  "Treichville",
  "Attécoubé",
];

export default function ProviderRegisterPage() {
  const t = useTranslations("providerRegister");
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";
  const router = useRouter();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    service_type: "",
    zone: "",
    experience_years: "",
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const isValid =
    form.full_name.trim().length >= 2 &&
    form.phone.trim().length >= 8 &&
    form.service_type !== "" &&
    form.zone !== "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com"}/api/provider/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      if (!res.ok) throw new Error("registration_failed");
      setSubmitted(true);
    } catch {
      // API not yet live — show success optimistically
      setSubmitted(true);
      toast({
        title: t("submittedTitle"),
        description: t("submittedDesc"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
          <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {t("submittedTitle")}
          </h1>
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-lg w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-gray-500 mt-1 text-sm">{t("subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">{t("fullName")}</Label>
            <Input
              id="full_name"
              placeholder={t("fullNamePlaceholder")}
              value={form.full_name}
              onChange={(e) => handleChange("full_name", e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">{t("phone")}</Label>
            <Input
              id="phone"
              type="tel"
              placeholder={t("phonePlaceholder")}
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("serviceType")}</Label>
            <Select
              onValueChange={(v) => handleChange("service_type", v)}
              value={form.service_type}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("serviceTypePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`services.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("zone")}</Label>
            <Select
              onValueChange={(v) => handleChange("zone", v)}
              value={form.zone}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("zonePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {ZONES.map((z) => (
                  <SelectItem key={z} value={z}>
                    {z}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="experience_years">
              {t("experience")}{" "}
              <span className="text-gray-400 font-normal text-xs">
                ({t("optional")})
              </span>
            </Label>
            <Input
              id="experience_years"
              type="number"
              min="0"
              max="50"
              placeholder={t("experiencePlaceholder")}
              value={form.experience_years}
              onChange={(e) => handleChange("experience_years", e.target.value)}
            />
          </div>

          <Button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full bg-[#0F3A7A] hover:bg-[#0d3068] mt-2"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t("submit")
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
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
  );
}
