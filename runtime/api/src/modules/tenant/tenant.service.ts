import { effectiveEntitlements } from '../billing/effective-limits';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { chinaMonthPeriod } from '../../common/china-period';

/**
 * 把 usage_stats 里按月计的计数归到「北京时间当前自然月」。
 *
 * 原来 publishes_this_month 只会累加，全仓库没有清零的地方，「每月 5 条」实际变成「终身 5 条」。
 * 现在计数旁边记一个 publishes_period（YYYY-MM）：周期不是本月就视为 0，
 * 下一次发布时重置。读（额度检查、/users/me 展示）和写（发布计数）都经过这里。
 */
export function currentUsageStats(raw: unknown, now: Date | number = Date.now()): Record<string, any> {
  const usage: Record<string, any> = raw && typeof raw === 'object' ? { ...(raw as Record<string, any>) } : {};
  const period = chinaMonthPeriod(now);
  if (usage.publishes_period !== period) {
    usage.publishes_this_month = 0;
    usage.publishes_period = period;
  }
  return usage;
}

/** 平台账号「占用名额」的口径：没删除的账号都算（含授权过期、异常的账号，解绑后才释放）。 */
export const COUNTED_ACCOUNT_WHERE = { status: { not: 'deleted' } } as const;

export function accountLimitMessage(limit: number, used: number): string {
  return `当前套餐最多可用 ${limit} 个平台账号，已绑定 ${used} 个。请先解绑不用的账号，或升级套餐。`;
}

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });
    return tenant;
  }

  async update(id: string, data: { name?: string; settings?: any }) {
    return this.prisma.tenant.update({
      where: { id },
      data,
    });
  }

  /**
   * 账号数、成员数、本月发布数的额度检查。
   * AI 额度不在这里：按 token 计、按月存在 usage_meters，由 UsageService.checkQuota(TOKENS) 负责
   * （原来这里有个 'ai_call' 分支读不存在的 max_ai_calls_monthly，恒为 false，且无人调用）。
   * `amount` 是本次要新增的数量（例如一次发到 3 个账号就是 3）。
   */
  async checkQuota(tenantId: string, resourceType: string, amount = 1, now: Date | number = Date.now()): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('租户不存在');
    }

    const limits = effectiveEntitlements(tenant, new Date(now).getTime()).limits;
    const usage = currentUsageStats(tenant.usage_stats, now);
    const add = Math.max(1, Math.floor(amount) || 1);
    const fits = (used: number | undefined, cap: number | undefined) =>
      cap === -1 || (Number.isFinite(cap) && (Number(used) || 0) + add <= cap!);

    switch (resourceType) {
      case 'account': {
        // 原来读 usage_stats.accounts_count，但全仓库没有地方累加它，恒为 0，等于不限。改为数库里的账号。
        if (limits.max_accounts === -1) return true;
        const used = await this.countAccounts(tenantId);
        return fits(used, limits.max_accounts);
      }
      case 'member':
        return fits(usage.members_count, limits.max_members);
      case 'publish':
        return fits(usage.publishes_this_month, limits.max_publishes_monthly);
      default:
        return false;
    }
  }

  /** 本工作区占用名额的平台账号数（未删除）。 */
  async countAccounts(tenantId: string): Promise<number> {
    return this.prisma.platformAccount.count({ where: { tenant_id: tenantId, ...COUNTED_ACCOUNT_WHERE } });
  }

  /**
   * 套餐的平台账号数上限（2026-11-23 主人定，待定61）。
   * - limit：当前有效套餐的 max_accounts（过期回落免费版），-1 为不限；
   * - allowedIds：超出上限时，按绑定时间最早的前 limit 个账号可以继续用；没超出时为 null（全部可用）。
   * 套餐到期或降档后，已绑定的账号不删除，但超出的那部分不能再新建发布任务，直到解绑或升级。
   */
  async accountAllowance(tenantId: string, now: Date | number = Date.now()): Promise<{ limit: number; used: number; allowedIds: Set<string> | null }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('租户不存在');
    const raw = Number(effectiveEntitlements(tenant, new Date(now).getTime()).limits.max_accounts);
    const limit = Number.isFinite(raw) ? raw : 0;
    if (limit === -1) return { limit, used: 0, allowedIds: null };
    const used = await this.countAccounts(tenantId);
    if (used <= limit) return { limit, used, allowedIds: null };
    const rows = await this.prisma.platformAccount.findMany({
      where: { tenant_id: tenantId, ...COUNTED_ACCOUNT_WHERE },
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
      take: Math.max(0, limit),
      select: { id: true },
    });
    return { limit, used, allowedIds: new Set(rows.map((row: { id: string }) => row.id)) };
  }

  /** 绑定新平台账号前调用：满额时抛 403，说明上限和已绑定数。授权回调接通后必须先过这里。 */
  async assertCanBindAccount(tenantId: string, now: Date | number = Date.now()): Promise<void> {
    const { limit, used } = await this.accountAllowance(tenantId, now);
    if (limit !== -1 && used + 1 > limit) throw new ForbiddenException(accountLimitMessage(limit, used));
  }

  async incrementUsage(tenantId: string, resourceType: string, count: number = 1, now: Date | number = Date.now()) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) return;

    const usage = currentUsageStats(tenant.usage_stats, now);

    switch (resourceType) {
      case 'account':
        usage.accounts_count = (Number(usage.accounts_count) || 0) + count;
        break;
      case 'publish':
        usage.publishes_this_month = (Number(usage.publishes_this_month) || 0) + count;
        break;
      default:
        return;
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { usage_stats: usage },
    });
  }
}
