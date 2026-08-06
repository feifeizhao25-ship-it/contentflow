import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  async getList(tenantId: string, type?: string) {
    const where: any = { tenant_id: tenantId };
    if (type) where.material_type = type;
    return this.prisma.material.findMany({ where, orderBy: { created_at: 'desc' } });
  }

  async upload(tenantId: string, data: any) {
    return this.prisma.material.create({
      data: { ...data, tenant_id: tenantId },
    });
  }
}
