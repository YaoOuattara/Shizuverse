const BASE_URL = process.env.NEXT_PUBLIC_FLASK_API_URL || "https://shizu-verse.onrender.com";

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

export const providerApi = {
  getBookings: (providerId?: number) =>
    apiFetch(`/api/provider/bookings${providerId ? `?provider_id=${providerId}` : ""}`),
  updateBookingStatus: (id: number, status: string) =>
    apiFetch(`/api/provider/bookings/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
};

export const adminApi = {
  getStats: () => apiFetch("/api/admin/stats"),
  getBookings: (status?: string) => apiFetch(`/api/admin/bookings${status ? `?status=${status}` : ""}`),
  updateBookingStatus: (id: number, status: string) =>
    apiFetch(`/api/admin/bookings/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getProviders: (status?: string) => apiFetch(`/api/admin/providers${status ? `?status=${status}` : ""}`),
  verifyProvider: (id: number) =>
    apiFetch(`/api/admin/providers/${id}/verify`, { method: "PATCH" }),
  getServices: () => apiFetch("/api/admin/services"),
};

export default apiFetch;
