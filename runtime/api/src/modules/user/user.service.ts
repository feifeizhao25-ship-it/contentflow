import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { currentUsageStats } from '../tenant/tenant.service';
import { PrismaService } from '../../database/prisma.service';
import { publicEmail } from '../auth/phone-account';

export interface SignupProfileInput {
  industry?: string;
  job_role?: string;
  growth_stage?: string;
  province?: string;
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function signupProfileOf(row: { industry: string | null; job_role: string | null; growth_stage: string | null; province: string | null }) {
  return {
    industry: row.industry ?? null,
    job_role: row.job_role ?? null,
    growth_stage: row.growth_stage ?? null,
    province: row.province ?? null,
  };
}

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
    industry: true,
    job_role: true,
    growth_stage: true,
    province: true,
    status: true,
    created_at: true,
    last_login_at: true,
    tenant: {
      select: { id: true, name: true, logo_url: true, plan: true, plan_expires_at: true, limits: true, usage_stats: true },
    },
  } as const;

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: UserService.SAFE_SELECT });
    // 「本月发布」按北京时间自然月展示：跨月后显示 0，而不是上个月（甚至注册以来）的累计。
    if (user?.tenant) {
      const usage = currentUsageStats(user.tenant.usage_stats);
      delete usage.ai_calls_this_month; // 从未被累加的旧字段；AI 用量以 /billing/subscription 为准
      return { ...user, tenant: { ...user.tenant, usage_stats: usage } };
    }
    return user;
  }

  /** 只能看到自己工作区里的人，且不含手机号。别的工作区的用户一律「不存在」。 */
  async findInTenant(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenant_id: tenantId, status: 'active' },
      select: { id: true, email: true, name: true, avatar_url: true, role: true, created_at: true },
    });
    if (!user) throw new NotFoundException('用户不存在');
    return { ...user, email: publicEmail(user.email) };
  }

  async findByTenant(tenantId: string) {
    const members = await this.prisma.user.findMany({
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
    return members.map((m) => ({ ...m, email: publicEmail(m.email) }));
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

  async getSignupProfile(userId: string) {
    const row = await this.prisma.user.findUnique({ where: { id: userId }, select: UserService.SIGNUP_SELECT });
    if (!row || row.status !== 'active') throw new NotFoundException('用户不存在');
    return signupProfileOf(row);
  }

  async saveSignupProfile(userId: string, data: SignupProfileInput) {
    const current = await this.prisma.user.findUnique({ where: { id: userId }, select: UserService.SIGNUP_SELECT });
    if (!current || current.status !== 'active') throw new NotFoundException('用户不存在');
    const patch: { industry?: string | null; job_role?: string | null; growth_stage?: string | null; province?: string | null } = {};
    if (data.industry !== undefined) patch.industry = blankToNull(data.industry);
    if (data.job_role !== undefined) patch.job_role = blankToNull(data.job_role);
    if (data.growth_stage !== undefined) patch.growth_stage = blankToNull(data.growth_stage);
    if (data.province !== undefined) patch.province = blankToNull(data.province);
    if (!Object.keys(patch).length) return signupProfileOf(current);
    const row = await this.prisma.user.update({ where: { id: userId }, data: patch, select: UserService.SIGNUP_SELECT });
    return signupProfileOf(row);
  }

  private static readonly SIGNUP_SELECT = {
    status: true,
    industry: true,
    job_role: true,
    growth_stage: true,
    province: true,
  } as const;

  async delete(id: string) {
    // 软删除
    return this.prisma.user.update({
      where: { id },
      data: { status: 'deleted' },
    });
  }
}
