/**
 * Currency formatting utilities for the Shizu marketplace
 * 
 * App-wide currency display: CFA (West African CFA Franc)
 * Format: "12 500 CFA" (space as thousand separator, no decimals)
 */

export const APP_LOCALE = (process.env.NEXT_PUBLIC_LOCALE ?? "fr-CI") as string;

/**
 * Format money as "12 500 CFA" using Intl.NumberFormat
 * - Uses fr-CI locale for space thousand separators
 * - Integer only (0 decimals)
 * - Always appends " CFA"
 */
export function formatMoney(amount: number, locale: string = APP_LOCALE): string {
  const formatted = new Intl.NumberFormat(locale, {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  
  return `${formatted} CFA`;
}

export const PLATFORM_FEE_RATE = 0.15;

export function computeFees(totalAmount: number) {
  const platformFee = Math.round(totalAmount * PLATFORM_FEE_RATE);
  const providerPayout = totalAmount - platformFee;
  return {
    baseAmount: totalAmount,
    platformFeeAmount: platformFee,
    providerPayoutAmount: providerPayout,
  };
}

export type PaymentMethod = 'cash' | 'mobile_money' | 'bank_transfer';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];
