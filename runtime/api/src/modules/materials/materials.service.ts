import { BadRequestException, Injectable } from '@nestjs/common';
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
    // Production requires a signed object-storage upload before metadata can
    // be trusted. Creating a database row alone would falsely report success.
    void tenantId;
    void data;
    throw new BadRequestException(
      '素材上传通道尚未配置，请先接入对象存储签名上传后再试',
    );
  }
}
