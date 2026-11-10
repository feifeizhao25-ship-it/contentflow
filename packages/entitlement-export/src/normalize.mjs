/** Stable export shape. Missing prices stay null. Nothing here invents a number. */

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  }
  return value ?? null;
}

export function normalize(document) {
  const markets = (document.markets ?? []).map((market) => ({
    billing: market.billing ?? null,
    currency: market.currency,
    id: market.id,
    plans: (market.plans ?? []).map((plan) => ({
      custom: plan.custom ?? null,
      features: plan.features ?? null,
      id: plan.id,
      name: plan.name ?? null,
      priceMonthly: plan.priceMonthly ?? null,
      priceYearly: plan.priceYearly ?? null,
      quotaStatus: plan.quotaStatus ?? null,
      quotas: sortValue(plan.quotas ?? {}),
    })).sort((a, b) => a.id.localeCompare(b.id)),
    purchasableSkus: [...(market.purchasableSkus ?? [])].sort(),
  })).sort((a, b) => a.id.localeCompare(b.id));

  return sortValue({
    markets,
    product: document.product,
    sourceKind: document.sourceKind,
    sourceLabel: document.sourceLabel,
  });
}

export function canonicalFromShunshi(fixture) {
  const registry = fixture.registry;
  const plans = Object.entries(registry.tiers).map(([id, tier]) => ({
    id,
    name: id,
    priceMonthly: null,
    priceYearly: null,
    quotas: {
      ...(tier.quotas ?? {}),
      family_members: tier.collaboration?.family_members ?? null,
    },
  }));
  return {
    product: 'shunshi',
    sourceKind: 'fixture',
    sourceLabel: fixture.sourceLabel,
    markets: [{
      id: 'cn',
      currency: 'CNY',
      billing: 'yearly',
      purchasableSkus: Object.keys(registry.product_tier_map ?? {}),
      plans,
    }],
  };
}

export function canonicalFromEnergy(fixture) {
  const registry = fixture.registry;
  const plans = (registry.tier_order ?? Object.keys(registry.tiers)).map((id) => {
    const tier = registry.tiers[id];
    return {
      id,
      name: tier.name,
      priceMonthly: null,
      priceYearly: tier.price?.yearly_cny ?? null,
      quotas: tier.quotas ?? {},
    };
  });
  return {
    product: 'energy',
    sourceKind: 'fixture',
    sourceLabel: fixture.sourceLabel,
    markets: [
      { id: 'cn', currency: 'CNY', billing: 'yearly', plans },
      { id: 'intl', currency: 'USD', billing: 'yearly', plans: [] },
    ],
  };
}

export function canonicalFromJianji(fixture) {
  return {
    product: 'jianji',
    sourceKind: 'fixture',
    sourceLabel: fixture.sourceLabel,
    markets: fixture.markets,
  };
}
