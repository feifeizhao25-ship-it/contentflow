import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { tenant: true },
    });
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
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    // 软删除
    return this.prisma.user.update({
      where: { id },
      data: { status: 'deleted' },
    });
  }
}
