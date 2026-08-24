/**
 * Plan entitlement registry (single source of truth) — international site.
 *
 * The data lives in ./entitlements-int.json; the pricing page static fallback
 * and its tests read from this one file. Quotas mirror the backend
 * runtime/api/src/modules/billing/plans.constant.ts PLANS definitions;
 * -1 means unlimited (Enterprise custom).
 *
 * This module does not import the JSON directly (bare Node requires an import
 * attribute while bundlers do not); consumers import the JSON and pass it into
 * these pure functions so tests and the Next.js build share the same logic.
 */

export const TIER_IDS = ['free', 'starter', 'pro', 'team', 'enterprise'] as const;
export type TierId = (typeof TIER_IDS)[number];

export interface TierEntitlement {
  name: string;
  priceMonthlyUsd: number | null;
  custom: boolean;
  platformLimit: number;
  monthlyPostQuota: number;
  features: string[];
}

export interface EntitlementsRegistry {
  product: string;
  version: string;
  tiers: Record<TierId, TierEntitlement>;
}

/** Validate the registry schema; returns a list of errors (empty = valid). */
export function validateEntitlements(input: unknown): string[] {
  const errors: string[] = [];
  const r = input as Partial<EntitlementsRegistry> | null;
  if (!r || typeof r !== 'object') return ['Registry must be an object'];
  if (typeof r.product !== 'string' || !r.product) errors.push('Missing product');
  if (typeof r.version !== 'string' || !r.version) errors.push('Missing version');
  if (!r.tiers || typeof r.tiers !== 'object') {
    errors.push('Missing tiers');
    return errors;
  }
  for (const id of TIER_IDS) {
    const tier = (r.tiers as Record<string, Partial<TierEntitlement>>)[id];
    if (!tier) {
      errors.push(`Missing tier ${id}`);
      continue;
    }
    if (typeof tier.name !== 'string' || !tier.name) errors.push(`${id}: missing name`);
    if (tier.priceMonthlyUsd !== null && typeof tier.priceMonthlyUsd !== 'number') {
      errors.push(`${id}: priceMonthlyUsd must be a number or null`);
    }
    if (typeof tier.custom !== 'boolean') errors.push(`${id}: missing custom`);
    if (typeof tier.platformLimit !== 'number') errors.push(`${id}: missing platformLimit`);
    if (typeof tier.monthlyPostQuota !== 'number') errors.push(`${id}: missing monthlyPostQuota`);
    if (!Array.isArray(tier.features) || tier.features.length === 0) {
      errors.push(`${id}: features must be a non-empty array`);
    }
    if (tier.custom !== (tier.priceMonthlyUsd === null)) {
      errors.push(`${id}: custom must match a null (quote-based) priceMonthlyUsd`);
    }
  }
  return errors;
}

export interface FallbackPlan {
  id: TierId;
  name: string;
  priceMonthlyUsd: number | null;
  platformLimit: number;
  monthlyPostQuota: number;
  custom: boolean;
  features: string[];
}

/** Static fallback plan cards: render every tier while the plans API is down. */
export function buildFallbackPlans(registry: EntitlementsRegistry): FallbackPlan[] {
  return TIER_IDS.map((id) => {
    const tier = registry.tiers[id];
    return {
      id,
      name: tier.name,
      priceMonthlyUsd: tier.priceMonthlyUsd,
      platformLimit: tier.platformLimit,
      monthlyPostQuota: tier.monthlyPostQuota,
      custom: tier.custom,
      features: [...tier.features],
    };
  });
}
