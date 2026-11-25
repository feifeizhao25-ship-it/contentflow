/** Settings plan block. Numbers come only from GET /billing/subscription. */

export interface PlanSummary {
  rows: Array<[string, string]>;
  notice: string;
  action: string;
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function amount(value: unknown): string {
  const n = num(value);
  if (n == null) return 'Not returned';
  if (n < 0) return 'Unlimited';
  return n.toLocaleString('en-US');
}

function day(value: unknown): string {
  if (typeof value !== 'string' || !value) return 'Not returned';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not returned';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}

const NAMES: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  team: 'Team',
  enterprise: 'Enterprise',
};

export function describeGlobalPlan(payload: unknown): PlanSummary | null {
  const raw = payload && typeof payload === 'object' && 'data' in (payload as object)
    ? (payload as { data?: unknown }).data
    : payload;
  if (!raw || typeof raw !== 'object') return null;
  const sub = raw as Record<string, unknown>;
  const plan = typeof sub.plan === 'string' ? sub.plan : '';
  if (!plan) return null;
  const limits = sub.limits && typeof sub.limits === 'object' ? sub.limits as Record<string, unknown> : {};
  const expired = sub.expired === true;
  const purchased = typeof sub.purchasedPlan === 'string' ? sub.purchasedPlan : plan;
  const name = NAMES[plan] ?? plan;
  const bought = NAMES[purchased] ?? purchased;
  const notice = expired
    ? `Your ${bought} plan ended on ${day(sub.renewalDate)}. You are on Free. Account, post, token and storage limits are the Free limits.`
    : 'These limits are the ones enforced on publish and generation.';
  return {
    notice,
    action: expired ? 'Renew plan' : 'Manage subscription',
    rows: [
      ['Plan', name],
      ['Status', expired ? 'Expired' : 'Active'],
      ['Renewal', day(sub.renewalDate)],
      ['Accounts', amount(limits.max_accounts)],
      ['Posts this month', amount(limits.max_publishes_monthly)],
      ['AI tokens this month', amount(limits.max_ai_tokens_monthly)],
      ['Storage (GB)', amount(limits.max_storage_gb)],
      ['Seats', amount(limits.max_members)],
    ],
  };
}
