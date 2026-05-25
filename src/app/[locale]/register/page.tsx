"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, MessageCircle, Eye, EyeOff, Check } from "lucide-react";
import PhoneInput from "@/components/PhoneInput";

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com";
const SHIZU_WA  = (process.env.NEXT_PUBLIC_SHIZU_WHATSAPP ?? "").replace(/\D/g, "");

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex items-center mb-8">
      {[1, 2, 3].map((n, i) => {
        const done    = n < step;
        const current = n === step;
        return (
          <div key={n} className="flex items-center flex-1 last:flex-none">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold transition-colors ${
              done    ? "bg-green-500 text-white" :
              current ? "bg-green-600 text-white ring-4 ring-green-100" :
                        "bg-gray-200 text-gray-400"
            }`}>
              {done ? <Check className="h-4 w-4" /> : n}
            </div>
            {i < 2 && (
              <div className={`flex-1 h-0.5 mx-1 transition-colors ${done ? "bg-green-400" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function RegisterPage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";
  const router = useRouter();
  const isFr   = locale === "fr";

  const [step, setStep]           = useState(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [phone, setPhone]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [showCf, setShowCf]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]     = useState(false);

  const step1Valid = firstName.trim().length >= 1 && lastName.trim().length >= 1;
  const step2Valid = phone.trim().length >= 8;
  const step3Valid =
    password.length >= 8 && password === confirm;

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const normalizedPhone = phone.replace(/\s+/g, "");
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const res = await fetch(`${FLASK_API}/api/client/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          phone: normalizedPhone,
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? (isFr ? "Une erreur est survenue." : "Something went wrong."));
        return;
      }
      localStorage.setItem("client_token", data.token);
      localStorage.setItem("client_info", JSON.stringify(data.client));
      localStorage.setItem("shizu_client_phone", normalizedPhone);
      setSuccess(true);
    } catch {
      setError(isFr ? "Erreur réseau. Veuillez réessayer." : "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const waSupport = SHIZU_WA
    ? `https://wa.me/${SHIZU_WA}?text=${encodeURIComponent("Bonjour Shizu, j'ai besoin d'aide pour créer mon compte.")}`
    : "#";

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) {
    const waWelcome = SHIZU_WA
      ? `https://wa.me/${SHIZU_WA}?text=${encodeURIComponent(isFr ? "Bonjour Shizu, je viens de créer mon compte !" : "Hello Shizu, I just created my account!")}`
      : "#";
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
          <div className="text-center mb-7">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              {isFr ? `Bienvenue ${firstName} !` : `Welcome ${firstName}!`}
            </h1>
            <p className="text-sm font-semibold text-gray-800 mt-1">
              {isFr ? "Votre compte Shizu est prêt." : "Your Shizu account is ready."}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              {isFr
                ? "Vous pouvez maintenant réserver des prestataires vérifiés à Abidjan."
                : "You can now book verified providers in Abidjan."}
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => router.push(`/${locale}/services`)}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              {isFr ? "Faire ma première réservation" : "Make my first booking"}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => router.push(`/${locale}/client/dashboard`)}
              className="w-full flex items-center justify-center gap-2 bg-[#0F3A7A] hover:bg-[#0d3068] text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              {isFr ? "Voir mes réservations" : "View my bookings"}
            </button>
            {SHIZU_WA && (
              <a
                href={waWelcome}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5c] text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                <MessageCircle className="h-4 w-4" />
                💬 {isFr ? "Contacter Shizu" : "Contact Shizu"}
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">

        <img
          src="https://res.cloudinary.com/ddilgv5ir/image/upload/v1779646648/shizu_logo_horizontal_dark_khesrn.png"
          alt="Shizu"
          style={{ height: '48px', width: 'auto', objectFit: 'contain', margin: '0 auto 20px', display: 'block' }}
        />

        {/* Back */}
        <button
          onClick={() => step > 1 ? setStep(s => s - 1) : router.push(`/${locale}`)}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-6 -mt-1 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {step > 1 ? (isFr ? "Retour" : "Back") : (isFr ? "Accueil" : "Home")}
        </button>

        <ProgressBar step={step} />

        {/* ── Step 1: Name ────────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              {isFr ? "Comment vous appelez-vous ?" : "What's your name?"}
            </h1>
            <p className="text-sm text-gray-400 mb-6">
              {isFr ? "Étape 1 sur 3" : "Step 1 of 3"}
            </p>
            <div className="space-y-3">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={isFr ? "Prénom — ex. Kouassi" : "First name — e.g. Kouassi"}
                autoFocus
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 placeholder:text-gray-300"
              />
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={isFr ? "Nom — ex. Marie" : "Last name — e.g. Marie"}
                onKeyDown={(e) => e.key === "Enter" && step1Valid && setStep(2)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 placeholder:text-gray-300"
              />
              <button
                onClick={() => setStep(2)}
                disabled={!step1Valid}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                {isFr ? "Continuer" : "Continue"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Phone ───────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              {isFr ? "Votre numéro WhatsApp ?" : "Your WhatsApp number?"}
            </h1>
            <p className="text-sm text-gray-400 mb-6">
              {isFr ? "Étape 2 sur 3" : "Step 2 of 3"}
            </p>
            <div className="space-y-4">
              <div>
                <PhoneInput
                  defaultValue={phone}
                  onChange={setPhone}
                  autoFocus
                  required
                  selectClassName="rounded-l-xl border-gray-200 bg-gray-50 text-gray-500"
                  inputClassName="rounded-r-xl border-gray-200 focus:ring-green-500 py-3"
                />
                <p className="text-xs text-gray-400 mt-2">
                  {isFr
                    ? "Utilisé uniquement pour vos réservations Shizu"
                    : "Used only for your Shizu bookings"}
                </p>
              </div>
              <button
                onClick={() => setStep(3)}
                disabled={!step2Valid}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                {isFr ? "Continuer" : "Continue"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Password ────────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              {isFr ? "Créez votre mot de passe" : "Create your password"}
            </h1>
            <p className="text-sm text-gray-400 mb-6">
              {isFr ? "Étape 3 sur 3" : "Step 3 of 3"}
            </p>
            <div className="space-y-4">
              {/* Password */}
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isFr ? "Mot de passe (8 caractères min.)" : "Password (min. 8 chars)"}
                  autoFocus
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
              {password.length > 0 && password.length < 8 && (
                <p className="text-xs text-red-500">
                  {isFr
                    ? "Le mot de passe doit contenir au moins 8 caractères"
                    : "Password must be at least 8 characters"}
                </p>
              )}
              {/* Confirm */}
              <div className="relative">
                <input
                  type={showCf ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={isFr ? "Confirmez le mot de passe" : "Confirm password"}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 placeholder:text-gray-300"
                />
                <button
                  type="button"
                  onClick={() => setShowCf(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Nudge */}
              <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-xs text-green-700">
                {isFr
                  ? "Vos réservations passées seront automatiquement liées à votre compte"
                  : "Your past bookings will be automatically linked to your account"}
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              {confirm && password === confirm && password.length >= 8 && (
                <p className="text-xs text-green-600 font-medium">✓ {isFr ? "Mots de passe identiques" : "Passwords match"}</p>
              )}
              {confirm && password !== confirm && (
                <p className="text-xs text-red-500">✗ {isFr ? "Les mots de passe ne correspondent pas." : "Passwords do not match."}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={!step3Valid || submitting}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                {submitting ? (
                  <span className="inline-block h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {isFr ? "Créer mon compte" : "Create my account"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              {/* WhatsApp support — step 3 only */}
              {SHIZU_WA && (
                <p className="text-center text-xs text-gray-400">
                  {isFr ? "Besoin d'aide ?" : "Need help?"}{" "}
                  <a
                    href={waSupport}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 font-medium hover:underline inline-flex items-center gap-1"
                  >
                    <MessageCircle className="h-3 w-3" />
                    WhatsApp
                  </a>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Already have account */}
        {step < 3 && (
          <p className="text-center text-xs text-gray-400 mt-6">
            {isFr ? "Déjà un compte ?" : "Already have an account?"}{" "}
            <a href={`/${locale}/login`} className="text-green-600 font-medium hover:underline">
              {isFr ? "Se connecter" : "Log in"}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
