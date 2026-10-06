import { effectiveEntitlements } from '../billing/effective-limits';
import { Injectable, NotFoundException } from '@nestjs/common';
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
      case 'account':
        return fits(usage.accounts_count, limits.max_accounts);
      case 'member':
        return fits(usage.members_count, limits.max_members);
      case 'publish':
        return fits(usage.publishes_this_month, limits.max_publishes_monthly);
      default:
        return false;
    }
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
