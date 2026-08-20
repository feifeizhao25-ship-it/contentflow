import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar_url: true,
        role: true,
        status: true,
        preferences: true,
        created_at: true,
        tenant: {
          select: { id: true, name: true, plan: true, status: true },
        },
      },
    });
  }

  async findVisibleById(id: string, tenantId: string) {
    return this.prisma.user.findFirst({
      where: { id, tenant_id: tenantId, status: 'active' },
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
      select: {
        id: true,
        email: true,
        name: true,
        avatar_url: true,
        role: true,
        status: true,
        preferences: true,
      },
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
