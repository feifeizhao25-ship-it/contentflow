/**
 * 分1 / 流2 / 共1：同一个用户，/users/me 与 /billing/subscription 的档位、五项额度、是否到期、到期时间必须一致。
 * 数据是测试桩，没有支付，也没有模型密钥。
 */
import { BillingController } from './billing.controller';
import { UserService } from '../user/user.service';

const QUOTA_KEYS = [
  'max_accounts',
  'max_members',
  'max_publishes_monthly',
  'max_ai_tokens_monthly',
  'max_storage_gb',
] as const;

function prismaFor(tenant: Record<string, unknown>) {
  return {
    user: { findUnique: jest.fn(async () => ({ id: 'u', tenant: { id: 't', usage_stats: {}, ...tenant } })) },
    tenant: { findUnique: jest.fn(async () => ({ id: 't', usage_stats: {}, ...tenant })) },
    platformAccount: { count: jest.fn(async () => 3) },
    usageMeter: { findFirst: jest.fn(async () => ({ ai_tokens: 10 })) },
  };
}

function sameExpiry(me: { plan_expires_at?: string | null }, sub: { renewalDate?: string | null }) {
  const raw = me.plan_expires_at;
  const expected = raw ? new Date(raw).toISOString() : null;
  expect(sub.renewalDate).toBe(expected);
}

async function both(region: 'cn' | 'global', tenant: Record<string, unknown>) {
  const previous = process.env.MARKET_REGION;
  process.env.MARKET_REGION = region;
  try {
    const prisma = prismaFor(tenant);
    const me: any = await new UserService(prisma as any).findById('u');
    const sub: any = await new BillingController(prisma as any, {} as any).getSubscription({ user: { tenantId: 't' } });
    return { me: me.tenant, sub };
  } finally {
    if (previous === undefined) delete process.env.MARKET_REGION;
    else process.env.MARKET_REGION = previous;
  }
}

describe('同一用户的权益只来自 effectiveEntitlements', () => {
  it('国内到期个人版：两个接口的档位和五项额度逐项相等，并且是免费档', async () => {
    const { me, sub } = await both('cn', {
      plan: 'pro',
      plan_expires_at: '2026-11-01T00:00:00Z',
      limits: { max_accounts: 10, max_publishes_monthly: 200, max_storage_gb: 5, max_ai_tokens_monthly: 2500000, max_members: 1 },
    });
    expect(me.plan).toBe(sub.plan);
    expect(me.plan).toBe('free');
    expect(me.purchased_plan).toBe(sub.purchasedPlan);
    expect(me.purchased_plan).toBe('pro');
    expect(me.plan_expired).toBe(sub.expired);
    expect(me.plan_expired).toBe(true);
    sameExpiry(me, sub);
    for (const key of QUOTA_KEYS) {
      expect(me.limits[key]).toBe(sub.limits[key]);
    }
    expect(sub.limits).toMatchObject({
      max_accounts: 1,
      max_members: 1,
      max_publishes_monthly: 5,
      max_ai_tokens_monthly: 50000,
      max_storage_gb: 1,
    });
  });

  it('国际到期 Pro：两个接口都落到 Free（3 个账号、每月 10 条、5 万令牌）', async () => {
    const { me, sub } = await both('global', {
      plan: 'pro',
      plan_expires_at: '2026-11-01T00:00:00Z',
      limits: { max_accounts: 15, max_publishes_monthly: 500, max_storage_gb: 20, max_ai_tokens_monthly: 2500000, max_members: 5 },
    });
    expect(me.plan).toBe('free');
    expect(sub.plan).toBe('free');
    expect(me.plan_expired).toBe(true);
    expect(sub.expired).toBe(true);
    sameExpiry(me, sub);
    for (const key of QUOTA_KEYS) expect(me.limits[key]).toBe(sub.limits[key]);
    expect(sub.limits.max_accounts).toBe(3);
    expect(sub.limits.max_publishes_monthly).toBe(10);
    expect(sub.limits.max_ai_tokens_monthly).toBe(50000);
  });

  it('未到期时两个接口仍使用购买快照，而不是被新档位表覆盖', async () => {
    const { me, sub } = await both('cn', {
      plan: 'pro',
      plan_expires_at: '2099-01-01T00:00:00Z',
      limits: { max_accounts: 10, max_publishes_monthly: 200, max_storage_gb: 5, max_ai_tokens_monthly: 2500000, max_members: 1 },
    });
    expect(me.plan).toBe('pro');
    expect(sub.plan).toBe('pro');
    expect(me.plan_expired).toBe(false);
    expect(sub.expired).toBe(false);
    sameExpiry(me, sub);
    for (const key of QUOTA_KEYS) expect(me.limits[key]).toBe(sub.limits[key]);
    expect(sub.limits.max_publishes_monthly).toBe(200);
  });
});
