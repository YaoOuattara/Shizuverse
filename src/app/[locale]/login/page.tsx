"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Eye, EyeOff, MessageCircle } from "lucide-react";
import PhoneInput from "@/components/PhoneInput";

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com";
const SHIZU_WA  = (process.env.NEXT_PUBLIC_SHIZU_WHATSAPP ?? "").replace(/\D/g, "");

export default function LoginPage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";
  const router = useRouter();
  const isFr   = locale === "fr";

  const [phone, setPhone]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const waForgot = SHIZU_WA
    ? `https://wa.me/${SHIZU_WA}?text=${encodeURIComponent("Bonjour Shizu, j'ai oublié mon mot de passe client.")}`
    : "#";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const normalizedPhone = phone.replace(/\s+/g, "");
      const res = await fetch(`${FLASK_API}/api/client/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? (isFr ? "Identifiants incorrects." : "Incorrect credentials."));
        return;
      }
      localStorage.setItem("client_token", data.token);
      localStorage.setItem("client_info", JSON.stringify(data.client));
      localStorage.setItem("shizu_client_phone", normalizedPhone);
      router.push(`/${locale}/client/dashboard`);
    } catch {
      setError(isFr ? "Erreur réseau. Veuillez réessayer." : "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">

        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {isFr ? "Bon retour !" : "Welcome back!"}
        </h1>
        <p className="text-sm text-gray-400 mb-8">
          {isFr ? "Connectez-vous pour suivre vos réservations." : "Log in to track your bookings."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {isFr ? "Numéro WhatsApp" : "WhatsApp number"}
            </label>
            <PhoneInput
              defaultValue={phone}
              onChange={setPhone}
              autoFocus
              required
              selectClassName="rounded-l-xl border-gray-200 bg-gray-50 text-gray-500"
              inputClassName="rounded-r-xl border-gray-200 py-3 focus:ring-green-500"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {isFr ? "Mot de passe" : "Password"}
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 placeholder:text-gray-300"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !phone.trim() || !password}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            {submitting ? (
              <span className="inline-block h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              isFr ? "Se connecter" : "Log in"
            )}
          </button>
        </form>

        <div className="mt-5 space-y-3 text-center">
          {SHIZU_WA && (
            <p className="text-xs text-gray-400">
              {isFr ? "Mot de passe oublié ?" : "Forgot password?"}{" "}
              <a
                href={waForgot}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 font-medium hover:underline inline-flex items-center gap-1"
              >
                <MessageCircle className="h-3 w-3" />
                WhatsApp
              </a>
            </p>
          )}
          <p className="text-xs text-gray-400">
            {isFr ? "Pas encore de compte ?" : "No account yet?"}{" "}
            <a href={`/${locale}/register`} className="text-green-600 font-medium hover:underline">
              {isFr ? "Créer mon compte" : "Create account"}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
