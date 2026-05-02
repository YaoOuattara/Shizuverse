"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import AdminLayout from "./AdminLayout";
import { getAdminToken } from "@/lib/adminAuth";
import { Search, Loader2, Phone, User, CalendarDays, KeyRound, CheckCircle, Eye, EyeOff } from "lucide-react";

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com";

interface ClientRow {
  id: number;
  name: string;
  phone: string;
  account_type: string;
  registered_at: string | null;
  booking_count: number;
}

export default function AdminClients() {
  const params = useParams();
  const isFr = (params?.locale as string) === "fr";

  const [query, setQuery]           = useState("");
  const [clients, setClients]       = useState<ClientRow[]>([]);
  const [loading, setLoading]       = useState(false);
  const [searched, setSearched]     = useState(false);

  // Password reset modal
  const [selected, setSelected]     = useState<ClientRow | null>(null);
  const [newPw, setNewPw]           = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [resetting, setResetting]   = useState(false);
  const [resetDone, setResetDone]   = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSearched(true);
    try {
      const token = getAdminToken();
      const res = await fetch(`${FLASK_API}/api/admin/clients?phone=${encodeURIComponent(query.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setClients(data.clients ?? []);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!selected || !newPw.trim() || resetting) return;
    setResetting(true);
    setResetError(null);
    try {
      const token = getAdminToken();
      const res = await fetch(`${FLASK_API}/api/admin/clients/${selected.id}/reset-password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ new_password: newPw.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setResetError(data.error ?? (isFr ? "Erreur" : "Error")); return; }
      setResetDone(true);
    } catch {
      setResetError(isFr ? "Erreur réseau." : "Network error.");
    } finally {
      setResetting(false);
    }
  }

  function openModal(client: ClientRow) {
    setSelected(client);
    setNewPw("");
    setShowPw(false);
    setResetDone(false);
    setResetError(null);
  }

  function closeModal() {
    setSelected(null);
  }

  function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(isFr ? "fr-FR" : "en-US", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <AdminLayout title={isFr ? "Clients" : "Clients"}>
      <div className="space-y-5 max-w-2xl">

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={isFr ? "Rechercher par téléphone ou nom..." : "Search by phone or name..."}
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button type="submit" disabled={loading}
            className="flex items-center gap-1.5 bg-[#0F3A7A] hover:bg-[#0d3068] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {isFr ? "Rechercher" : "Search"}
          </button>
        </form>

        {/* Results */}
        {searched && !loading && (
          clients.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              {isFr
                ? <>Aucun client trouvé pour <span className="font-medium">"{query}"</span></>
                : <>No client found for <span className="font-medium">"{query}"</span></>}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {clients.length} {isFr
                  ? `client${clients.length > 1 ? "s" : ""} trouvé${clients.length > 1 ? "s" : ""}`
                  : `client${clients.length > 1 ? "s" : ""} found`}
              </p>
              {clients.map(c => (
                <div key={c.id} className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#0F3A7A]/10 flex items-center justify-center shrink-0">
                        <User className="h-3.5 w-3.5 text-[#0F3A7A]" />
                      </div>
                      <p className="font-semibold text-sm text-foreground truncate">{c.name || "—"}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span className="font-mono">{c.phone}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(c.registered_at)}
                      </span>
                      <span>
                        {c.booking_count} {isFr
                          ? `réservation${c.booking_count !== 1 ? "s" : ""}`
                          : `booking${c.booking_count !== 1 ? "s" : ""}`}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => openModal(c)}
                    className="shrink-0 flex items-center gap-1.5 border border-amber-300 text-amber-700 hover:bg-amber-50 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                    <KeyRound className="h-3.5 w-3.5" />
                    {isFr ? "Réinitialiser" : "Reset"}
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Password reset modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-bold text-gray-900">
              {isFr ? "Réinitialiser le mot de passe" : "Reset Password"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isFr ? "Client :" : "Client:"} <span className="font-semibold text-foreground">{selected.name || selected.phone}</span>
            </p>

            {resetDone ? (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium">
                  {isFr ? "Mot de passe mis à jour." : "Password updated."}
                </span>
              </div>
            ) : (
              <>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    placeholder={isFr ? "Nouveau mot de passe (6 car. min.)" : "New password (min. 6 chars)"}
                    className="w-full border border-input rounded-xl px-3 py-2.5 pr-10 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {resetError && <p className="text-xs text-red-600">{resetError}</p>}
                <div className="flex gap-2 pt-1">
                  <button onClick={closeModal}
                    className="flex-1 border border-input text-sm font-medium py-2.5 rounded-xl hover:bg-muted transition-colors">
                    {isFr ? "Annuler" : "Cancel"}
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={!newPw.trim() || newPw.length < 6 || resetting}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5">
                    {resetting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isFr ? "Réinitialiser" : "Reset"}
                  </button>
                </div>
              </>
            )}

            {resetDone && (
              <button onClick={closeModal}
                className="w-full border border-input text-sm font-medium py-2.5 rounded-xl hover:bg-muted transition-colors">
                {isFr ? "Fermer" : "Close"}
              </button>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
