/**
 * 平台账号数按套餐限制（2026-11-23 主人定，待定61；套餐文案和价格不改）。
 * 原来只有发布条数、AI 令牌、席位三项有执行点；checkQuota('account') 读的 usage_stats.accounts_count
 * 全仓库没人累加，恒为 0，等于不限。
 */
import { ForbiddenException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { AccountService } from '../account/account.service';
import { UserService } from '../user/user.service';

function store(tenant: Record<string, unknown>, accounts: Array<{ id: string; status: string; created_at: string }>) {
  const prisma = {
    tenant: { findUnique: jest.fn(async () => tenant) },
    platformAccount: {
      count: jest.fn(async ({ where }: any) => accounts.filter((a) => a.status !== where.status.not).length),
      findMany: jest.fn(async ({ take }: any) =>
        accounts
          .filter((a) => a.status !== 'deleted')
          .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
          .slice(0, take)
          .map((a) => ({ id: a.id }))),
    },
  };
  return { prisma, service: new TenantService(prisma as any) };
}

const acct = (id: string, day: number, status = 'active') => ({ id, status, created_at: `2026-11-${String(day).padStart(2, '0')}T00:00:00Z` });

describe('平台账号数上限', () => {
  it('免费版 1 个：已有 1 个时不能再绑，checkQuota 也说不行', async () => {
    const { service } = store({ plan: 'free', limits: {} }, [acct('a', 1)]);
    await expect(service.assertCanBindAccount('t')).rejects.toThrow(new ForbiddenException('当前套餐最多可用 1 个平台账号，已绑定 1 个。请先解绑不用的账号，或升级套餐。'));
    expect(await service.checkQuota('t', 'account')).toBe(false);
  });

  it('已删除的账号不占名额', async () => {
    const { service } = store({ plan: 'free', limits: {} }, [acct('a', 1, 'deleted')]);
    await expect(service.assertCanBindAccount('t')).resolves.toBeUndefined();
    expect(await service.checkQuota('t', 'account')).toBe(true);
  });

  it('个人版 10 个：9 个时还能绑第 10 个，没超额时全部账号可用', async () => {
    const accounts = Array.from({ length: 9 }, (_, i) => acct(`a${i}`, i + 1));
    const { service } = store({ plan: 'pro', plan_expires_at: '2099-01-01', limits: { max_accounts: 10 } }, accounts);
    await expect(service.assertCanBindAccount('t')).resolves.toBeUndefined();
    const allowance = await service.accountAllowance('t');
    expect(allowance).toEqual({ limit: 10, used: 9, allowedIds: null });
  });

  it('个人版到期回落免费版：3 个账号只有最早绑定的 1 个还能用', async () => {
    const { service } = store(
      { plan: 'pro', plan_expires_at: '2026-11-01T00:00:00Z', limits: { max_accounts: 10 } },
      [acct('late', 20), acct('first', 2), acct('mid', 10)],
    );
    const allowance = await service.accountAllowance('t', new Date('2026-11-23T00:00:00Z'));
    expect(allowance.limit).toBe(1);
    expect(allowance.used).toBe(3);
    expect([...(allowance.allowedIds ?? [])]).toEqual(['first']);
  });

  it('不限（-1）的套餐不查账号数', async () => {
    const { prisma, service } = store({ plan: 'enterprise', limits: { max_accounts: -1 } }, [acct('a', 1)]);
    expect(await service.checkQuota('t', 'account')).toBe(true);
    await expect(service.assertCanBindAccount('t')).resolves.toBeUndefined();
    expect(prisma.platformAccount.count).not.toHaveBeenCalled();
  });

  it('获取授权链接前先检查名额：满额 403，未满仍是「授权尚未开通」503', async () => {
    const full = store({ plan: 'free', limits: {} }, [acct('a', 1)]);
    await expect(new AccountService({} as never, full.service).getAuthUrl('douyin', 't')).rejects.toBeInstanceOf(ForbiddenException);
    const empty = store({ plan: 'free', limits: {} }, []);
    await expect(new AccountService({} as never, empty.service).getAuthUrl('douyin', 't')).rejects.toThrow(/开放平台授权尚未开通/);
  });
});

describe('/users/me 的「账号绑定」用量', () => {
  it('取库里未删除的平台账号数，而不是从未累加的 usage_stats.accounts_count', async () => {
    const count = jest.fn(async () => 2);
    const prisma = {
      user: { findUnique: jest.fn(async () => ({ id: 'u', tenant: { id: 't', usage_stats: { accounts_count: 0 } } })) },
      platformAccount: { count },
    };
    const me: any = await new UserService(prisma as any).findById("u");
    expect(me.tenant.usage_stats.accounts_count).toBe(2);
    expect(me.tenant.plan_expired).toBe(false);
    expect(count).toHaveBeenCalledWith({ where: { tenant_id: 't', status: { not: 'deleted' } } });
  });

  it('未到期的个人版仍展示购买时的账号上限', async () => {
    const prisma = {
      user: { findUnique: jest.fn(async () => ({
        id: 'u',
        tenant: {
          id: 't', plan: 'pro', plan_expires_at: '2099-01-01T00:00:00Z',
          limits: { max_accounts: 10, max_publishes_monthly: 200 },
          usage_stats: { accounts_count: 0 },
        },
      })) },
      platformAccount: { count: jest.fn(async () => 3) },
    };
    const me: any = await new UserService(prisma as any).findById('u');
    expect(me.tenant.plan_expired).toBe(false);
    expect(me.tenant.plan).toBe('pro');
    expect(me.tenant.limits.max_accounts).toBe(10);
    expect(me.tenant.limits.max_publishes_monthly).toBe(200);
    expect(me.tenant.usage_stats.accounts_count).toBe(3);
  });

  it('个人版到期后展示免费版生效上限，不再把已绑定 3 个显示成 3/10', async () => {
    const prisma = {
      user: { findUnique: jest.fn(async () => ({
        id: 'u',
        tenant: {
          id: 't', plan: 'pro', plan_expires_at: '2026-11-01T00:00:00Z',
          limits: { max_accounts: 10, max_publishes_monthly: 200 },
          usage_stats: { accounts_count: 0 },
        },
      })) },
      platformAccount: { count: jest.fn(async () => 3) },
    };
    const me: any = await new UserService(prisma as any).findById('u');
    expect(me.tenant.plan).toBe('pro');
    expect(me.tenant.plan_expired).toBe(true);
    expect(me.tenant.usage_stats.accounts_count).toBe(3);
    expect(me.tenant.limits.max_accounts).toBe(1);
    expect(me.tenant.limits.max_publishes_monthly).toBe(200);
  });
});
