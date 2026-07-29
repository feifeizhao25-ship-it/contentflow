import { Injectable } from '@nestjs/common';
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
    return this.prisma.user.create({
      data: {
        tenant_id: tenantId,
        email: data.email,
        name: data.name,
        role: data.role || 'member',
      },
    });
  }
}
