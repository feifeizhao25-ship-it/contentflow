import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  async getMembers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenant_id: tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        created_at: true,
      },
    });
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
