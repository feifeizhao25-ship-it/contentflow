import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 返回给客户端的用户字段。**没有** password_hash、oauth_providers、permissions。
   * 原来这里 `include: { tenant: true }` 而不限制字段：GET /users/me 与 GET /users/:id
   * 把口令哈希连同整个工作区记录一起返回。
   */
  private static readonly SAFE_SELECT = {
    id: true,
    tenant_id: true,
    email: true,
    phone: true,
    name: true,
    avatar_url: true,
    role: true,
    email_verified: true,
    phone_verified: true,
    preferences: true,
    status: true,
    created_at: true,
    last_login_at: true,
    tenant: {
      select: { id: true, name: true, logo_url: true, plan: true, plan_expires_at: true, limits: true, usage_stats: true },
    },
  } as const;

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: UserService.SAFE_SELECT });
  }

  /** 只能看到自己工作区里的人，且不含手机号。别的工作区的用户一律「不存在」。 */
  async findInTenant(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenant_id: tenantId, status: 'active' },
      select: { id: true, email: true, name: true, avatar_url: true, role: true, created_at: true },
    });
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  async findByTenant(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenant_id: tenantId, status: 'active' },
      select: {
        id: true,
        email: true,
        name: true,
        avatar_url: true,
        role: true,
        created_at: true,
      },
    });
  }

  async update(id: string, data: { name?: string; avatar_url?: string; preferences?: any }) {
    // 只挑允许的三个字段，即使调用方传了别的也不会写进去
    const patch: { name?: string; avatar_url?: string; preferences?: any } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url;
    if (data.preferences !== undefined) {
      // 浅合并：设置页的不同分区各改各的键（例如 schedule），不能互相覆盖
      const current = await this.prisma.user.findUnique({ where: { id }, select: { preferences: true } });
      const existing = current?.preferences && typeof current.preferences === 'object' && !Array.isArray(current.preferences) ? (current.preferences as Record<string, unknown>) : {};
      patch.preferences = { ...existing, ...data.preferences };
    }
    return this.prisma.user.update({ where: { id }, data: patch, select: UserService.SAFE_SELECT });
  }

  async delete(id: string) {
    // 软删除
    return this.prisma.user.update({
      where: { id },
      data: { status: 'deleted' },
    });
  }
}
