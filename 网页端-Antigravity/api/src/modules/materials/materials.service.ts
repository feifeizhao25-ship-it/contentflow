import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MaterialsService {
  constructor(private readonly prisma: PrismaService) { }

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

  async update(tenantId: string, id: string, data: any) {
    const material = await this.prisma.material.findFirst({ where: { id } });
    if (!material || material.tenant_id !== tenantId) {
      throw new NotFoundException('Material not found');
    }
    return this.prisma.material.update({
      where: { id },
      data: { ...data, updated_at: new Date() },
    });
  }

  async delete(tenantId: string, id: string) {
    const material = await this.prisma.material.findFirst({ where: { id } });
    if (!material || material.tenant_id !== tenantId) {
      throw new NotFoundException('Material not found');
    }
    return this.prisma.material.delete({ where: { id } });
  }
}
