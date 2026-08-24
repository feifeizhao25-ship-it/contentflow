import entitlementsRegistry from '@/lib/entitlements-int.json';
import { buildFallbackPlans, type EntitlementsRegistry } from '@/lib/entitlements-int';

interface Plan {
  id: string;
  name: string;
  priceMonthlyUsd: number | null;
  platformLimit: number;
  monthlyPostQuota: number;
  custom: boolean;
  features: string[];
}

async function loadPlans(): Promise<Plan[]> {
  const origin = process.env.API_INTERNAL_URL || 'http://api:4000';
  try {
    const res = await fetch(`${origin}/api/v1/billing/plans`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = await res.json();
    return body?.data?.plans ?? [];
  } catch {
    return [];
  }
}

function formatPrice(plan: Plan): string {
  if (plan.custom || plan.priceMonthlyUsd === null) return 'Custom';
  if (plan.priceMonthlyUsd === 0) return '$0';
  return `$${plan.priceMonthlyUsd}/mo`;
}

function formatLimit(value: number, unit: string): string {
  return value < 0 ? `Unlimited ${unit}` : `${value} ${unit}`;
}

export default async function PricingPage() {
  const plans = await loadPlans();
  // Static fallback from the entitlement registry: when the billing API is
  // unreachable we still render the full plan catalog; once the API answers,
  // server data replaces the fallback on the next request.
  const displayPlans: Plan[] = plans.length > 0
    ? plans
    : buildFallbackPlans(entitlementsRegistry as EntitlementsRegistry);
  return (
    <main className="shell">
      <div className="eyebrow">Pricing</div>
      <h1>Plans that scale with your distribution.</h1>
      <p>Every plan publishes through official platform APIs. Upgrade when you need more accounts or volume.</p>
      <div className="grid">
        {displayPlans.map((plan) => (
          <article className="card" key={plan.id}>
            <span className="status">{plan.custom ? 'Talk to sales' : 'Self-serve'}</span>
            <h2>{plan.name}</h2>
            <div className="metric">{formatPrice(plan)}</div>
            <p>{formatLimit(plan.platformLimit, 'platforms')}</p>
            <p>{formatLimit(plan.monthlyPostQuota, 'posts / month')}</p>
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </main>
  );
}
