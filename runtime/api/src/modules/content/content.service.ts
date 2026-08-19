import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, options: { status?: string; page?: number; pageSize?: number; keyword?: string }) {
    const { status, page = 1, pageSize = 20, keyword } = options;
    const skip = (page - 1) * pageSize;

    const where: any = {
      tenant_id: tenantId,
      status: { not: 'deleted' },
    };

    if (status) where.status = status;
    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { body: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    const [contents, total] = await Promise.all([
      this.prisma.content.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.content.count({ where }),
    ]);

    return {
      contents,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findById(id: string, tenantId: string) {
    const content = await this.prisma.content.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!content) {
      throw new NotFoundException('内容不存在');
    }

    return content;
  }

  async create(tenantId: string, userId: string, data: {
    title?: string;
    body?: string;
    content_type: string;
    cover_url?: string;
    media_urls?: any;
    tags?: any;
  }) {
    return this.prisma.content.create({
      data: {
        tenant_id: tenantId,
        created_by: userId,
        title: data.title,
        body: data.body,
        content_type: data.content_type,
        cover_url: data.cover_url,
        media_urls: data.media_urls || [],
        tags: data.tags || [],
        status: 'draft',
        source: 'manual',
      },
    });
  }

  async update(id: string, tenantId: string, userId: string, data: any) {
    // 验证内容归属
    const existing = await this.prisma.content.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!existing) {
      throw new NotFoundException('内容不存在');
    }

    // 只有草稿或已驳回的内容可以编辑
    if (!['draft', 'rejected'].includes(existing.status)) {
      throw new ForbiddenException('当前状态不允许编辑');
    }

    return this.prisma.content.update({
      where: { id },
      data: {
        ...data,
        version: { increment: 1 },
        updated_at: new Date(),
      },
    });
  }

  async delete(id: string, tenantId: string) {
    // 软删除
    return this.prisma.content.update({
      where: { id, tenant_id: tenantId },
      data: { status: 'deleted' },
    });
  }

  async submitForReview(id: string, tenantId: string) {
    return this.prisma.content.update({
      where: { id, tenant_id: tenantId },
      data: { status: 'pending_review' },
    });
  }

  async review(id: string, tenantId: string, reviewerId: string, action: 'approve' | 'reject', comment?: string) {
    const content = await this.prisma.content.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!content || content.status !== 'pending_review') {
      throw new NotFoundException('没有待审核的内容');
    }

    // 更新内容状态
    await this.prisma.content.update({
      where: { id },
      data: {
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_by: reviewerId,
        reviewed_at: new Date(),
        review_comment: comment,
      },
    });

    // 记录审核日志
    await this.prisma.reviewLog.create({
      data: {
        content_id: id,
        reviewer_id: reviewerId,
        action,
        comment,
      },
    });

    return { success: true };
  }
}
