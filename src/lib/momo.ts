// Mobile Money (Côte d'Ivoire) — canonical form is the LOCAL 10-digit number
// (e.g. 0707050154), never E.164. Mirrors the backend utils/phone.py so the UI
// accepts the way people type it (+225…, 225…, 00225…, spaces) and validates
// the normalized local result.

export function normalizeCiMomo(input: string): string {
  if (!input) return "";
  let d = input.replace(/[\s\-.()]/g, "").replace(/\+/g, "");
  if (d.startsWith("00225")) d = d.slice(5);
  else if (d.startsWith("225") && d.length === 13) d = d.slice(3);
  return d;
}

export function isValidCiMomo(localDigits: string): boolean {
  return /^0\d{9}$/.test(localDigits);
}
