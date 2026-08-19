import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, options?: { platform?: string; status?: string }) {
    const where: any = { tenant_id: tenantId };
    if (options?.platform) where.platform = options.platform;
    if (options?.status) where.status = options.status;

    return this.prisma.platformAccount.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const account = await this.prisma.platformAccount.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!account) throw new NotFoundException('账号不存在');
    return account;
  }

  async delete(id: string, tenantId: string) {
    return this.prisma.platformAccount.update({
      where: { id, tenant_id: tenantId },
      data: { status: 'deleted' },
    });
  }

  async getAuthUrl(platform: string) {
    const authUrls: Record<string, string> = {
      douyin: `https://open.douyin.com/platform/oauth/connect/`,
      xhs: `https://xhslink.com/oauth/authorize`,
      wechat: `https://open.weixin.qq.com/connect/oauth2/authorize`,
    };
    return { auth_url: authUrls[platform] || '' };
  }
}
