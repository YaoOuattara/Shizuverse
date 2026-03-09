import { getAdminToken } from "./adminAuth";

const BASE_URL = process.env.NEXT_PUBLIC_FLASK_API_URL || "https://shizu-verse.onrender.com";

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    let body = "";
    try { body = await res.text(); } catch { /* ignore */ }
    throw new Error(`API error ${res.status}: ${path} — ${body}`);
  }
  return res.json();
}

function adminFetch(path: string, options: RequestInit = {}) {
  const token = getAdminToken();
  return apiFetch(path, {
    ...options,
    headers: {
      ...(options.headers as Record<string, string>),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export const providerApi = {
  getBookings: (providerId?: number) =>
    apiFetch(`/api/provider/bookings${providerId ? `?provider_id=${providerId}` : ""}`),
  updateBookingStatus: (id: number, status: string) =>
    apiFetch(`/api/provider/bookings/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
};

export const adminApi = {
  login: (password: string) =>
    apiFetch("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) }),
  getStats: () => adminFetch("/api/admin/stats"),
  getBookings: (status?: string) => adminFetch(`/api/admin/bookings${status ? `?status=${status}` : ""}`),
  updateBookingStatus: (id: number, status: string) =>
    adminFetch(`/api/admin/bookings/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getProviders: (status?: string) => adminFetch(`/api/admin/providers${status ? `?status=${status}` : ""}`),
  verifyProvider: (id: number) =>
    adminFetch(`/api/admin/providers/${id}/verify`, { method: "PATCH" }),
  getServices: () => adminFetch("/api/admin/services"),
};

export default apiFetch;
