import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CN_PLANS, PLANS } from '../../../runtime/api/src/modules/billing/plans.constant.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

export function contentflowCanonical() {
  return {
    product: 'contentflow',
    sourceKind: 'generated',
    sourceLabel: 'Generated from runtime/api/src/modules/billing/plans.constant.ts. Prices and quotas are copied from that source.',
    markets: [
      {
        id: 'cn',
        currency: 'CNY',
        billing: 'monthly_and_yearly',
        plans: CN_PLANS.map((plan) => ({
          id: plan.id,
          name: plan.name,
          priceMonthly: plan.priceMonthlyCny,
          priceYearly: plan.priceYearlyCny,
          quotaStatus: plan.quotaStatus ?? 'confirmed',
          quotas: {
            monthlyAiTokens: plan.aiTokenQuota,
            monthlyPosts: plan.monthlyPostQuota,
            platformAccounts: plan.platformLimit,
          },
          features: plan.features,
          custom: plan.custom,
        })),
      },
      {
        id: 'intl',
        currency: 'USD',
        billing: 'monthly',
        plans: PLANS.map((plan) => ({
          id: plan.id,
          name: plan.name,
          priceMonthly: plan.priceMonthlyUsd,
          priceYearly: null,
          quotas: {
            monthlyAiTokens: plan.aiTokenQuota,
            monthlyPosts: plan.monthlyPostQuota,
            platformAccounts: plan.platformLimit,
          },
          features: plan.features,
          custom: plan.custom,
        })),
      },
    ],
  };
}

export function readUiRegistries() {
  return {
    cn: JSON.parse(readFileSync(join(root, 'runtime/web-cn/src/lib/entitlements.json'), 'utf8')),
    intl: JSON.parse(readFileSync(join(root, 'runtime/web-int/src/lib/entitlements-int.json'), 'utf8')),
  };
}
