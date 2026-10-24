import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { publicEmail } from '../auth/phone-account';

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

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

  async addMember(tenantId: string, data: { email: string; name?: string; role?: string }) {
    // A production invite needs signed invitation delivery and acceptance;
    // silently creating an active user would bypass consent and access control.
    void tenantId;
    void data;
    throw new BadRequestException(
      '团队邀请通道尚未配置，请先接入签名邀请邮件与接受流程',
    );
  }
}
