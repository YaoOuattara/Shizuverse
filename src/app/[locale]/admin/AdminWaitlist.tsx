"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import AdminLayout from "./AdminLayout";
import { getAdminToken } from "@/lib/adminAuth";
import ErrorBanner from "@/components/ErrorBanner";
import { Loader2, MapPin, Phone, Users } from "lucide-react";

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL ?? "https://shizu-verse.onrender.com";

interface WaitlistEntry {
  commune: string;
  count: number;
  phones: string[];
}

export default function AdminWaitlist() {
  const params = useParams();
  const isFr = (params?.locale as string) === "fr";

  const [data, setData]       = useState<WaitlistEntry[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [tick, setTick]       = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const token = getAdminToken();
    setLoading(true); setError(false);
    fetch(`${FLASK_API}/api/admin/waitlist`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      // A 503/500 body parses as JSON too — without this guard it would land
      // in .then() as an empty list (the silent-outage pattern we refuse).
      .then((r) => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then((json) => {
        setData(json.waitlist ?? []);
        setTotal(json.total ?? 0);
      })
      .catch((e) => { console.error(e); setError(true); })
      .finally(() => setLoading(false));
  }, [tick]);

  return (
    <AdminLayout title={isFr ? "Liste d'attente" : "Waitlist"}>
      <div className="space-y-6">
        {error && <ErrorBanner isFr={isFr} onRetry={() => setTick((t) => t + 1)} />}
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isFr ? "Zones en attente" : "Pending Zones"}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {isFr
                ? "Communes hors zone de lancement — triées par demande"
                : "Communes outside launch zone — sorted by demand"}
            </p>
          </div>
          {!loading && (
            <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
              <Users className="h-4 w-4 text-green-600" />
              <span className="text-sm font-semibold text-green-700">
                {total} {isFr ? `inscrit${total !== 1 ? "s" : ""}` : `signup${total !== 1 ? "s" : ""}`}
              </span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            {isFr ? "Aucune inscription pour l'instant." : "No signups yet."}
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((entry) => (
              <div key={entry.commune} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === entry.commune ? null : entry.commune)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                      <MapPin className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="font-semibold text-gray-900">{entry.commune}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-0.5">
                      {entry.count} {isFr
                        ? (entry.count === 1 ? "personne" : "personnes")
                        : (entry.count === 1 ? "person" : "people")}
                    </span>
                    <span className="text-gray-400 text-sm">{expanded === entry.commune ? "▲" : "▼"}</span>
                  </div>
                </button>

                {expanded === entry.commune && (
                  <div className="border-t border-gray-100 px-5 py-4 space-y-2">
                    {entry.phones.map((phone, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <a href={`tel:${phone}`} className="hover:text-gray-900 transition-colors">{phone}</a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
