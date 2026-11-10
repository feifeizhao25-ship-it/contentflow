import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { publicEmail } from '../auth/phone-account';
import { seatLimit } from './seat-limit';
import { RecordingTeamInviteMailer, type TeamInviteMailer } from './team-invite.mailer';

/** 文档没有写过期时长。24 小时是待决定前的保守值。邀请只能使用一次。 */
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
export const INVITE_ROLES = ['admin', 'editor', 'viewer'] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: TeamInviteMailer = new RecordingTeamInviteMailer(),
  ) {}

  async getMembers(tenantId: string) {
    const members = await this.prisma.user.findMany({
      // 已注销的账号只剩匿名化的空壳（订单外键需要它），不是成员
      where: { tenant_id: tenantId, status: 'active' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        created_at: true,
      },
    });
    // 手机号注册的账号没有邮箱：占位邮箱不外露
    return members.map((m) => ({ ...m, email: publicEmail(m.email) }));
  }

  /** 团队动态：读 ActivityLog（批2补齐，不再前端假装请求） */
  async getActivity(tenantId: string) {
    const logs = await (this.prisma as any).activityLog.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    return (logs ?? []).map((l: any) => ({ id: l.id, action: l.action, resource_type: l.resource_type, resource_id: l.resource_id, user_id: l.user_id, created_at: l.created_at }));
  }

  /** 移除成员：仅所有者/管理员可操作，不能移除所有者；被移除者 status=removed，不再出现在成员列表（批2补齐 DELETE） */
  async removeMember(tenantId: string, actorId: string, userId: string) {
    const actor = await this.prisma.user.findFirst({ where: { id: actorId, tenant_id: tenantId, status: 'active' } });
    if (!actor || !['owner', 'admin'].includes(actor.role)) throw new BadRequestException('只有团队所有者或管理员可以移除成员');
    if (actorId === userId) throw new BadRequestException('不能用移除成员的方式移除自己');
    const target = await this.prisma.user.findFirst({ where: { id: userId, tenant_id: tenantId, status: 'active' } });
    if (!target) throw new BadRequestException('成员不存在或已移除');
    if (target.role === 'owner') throw new BadRequestException('不能移除团队所有者');
    await this.prisma.user.update({ where: { id: userId }, data: { status: 'removed' } });
    try { await (this.prisma as any).activityLog.create({ data: { tenant_id: tenantId, user_id: actorId, action: 'team.member_removed', resource_type: 'user', resource_id: userId, details: {} } }); } catch { /* 动态写失败不影响移除结果 */ }
    return { removed: true, user_id: userId };
  }

  async addMember(tenantId: string, actorId: string, data: { email?: string; name?: string; role?: string }) {
    return this.createInvite(tenantId, actorId, { email: data.email, role: data.role });
  }

  async createInvite(tenantId: string, actorId: string, input: { email?: string; role?: string }, now = new Date()) {
    const actor = await this.requireOwner(tenantId, actorId);
    const email = normalizeEmail(input.email);
    const role = normalizeRole(input.role);
    const token = randomBytes(32).toString('base64url');
    const token_hash = hashToken(token);
    const expires_at = new Date(now.getTime() + INVITE_TTL_MS);
    const row = await this.prisma.$transaction(async (tx) => {
      const tenant = await lockTenant(tx, tenantId);
      const cap = seatLimit(tenant, now.getTime());
      const used = await seatsHeld(tx, tenantId, now);
      if (used + 1 > cap) fail('INVITE_SEAT_FULL', `席位已满（上限 ${cap}）`, `This workspace has no seats left (limit ${cap}).`);
      return tx.teamInvite.create({
        data: { tenant_id: tenantId, email, role, token_hash, status: 'pending', invited_by: actor.id, expires_at },
      });
    });
    if (email) {
      await this.mailer.send({ to: email, tenantId, role, token, expiresAt: expires_at.toISOString() });
    }
    try {
      await (this.prisma as any).activityLog.create({
        data: { tenant_id: tenantId, user_id: actor.id, action: 'team.invite_created', resource_type: 'team_invite', resource_id: row.id, details: { role, email: email ?? null } },
      });
    } catch { /* 动态写失败不影响邀请 */ }
    return { id: row.id, email, role, status: 'pending', expiresAt: expires_at.toISOString(), token, delivery: email ? 'recorded' : 'link' };
  }

  async listInvites(tenantId: string, actorId: string, now = new Date()) {
    await this.requireOwner(tenantId, actorId);
    const rows = await this.prisma.teamInvite.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      status: row.status === 'pending' && row.expires_at.getTime() <= now.getTime() ? 'expired' : row.status,
      expiresAt: row.expires_at.toISOString(),
      createdAt: row.created_at.toISOString(),
    }));
  }

  async revokeInvite(tenantId: string, actorId: string, inviteId: string, now = new Date()) {
    await this.requireOwner(tenantId, actorId);
    return this.prisma.$transaction(async (tx) => {
      await lockTenant(tx, tenantId);
      const claimed = await tx.teamInvite.updateMany({
        where: { id: inviteId, tenant_id: tenantId, status: 'pending', expires_at: { gt: now } },
        data: { status: 'revoked', resolved_at: now },
      });
      if (claimed.count !== 1) {
        const row = await tx.teamInvite.findFirst({ where: { id: inviteId, tenant_id: tenantId } });
        if (row?.status === 'revoked') fail('INVITE_REVOKED', '邀请已被撤销', 'This invite was revoked.');
        if (row && row.expires_at.getTime() <= now.getTime()) fail('INVITE_EXPIRED', '邀请已过期', 'This invite has expired.');
        fail('INVITE_CLOSED', '只能撤销尚未使用且未过期的邀请', 'Only a pending invite that has not expired can be revoked.');
      }
      return { revoked: true, id: inviteId };
    });
  }

  async acceptInvite(actorId: string, token: string, now = new Date()) {
    return this.resolveInvite(actorId, token, 'accepted', now);
  }

  async declineInvite(actorId: string, token: string, now = new Date()) {
    return this.resolveInvite(actorId, token, 'declined', now);
  }

  private async resolveInvite(actorId: string, token: string, next: 'accepted' | 'declined', now: Date) {
    const token_hash = hashToken(token);
    const preview = await this.prisma.teamInvite.findUnique({ where: { token_hash } });
    if (!preview || !safeEqual(preview.token_hash, token_hash)) fail('INVITE_NOT_FOUND', '邀请不存在', 'This invite does not exist.');
    const actor = await this.prisma.user.findFirst({ where: { id: actorId, status: 'active' } });
    if (!actor) fail('INVITE_NOT_FOUND', '账号不存在', 'This account does not exist.');
    if (preview.expires_at.getTime() <= now.getTime() || preview.status === 'expired') {
      fail('INVITE_EXPIRED', '邀请已过期', 'This invite has expired.');
    }
    if (preview.status === 'revoked') fail('INVITE_REVOKED', '邀请已被撤销', 'This invite was revoked.');
    if (preview.status !== 'pending') fail('INVITE_CLOSED', '邀请已结束', 'This invite has already been used.');
    const actorEmail = String(actor.email || '').trim().toLowerCase();
    if (preview.email && (publicEmail(actor.email) === '' || actorEmail !== preview.email)) {
      fail('INVITE_WRONG_EMAIL', '这个邀请只发给指定邮箱', 'This invite was sent to a different email address.');
    }
    if (next === 'accepted') {
      if (actor.tenant_id === preview.tenant_id) fail('INVITE_ALREADY_MEMBER', '你已经在这个工作区', 'You are already in this workspace.');
      const siblings = await this.prisma.user.count({ where: { tenant_id: actor.tenant_id, status: 'active' } });
      if (siblings !== 1) fail('INVITE_WORKSPACE_BUSY', '你当前的工作区还有其他成员，不能转入新的工作区', 'Your current workspace still has other members.');
    }
    return this.prisma.$transaction(async (tx) => {
      await lockTenant(tx, preview.tenant_id);
      const claimed = await tx.teamInvite.updateMany({
        where: { id: preview.id, status: 'pending', expires_at: { gt: now } },
        data: {
          status: next,
          resolved_at: now,
          ...(next === 'accepted' ? { accepted_by: actor.id } : {}),
        },
      });
      if (claimed.count !== 1) {
        const current = await tx.teamInvite.findUnique({ where: { id: preview.id } });
        if (current && current.expires_at.getTime() <= now.getTime()) fail('INVITE_EXPIRED', '邀请已过期', 'This invite has expired.');
        if (current?.status === 'revoked') fail('INVITE_REVOKED', '邀请已被撤销', 'This invite was revoked.');
        if (current?.status === 'expired') fail('INVITE_EXPIRED', '邀请已过期', 'This invite has expired.');
        fail('INVITE_CLOSED', '邀请已结束', 'This invite has already been used.');
      }
      if (next === 'declined') return { declined: true, id: preview.id };
      const tenant = await tx.tenant.findUnique({ where: { id: preview.tenant_id } });
      if (!tenant) fail('INVITE_NOT_FOUND', '工作区不存在', 'This workspace does not exist.');
      const active = await tx.user.count({ where: { tenant_id: preview.tenant_id, status: 'active' } });
      const cap = seatLimit(tenant, now.getTime());
      if (active + 1 > cap) fail('INVITE_SEAT_FULL', `席位已满（上限 ${cap}）`, `This workspace has no seats left (limit ${cap}).`);
      await tx.user.update({ where: { id: actor.id }, data: { tenant_id: preview.tenant_id, role: preview.role } });
      return { accepted: true, id: preview.id, tenantId: preview.tenant_id, role: preview.role };
    });
  }

  private async requireOwner(tenantId: string, actorId: string) {
    const actor = await this.prisma.user.findFirst({ where: { id: actorId, tenant_id: tenantId, status: 'active' } });
    if (!actor || actor.role !== 'owner') throw new BadRequestException('只有工作区所有者可以发出或撤销邀请');
    return actor;
  }

}

async function lockTenant(tx: PrismaTx, tenantId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId} FOR UPDATE`;
  if (!rows.length) fail('INVITE_NOT_FOUND', '工作区不存在', 'This workspace does not exist.');
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) fail('INVITE_NOT_FOUND', '工作区不存在', 'This workspace does not exist.');
  return tenant;
}

async function seatsHeld(tx: PrismaTx, tenantId: string, now: Date) {
  const members = await tx.user.count({ where: { tenant_id: tenantId, status: 'active' } });
  const pending = await tx.teamInvite.count({
    where: { tenant_id: tenantId, status: 'pending', expires_at: { gt: now } },
  });
  return members + pending;
}

type PrismaTx = {
  $queryRaw: PrismaService['$queryRaw'];
  tenant: PrismaService['tenant'];
  user: PrismaService['user'];
  teamInvite: PrismaService['teamInvite'];
};

function fail(code: string, zh: string, en: string): never {
  const message = process.env.MARKET_REGION === 'global' ? en : zh;
  throw new BadRequestException({ code, message });
}

function normalizeEmail(value: string | undefined): string | null {
  const email = (value ?? '').trim().toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('邮箱格式不正确');
  return email;
}

function normalizeRole(value: string | undefined): InviteRole {
  const role = (value ?? 'viewer').trim();
  if (!(INVITE_ROLES as readonly string[]).includes(role)) throw new BadRequestException('角色只能是管理员、编辑或查看者');
  return role as InviteRole;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
