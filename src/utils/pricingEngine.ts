/**
 * Rule-Based Pricing Engine
 * 
 * Phase 1: Deterministic, explainable pricing suggestions
 * No AI training - pure rule-based calculations
 */

export type PricingMode = 'instant' | 'range' | 'quote_required';
export type UrgencyLevel = 'normal' | 'under_24h' | 'same_day';
export type TimePreference = 'anytime' | 'morning' | 'afternoon' | 'evening';
export type QuoteStatus = 'none' | 'sent' | 'accepted' | 'declined' | 'expired';

export interface PricingRules {
  defaultZoneMultiplier: number;
  zoneMultipliers: Record<string, number>;
  urgencyMultipliers: Record<string, number>;
  timeMultipliers: Record<string, number>;
  calloutFee?: number;
  rangePaddingPct?: number;
  minFloor?: number;
  maxCap?: number;
}

export interface BreakdownItem {
  label: string;
  type: 'add' | 'mult';
  value: number;
  result: number;
}

export interface PricingSuggestion {
  suggestedMin: number;
  suggestedMax: number;
  suggestedQuote: number;
  inputsUsed: {
    basePrice: number;
    zone: string;
    normalizedZone: string;
    urgency: UrgencyLevel;
    timePreference: TimePreference;
    zoneMultiplier: number;
    urgencyMultiplier: number;
    timeMultiplier: number;
    calloutFee: number;
  };
  breakdown: BreakdownItem[];
  generatedAt: string;
  generatedBy: 'rule_engine_v1';
}

export interface ServiceForPricing {
  basePrice: number;
  pricingRules?: PricingRules;
}

export interface BookingForPricing {
  zone?: string;
  urgency?: UrgencyLevel;
  timePreference?: TimePreference;
}

export const ZONES_LIST = [
  { value: 'cocody', label: 'Cocody' },
  { value: 'marcory', label: 'Marcory' },
  { value: 'plateau', label: 'Plateau' },
  { value: 'treichville', label: 'Treichville' },
  { value: 'yopougon', label: 'Yopougon' },
  { value: 'abobo', label: 'Abobo' },
  { value: 'adjame', label: 'Adjamé' },
  { value: 'koumassi', label: 'Koumassi' },
  { value: 'port-bouet', label: 'Port-Bouët' },
  { value: 'bingerville', label: 'Bingerville' },
  { value: 'grand-bassam', label: 'Grand-Bassam' },
  { value: 'anyama', label: 'Anyama' },
  { value: 'songon', label: 'Songon' },
  { value: 'riviera', label: 'Riviera' },
  { value: 'angre', label: 'Angré' },
  { value: 'deux-plateaux', label: 'Deux Plateaux' },
];

export const DEFAULT_PRICING_RULES: PricingRules = {
  defaultZoneMultiplier: 1.05,
  rangePaddingPct: 0.2,
  zoneMultipliers: {
    'cocody': 1.2,
    'marcory': 1.1,
    'plateau': 1.15,
    'treichville': 1.05,
    'yopougon': 1.0,
    'abobo': 0.95,
    'adjame': 0.95,
    'koumassi': 1.0,
    'port-bouet': 1.0,
    'bingerville': 1.1,
    'grand-bassam': 1.15,
    'anyama': 1.0,
    'songon': 1.1,
    'riviera': 1.15,
    'angre': 1.1,
    'deux-plateaux': 1.15,
  },
  urgencyMultipliers: {
    'normal': 1.0,
    'under_24h': 1.15,
    'same_day': 1.25,
  },
  timeMultipliers: {
    'anytime': 1.0,
    'morning': 1.0,
    'afternoon': 1.0,
    'evening': 1.1,
  },
  calloutFee: 0,
  minFloor: undefined,
  maxCap: undefined,
};

export function normalizeZone(zone: string): string {
  return zone
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export function getPricingSuggestion(
  service: ServiceForPricing,
  booking: BookingForPricing
): PricingSuggestion {
  const rules = service.pricingRules ?? DEFAULT_PRICING_RULES;
  const breakdown: BreakdownItem[] = [];
  
  const base = service.basePrice;
  breakdown.push({
    label: 'Base Price',
    type: 'add',
    value: base,
    result: base,
  });
  
  let result = base;
  
  const zone = booking.zone ?? 'unknown';
  const normalizedZone = normalizeZone(zone);
  const zoneMultiplier = rules.zoneMultipliers[normalizedZone] 
    ?? rules.defaultZoneMultiplier 
    ?? 1.0;
  
  if (zoneMultiplier !== 1.0) {
    result = result * zoneMultiplier;
    breakdown.push({
      label: `Zone (${zone})`,
      type: 'mult',
      value: zoneMultiplier,
      result: Math.round(result),
    });
  }
  
  const urgency = booking.urgency ?? 'normal';
  const urgencyMultiplier = rules.urgencyMultipliers[urgency] ?? 1.0;
  
  if (urgencyMultiplier !== 1.0) {
    result = result * urgencyMultiplier;
    breakdown.push({
      label: `Urgency (${urgency.replace('_', ' ')})`,
      type: 'mult',
      value: urgencyMultiplier,
      result: Math.round(result),
    });
  }
  
  const timePreference = booking.timePreference ?? 'anytime';
  const timeMultiplier = rules.timeMultipliers[timePreference] ?? 1.0;
  
  if (timeMultiplier !== 1.0) {
    result = result * timeMultiplier;
    breakdown.push({
      label: `Time (${timePreference})`,
      type: 'mult',
      value: timeMultiplier,
      result: Math.round(result),
    });
  }
  
  const calloutFee = rules.calloutFee ?? 0;
  if (calloutFee > 0) {
    result = result + calloutFee;
    breakdown.push({
      label: 'Callout Fee',
      type: 'add',
      value: calloutFee,
      result: Math.round(result),
    });
  }
  
  if (rules.minFloor !== undefined && result < rules.minFloor) {
    breakdown.push({
      label: 'Minimum Floor',
      type: 'add',
      value: rules.minFloor,
      result: rules.minFloor,
    });
    result = rules.minFloor;
  }
  
  if (rules.maxCap !== undefined && result > rules.maxCap) {
    breakdown.push({
      label: 'Maximum Cap',
      type: 'add',
      value: rules.maxCap,
      result: rules.maxCap,
    });
    result = rules.maxCap;
  }
  
  const suggestedQuote = Math.round(result);
  
  const padding = rules.rangePaddingPct ?? 0.2;
  const suggestedMin = Math.round(suggestedQuote * (1 - padding));
  const suggestedMax = Math.round(suggestedQuote * (1 + padding));
  
  return {
    suggestedMin,
    suggestedMax,
    suggestedQuote,
    inputsUsed: {
      basePrice: base,
      zone,
      normalizedZone,
      urgency,
      timePreference,
      zoneMultiplier,
      urgencyMultiplier,
      timeMultiplier,
      calloutFee,
    },
    breakdown,
    generatedAt: new Date().toISOString(),
    generatedBy: 'rule_engine_v1',
  };
}

export const URGENCY_OPTIONS: { value: UrgencyLevel; label: string }[] = [
  { value: 'normal', label: 'Normal (3+ days)' },
  { value: 'under_24h', label: 'Under 24 hours (+15%)' },
  { value: 'same_day', label: 'Same day (+25%)' },
];

export const TIME_PREFERENCE_OPTIONS: { value: TimePreference; label: string }[] = [
  { value: 'anytime', label: 'Anytime' },
  { value: 'morning', label: 'Morning (8am-12pm)' },
  { value: 'afternoon', label: 'Afternoon (12pm-5pm)' },
  { value: 'evening', label: 'Evening (5pm-9pm, +10%)' },
];
