import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

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

  async checkQuota(tenantId: string, resourceType: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('租户不存在');
    }

    const limits = tenant.limits as any;
    const usage = tenant.usage_stats as any;

    switch (resourceType) {
      case 'account':
        return usage.accounts_count < limits.max_accounts;
      case 'member':
        return usage.members_count < limits.max_members;
      case 'publish':
        return usage.publishes_this_month < limits.max_publishes_monthly;
      case 'ai_call':
        return usage.ai_calls_this_month < limits.max_ai_calls_monthly;
      default:
        return true;
    }
  }

  async incrementUsage(tenantId: string, resourceType: string, count: number = 1) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) return;

    const usage = tenant.usage_stats as any;

    switch (resourceType) {
      case 'account':
        usage.accounts_count += count;
        break;
      case 'publish':
        usage.publishes_this_month += count;
        break;
      case 'ai_call':
        usage.ai_calls_this_month += count;
        break;
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { usage_stats: usage },
    });
  }
}
