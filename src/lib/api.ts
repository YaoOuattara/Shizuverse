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
  updateBookingStatusPut: (id: number, status: string) =>
    adminFetch(`/api/admin/bookings/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
  assignBooking: (id: number, provider_name: string, provider_phone: string) =>
    adminFetch(`/api/admin/bookings/${id}/assign`, { method: "PUT", body: JSON.stringify({ provider_name, provider_phone }) }),
  getProviders: (status?: string) => adminFetch(`/api/admin/providers${status ? `?status=${status}` : ""}`),
  verifyProvider: (id: number) =>
    adminFetch(`/api/admin/providers/${id}/verify`, { method: "PATCH" }),
  getServices: () => adminFetch("/api/admin/services"),
  patchService: (id: number, body: { is_active?: boolean; is_priority?: boolean; featured?: boolean; name?: string }) =>
    adminFetch(`/api/admin/services/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  // New admin portal endpoints (/admin/* blueprint)
  portalGetProviders: (params?: { verification_status?: string; listed_status?: string; provider_status?: string }) => {
    const qs = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => !!v) as [string, string][]).toString() : "";
    return adminFetch(`/admin/providers${qs ? `?${qs}` : ""}`);
  },
  portalGetProviderDetail: (id: number) => adminFetch(`/admin/providers/${id}`),
  portalApproveProvider: (id: number) =>
    adminFetch(`/admin/providers/${id}/approve`, { method: "POST", body: JSON.stringify({}) }),
  portalRejectProvider: (id: number, reason: string, note?: string) =>
    adminFetch(`/admin/providers/${id}/reject`, { method: "POST", body: JSON.stringify({ reason, note: note || "" }) }),
  portalSuspendProvider: (id: number, reason?: string) =>
    adminFetch(`/admin/providers/${id}/suspend`, { method: "POST", body: JSON.stringify({ reason: reason || "" }) }),
  portalReinstateProvider: (id: number) =>
    adminFetch(`/admin/providers/${id}/reinstate`, { method: "POST", body: JSON.stringify({}) }),
  portalToggleListing: (id: number, action: "list" | "unlist") =>
    adminFetch(`/admin/providers/${id}/listing`, { method: "POST", body: JSON.stringify({ action }) }),
  portalToggleActivation: (id: number, action: "activate" | "pause") =>
    adminFetch(`/admin/providers/${id}/activation`, { method: "POST", body: JSON.stringify({ action }) }),
  patchProviderServices: (id: number, services: string[]) =>
    adminFetch(`/admin/providers/${id}/services`, { method: "PATCH", body: JSON.stringify({ services }) }),
  portalGetBookings: (params?: { status?: string; payment_status?: string; payout_status?: string }) => {
    const qs = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => !!v).map(([k, v]) => [k, v as string])).toString() : "";
    return adminFetch(`/admin/bookings${qs ? `?${qs}` : ""}`);
  },
  portalGetFinanceSummary: () => adminFetch("/admin/finance/summary"),
  portalUpdateFinance: (bookingId: string, body: { payment_status?: string; payout_status?: string }) =>
    adminFetch(`/admin/bookings/${bookingId}/finance`, { method: "POST", body: JSON.stringify(body) }),
  portalSetBookingQuote: (bookingId: string, amount_xof: number) =>
    adminFetch(`/admin/bookings/${bookingId}/quote`, { method: 'POST', body: JSON.stringify({ amount_xof }) }),
  portalCancelBooking: (bookingId: number, reason?: string) =>
    adminFetch(`/admin/bookings/${bookingId}/cancel`, { method: 'POST', body: JSON.stringify({ reason: reason || '' }) }),
  portalGetReviews: (params?: { status?: string }) => {
    const qs = params?.status ? `?status=${params.status}` : "";
    return adminFetch(`/admin/reviews${qs}`);
  },
  portalModerateReview: (id: number, status: string, reason?: string) =>
    adminFetch(`/admin/reviews/${id}/moderate`, { method: "POST", body: JSON.stringify({ status, reason: reason || "" }) }),
};

export default apiFetch;
