// Single source for time-slot / time-preference labels.
// Values are stored in English in the DB (morning/afternoon/evening/anytime);
// translate at display so nothing leaks raw ("evening") to the client.

const TIME_SLOT_LABELS: Record<string, { fr: string; en: string }> = {
  anytime:   { fr: "Flexible",             en: "Anytime" },
  morning:   { fr: "Matin · 8h–12h",        en: "Morning · 8–12" },
  afternoon: { fr: "Après-midi · 12h–17h",  en: "Afternoon · 12–17" },
  evening:   { fr: "Soirée · 17h–20h",      en: "Evening · 17–20" },
};

export function timeSlotLabel(value: string | null | undefined, isFr: boolean): string {
  if (!value) return "";
  const e = TIME_SLOT_LABELS[value];
  return e ? e[isFr ? "fr" : "en"] : value; // unknown value → raw (defensive)
}
