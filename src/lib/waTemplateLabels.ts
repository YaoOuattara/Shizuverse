// Libellés humains des templates WhatsApp — même geste qu'EVENT_LABELS pour la
// timeline : une clé inconnue s'affiche en BRUT, jamais masquée (le masquage
// silencieux est ce qui rendait l'historique illisible).
//
// Les clés du registre suffixent la locale du MESSAGE (_fr/_en) ; le libellé
// décrit le CONTENU, identique dans les deux cas — on indexe donc sur la base,
// suffixe retiré. Le suffixe (prestataire) / (client) dit le DESTINATAIRE :
// dans un fil, « Annulation » seul ne dit pas à qui on a écrit.

const BASE_LABELS: Record<string, { fr: string; en: string }> = {
  // ── Client ──
  shizu_booking_created:            { fr: "Confirmation de demande (client)",        en: "Request confirmation (client)" },
  shizu_devis:                      { fr: "Devis envoyé (client)",                   en: "Quote sent (client)" },
  shizu_provider_assigned:          { fr: "Prestataire trouvé (client)",             en: "Provider found (client)" },
  shizu_booking_confirmed:          { fr: "Réservation confirmée (client)",          en: "Booking confirmed (client)" },
  shizu_payment_confirmed:          { fr: "Paiement confirmé (client)",              en: "Payment confirmed (client)" },
  shizu_deposit_received:           { fr: "Acompte reçu (client)",                   en: "Deposit received (client)" },
  shizu_provider_started:           { fr: "Prestation démarrée (client)",            en: "Service started (client)" },
  shizu_booking_completed:          { fr: "Mission terminée (client)",               en: "Mission completed (client)" },
  shizu_booking_cancelled_client:   { fr: "Annulation (client)",                     en: "Cancellation (client)" },
  shizu_booking_rescheduled_client: { fr: "Reprogrammation (client)",                en: "Rescheduled (client)" },
  shizu_dispute_opened_client:      { fr: "Litige ouvert (client)",                  en: "Dispute opened (client)" },
  shizu_dispute_refund_client:      { fr: "Litige : remboursement (client)",         en: "Dispute: refund (client)" },
  shizu_dispute_closed_client:      { fr: "Litige clos (client)",                    en: "Dispute closed (client)" },
  // ── Prestataire (toujours _fr, T-19) ──
  shizu_provider_registration:        { fr: "Candidature reçue (prestataire)",             en: "Application received (provider)" },
  shizu_provider_approved:            { fr: "Profil approuvé (prestataire)",               en: "Profile approved (provider)" },
  shizu_provider_rejected:            { fr: "Profil refusé (prestataire)",                 en: "Profile rejected (provider)" },
  shizu_provider_new_mission:         { fr: "Nouvelle mission (prestataire)",              en: "New mission (provider)" },
  shizu_provider_booking_confirmed:   { fr: "Mission confirmée (prestataire)",             en: "Mission confirmed (provider)" },
  shizu_booking_cancelled_provider:   { fr: "Annulation (prestataire)",                    en: "Cancellation (provider)" },
  shizu_booking_rescheduled_provider: { fr: "Reprogrammation (prestataire)",               en: "Rescheduled (provider)" },
  shizu_payment_recorded:             { fr: "Paiement enregistré (prestataire)",           en: "Payment recorded (provider)" },
  shizu_payout_sent:                  { fr: "Versement envoyé (prestataire)",              en: "Payout sent (provider)" },
  shizu_review_received:              { fr: "Avis reçu (prestataire)",                     en: "Review received (provider)" },
  shizu_dispute_opened_provider:      { fr: "Litige ouvert (prestataire)",                 en: "Dispute opened (provider)" },
  shizu_dispute_released_provider:    { fr: "Litige : versement débloqué (prestataire)",   en: "Dispute: payout released (provider)" },
  shizu_dispute_no_payment_provider:  { fr: "Litige : clôturé sans règlement (prestataire)", en: "Dispute: closed without payment (provider)" },
};

/** Libellé humain d'une clé de template ; la clé brute pour toute inconnue. */
export function waTemplateLabel(key: string, isFr: boolean): string {
  const base = key.replace(/_(fr|en)$/, "");
  const entry = BASE_LABELS[base];
  return entry ? entry[isFr ? "fr" : "en"] : key;
}
