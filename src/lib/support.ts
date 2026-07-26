/**
 * Numéro WhatsApp support Shizu — SOURCE UNIQUE.
 *
 * Env-overridable via NEXT_PUBLIC_SHIZU_WHATSAPP. Le défaut est le sender
 * WhatsApp Shizu (+225 05 54 01 89 89, numéro public — pas un secret) : un
 * défaut vide donnerait un bouton WhatsApp mort dès que l'env var manque.
 * Les appelants gardent leur garde « masquer si vide » comme filet.
 */
export const SHIZU_WHATSAPP = (process.env.NEXT_PUBLIC_SHIZU_WHATSAPP ?? "+2250554018989").replace(/\D/g, "");

/** Href wa.me prêt à l'emploi ("" si aucun numéro configuré). */
export function shizuWaHref(text?: string): string {
  if (!SHIZU_WHATSAPP) return "";
  const qs = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${SHIZU_WHATSAPP}${qs}`;
}
