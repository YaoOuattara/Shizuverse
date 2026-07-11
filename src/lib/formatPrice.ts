// Single source of truth for rendering a category's INDICATIVE price.
// Values come from the DB (GET /api/services/categories). Three modes:
//   FOURCHETTE : price_min + price_max → "5 000 – 15 000 FCFA"
//   PLANCHER   : price_min only        → "À partir de 5 000 FCFA"
//   SUR DEVIS  : is_quote_based = true  → "Sur devis" (ignores min/max)
// This is display only — it never constrains the amount_xof locked by admin.

export interface CategoryPricing {
  price_min?: number | null;
  price_max?: number | null;
  is_quote_based?: boolean | null;
}

function xof(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

export function formatPrice(cat: CategoryPricing | null | undefined, isFr: boolean): string {
  const onQuote = isFr ? "Sur devis" : "On request";

  if (!cat || cat.is_quote_based) return onQuote;

  const min = cat.price_min ?? null;
  const max = cat.price_max ?? null;

  // FOURCHETTE
  if (min != null && max != null) {
    return `${new Intl.NumberFormat("fr-FR").format(min)} – ${xof(max)}`;
  }
  // PLANCHER
  if (min != null) {
    return isFr ? `À partir de ${xof(min)}` : `From ${xof(min)}`;
  }
  // Ni min ni max renseignés → devis
  return onQuote;
}
