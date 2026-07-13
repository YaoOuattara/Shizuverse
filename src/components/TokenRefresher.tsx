"use client";

// Sliding JWT refresh for the admin & provider surfaces (tokens now expire
// after 8h). Calls the backend /refresh endpoint on tab focus and on a 30-min
// heartbeat *while the user is active*, so an in-session user is never logged
// out — but an idle/abandoned device still lapses within 8h. On an expired
// token (401) it redirects cleanly to the matching login (no crash, no blank).

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

const FLASK_API = process.env.NEXT_PUBLIC_FLASK_API_URL || "https://shizu-verse.onrender.com";
const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 min heartbeat

type Kind = "admin" | "provider";

const CONFIG: Record<Kind, { key: string; path: string; login: string }> = {
  admin:    { key: "shizu_admin_token", path: "/api/admin/refresh",    login: "admin/login" },
  provider: { key: "provider_token",    path: "/api/provider/refresh", login: "provider/login" },
};

// Provider tokens may live in localStorage OR sessionStorage (remember-me).
function readToken(key: string): { token: string; store: Storage } | null {
  try {
    const l = localStorage.getItem(key);
    if (l) return { token: l, store: localStorage };
    const s = sessionStorage.getItem(key);
    if (s) return { token: s, store: sessionStorage };
  } catch {
    /* storage unavailable */
  }
  return null;
}

export default function TokenRefresher({ kind }: { kind: Kind }) {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "fr";
  const cfg = CONFIG[kind];

  const inFlight = useRef(false);
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    const refresh = async () => {
      if (inFlight.current) return;
      const cur = readToken(cfg.key);
      if (!cur) return; // not logged in on this surface — nothing to refresh
      inFlight.current = true;
      try {
        const res = await fetch(`${FLASK_API}${cfg.path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${cur.token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.token) cur.store.setItem(cfg.key, data.token);
        } else if (res.status === 401) {
          // Expired/invalid — clean redirect to login, never a crash.
          try {
            localStorage.removeItem(cfg.key);
            sessionStorage.removeItem(cfg.key);
          } catch {
            /* ignore */
          }
          router.replace(`/${locale}/${cfg.login}`);
        }
        // network / 5xx: keep the token and retry on the next tick/focus
      } catch {
        /* offline — keep token, retry later */
      } finally {
        inFlight.current = false;
      }
    };

    const markActive = () => { lastActivity.current = Date.now(); };
    const onFocus = () => { markActive(); refresh(); };
    const onVisible = () => { if (!document.hidden) onFocus(); };

    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    activityEvents.forEach((e) => window.addEventListener(e, markActive, { passive: true }));
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    // Initial refresh (covers a fresh page load with a mid-life token)
    refresh();
    // Heartbeat: only refresh if the user was active in the last window.
    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current < REFRESH_INTERVAL_MS) refresh();
    }, REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      activityEvents.forEach((e) => window.removeEventListener(e, markActive));
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [cfg, locale, router]);

  return null;
}
