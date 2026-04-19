"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";

const FLASK_API =
  process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com";

export default function ClientRegisterPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";
  const isFr = locale === "fr";
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"individual" | "company">("individual");
  const [companyName, setCompanyName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid =
    fullName.trim().length >= 2 &&
    phone.trim().length >= 8 &&
    password.length >= 6 &&
    (accountType === "individual" || companyName.trim().length >= 2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${FLASK_API}/api/client/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          password,
          account_type: accountType,
          company_name: accountType === "company" ? companyName.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: isFr ? "Erreur" : "Error",
          description: data.error || (isFr ? "Inscription impossible." : "Registration failed."),
          variant: "destructive",
        });
        return;
      }
      // Persist token and client info
      localStorage.setItem("client_token", data.token);
      localStorage.setItem("client_info", JSON.stringify(data.client));
      toast({
        title: isFr ? "Compte créé !" : "Account created!",
        description: isFr
          ? "Bienvenue sur Shizu. Vous pouvez maintenant réserver un service."
          : "Welcome to Shizu. You can now book a service.",
      });
      router.push(`/${locale}/bookings`);
    } catch {
      toast({
        title: isFr ? "Erreur réseau" : "Network error",
        description: isFr ? "Réessayez dans un moment." : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full">
        {/* Back */}
        <button
          onClick={() => router.push(`/${locale}`)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {isFr ? "Retour à l'accueil" : "Back to home"}
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {isFr ? "Créer un compte client" : "Create a client account"}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {isFr
              ? "Réservez vos services en quelques clics."
              : "Book home services in just a few clicks."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Account type toggle */}
          <div className="space-y-2">
            <Label>{isFr ? "Type de compte" : "Account type"}</Label>
            <div className="grid grid-cols-2 gap-3">
              {(["individual", "company"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAccountType(type)}
                  className={`flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all text-sm font-medium
                    ${accountType === type
                      ? "border-[#0F3A7A] bg-[#0F3A7A]/5 text-[#0F3A7A]"
                      : "border-gray-100 bg-white text-gray-600 hover:border-gray-200"
                    }`}
                >
                  <span className="text-xl">{type === "individual" ? "👤" : "🏢"}</span>
                  <span>
                    {type === "individual"
                      ? (isFr ? "Particulier" : "Individual")
                      : (isFr ? "Entreprise" : "Company")}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Company name — only when Entreprise */}
          {accountType === "company" && (
            <div className="space-y-1.5">
              <Label htmlFor="company_name">
                {isFr ? "Nom de l'entreprise" : "Company name"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="company_name"
                placeholder={isFr ? "Ex: Mon Entreprise SARL" : "e.g. My Company Ltd"}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
          )}

          {/* Full name */}
          <div className="space-y-1.5">
            <Label htmlFor="full_name">
              {isFr ? "Nom complet" : "Full name"}
            </Label>
            <Input
              id="full_name"
              placeholder={isFr ? "Kouamé Yao" : "John Doe"}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone">
              {isFr ? "Numéro de téléphone" : "Phone number"}
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="07 XX XX XX XX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password">
              {isFr ? "Mot de passe" : "Password"}
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-gray-400">
              {isFr ? "6 caractères minimum" : "At least 6 characters"}
            </p>
          </div>

          <Button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full bg-[#0F3A7A] hover:bg-[#0d3068]"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {isFr ? "Créer mon compte" : "Create my account"}
          </Button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          {isFr ? "Déjà un compte ?" : "Already have an account?"}{" "}
          <button
            onClick={() => router.push(`/${locale}/bookings`)}
            className="text-[#0F3A7A] underline"
          >
            {isFr ? "Réserver directement" : "Book directly"}
          </button>
        </p>
      </div>
    </div>
  );
}
