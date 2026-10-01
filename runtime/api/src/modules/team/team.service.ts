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
