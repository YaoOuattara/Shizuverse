const TOKEN_KEY = "shizu_admin_token";

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

export function clearAdminToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function isAdminAuthenticated(): boolean {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return false;

    // Decode JWT payload (base64url, no signature verification needed client-side)
    const parts = token.split(".");
    if (parts.length !== 3) {
      localStorage.removeItem(TOKEN_KEY);
      return false;
    }
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const exp = payload?.exp;
    if (typeof exp === "number" && Date.now() / 1000 >= exp) {
      localStorage.removeItem(TOKEN_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
