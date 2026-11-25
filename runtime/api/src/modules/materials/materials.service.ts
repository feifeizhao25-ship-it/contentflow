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
      '暂时不能上传文件。可以先把图片或视频链接写进正文。',
    );
  }
}
