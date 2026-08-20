import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly publicFields = {
    id: true,
    platform: true,
    platform_account_id: true,
    account_name: true,
    account_nickname: true,
    avatar_url: true,
    profile_url: true,
    follower_count: true,
    following_count: true,
    content_count: true,
    auth_type: true,
    auth_expires_at: true,
    status: true,
    health_score: true,
    last_sync_at: true,
    last_publish_at: true,
    error_message: true,
    group_name: true,
    tags: true,
    created_at: true,
    updated_at: true,
  } as const;

  async findAll(tenantId: string, options?: { platform?: string; status?: string }) {
    const where: any = { tenant_id: tenantId };
    if (options?.platform) where.platform = options.platform;
    if (options?.status) where.status = options.status;

    return this.prisma.platformAccount.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: this.publicFields,
    });
  }

  async findById(id: string, tenantId: string) {
    const account = await this.prisma.platformAccount.findFirst({
      where: { id, tenant_id: tenantId },
      select: this.publicFields,
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
    return {
      auth_url: '',
      platform,
      available: false,
      message: '该平台的 OAuth 服务端授权尚未完成，未发起不完整授权。',
    };
  }
}
