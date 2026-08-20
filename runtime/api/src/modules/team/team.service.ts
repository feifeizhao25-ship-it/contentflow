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

  async addMember(_tenantId: string, _data: { email: string; name?: string; role?: string }) {
    throw new BadRequestException(
      'Team invitations are unavailable until signed invitation delivery and acceptance are configured',
    );
  }
}
