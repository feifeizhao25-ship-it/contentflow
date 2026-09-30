import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { labelAiGeneratedText } from "../../common/ai-content-label";
import { normalizePaging } from "../../common/pagination";

/** 更新时允许写入的字段。状态、来源、所属工作区、审核信息、版本号一律不接受客户端的值。 */
const UPDATABLE_FIELDS = [
  "title",
  "summary",
  "body",
  "body_html",
  "cover_url",
  "media_urls",
  "tags",
  "keywords",
  "category",
] as const;

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    options: {
      status?: string;
      page?: number;
      pageSize?: number;
      keyword?: string;
    },
  ) {
    const { status, keyword } = options;
    const { page, pageSize, skip } = normalizePaging(options.page, options.pageSize);

    const where: any = {
      tenant_id: tenantId,
      status: { not: "deleted" },
    };

    if (status) where.status = status;
    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: "insensitive" } },
        { body: { contains: keyword, mode: "insensitive" } },
      ];
    }

    const [contents, total] = await Promise.all([
      this.prisma.content.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { created_at: "desc" },
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
      throw new NotFoundException("内容不存在");
    }

    return content;
  }

  async create(
    tenantId: string,
    userId: string,
    data: {
      title?: string;
      body?: string;
      content_type: string;
      cover_url?: string;
      media_urls?: any;
      tags?: any;
      ai_params?: any;
      ai_model?: string;
      source?: string;
    },
  ) {
    const isAi = data.source === "ai";
    // AI 生成内容必须带「AI 生成」显式标识，创建时就写进正文（幂等）。
    const label = (text?: string) =>
      isAi && typeof text === "string" && text.trim() ? labelAiGeneratedText(text) : text;
    return this.prisma.content.create({
      data: {
        tenant_id: tenantId,
        created_by: userId,
        title: data.title,
        body: label(data.body),
        content_type: data.content_type,
        cover_url: data.cover_url,
        media_urls: data.media_urls || [],
        tags: data.tags || [],
        status: "draft",
        source: isAi ? "ai" : "manual",
        ai_params: data.ai_params,
        ai_model: data.ai_model,
      },
    });
  }

  async update(id: string, tenantId: string, userId: string, data: any) {
    // 验证内容归属
    const existing = await this.prisma.content.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!existing) {
      throw new NotFoundException("内容不存在");
    }

    // 只有草稿或已驳回的内容可以编辑
    if (!["draft", "rejected"].includes(existing.status)) {
      throw new ForbiddenException("当前状态不允许编辑");
    }

    // 只挑白名单字段，即使调用方传了别的也不会写进去（DTO 已先拒绝，这里是第二道）
    const patch: Record<string, unknown> = {};
    for (const field of UPDATABLE_FIELDS) {
      if (data && data[field] !== undefined) patch[field] = data[field];
    }
    // AI 生成的内容：编辑不能删掉「AI 生成」显式标识
    if (existing.source === "ai") {
      for (const field of ["body"] as const) {
        const value = patch[field];
        if (typeof value === "string" && value.trim()) patch[field] = labelAiGeneratedText(value);
      }
    }

    return this.prisma.content.update({
      where: { id },
      data: {
        ...patch,
        version: { increment: 1 },
        updated_at: new Date(),
      },
    });
  }

  async delete(id: string, tenantId: string) {
    // 软删除
    return this.prisma.content.update({
      where: { id, tenant_id: tenantId },
      data: { status: "deleted" },
    });
  }

  async submitForReview(id: string, tenantId: string) {
    const content = await this.prisma.content.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!content) {
      throw new NotFoundException("内容不存在");
    }
    // 已发布、已通过、审核中的内容不能倒退回「待审核」
    if (!["draft", "rejected"].includes(content.status)) {
      throw new BadRequestException("只有草稿或已驳回的内容可以提交审核");
    }
    return this.prisma.content.update({
      where: { id, tenant_id: tenantId },
      data: { status: "pending_review" },
    });
  }

  async review(
    id: string,
    tenantId: string,
    reviewerId: string,
    action: "approve" | "reject",
    comment?: string,
  ) {
    const content = await this.prisma.content.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!content || content.status !== "pending_review") {
      throw new NotFoundException("没有待审核的内容");
    }

    // 更新内容状态
    await this.prisma.content.update({
      where: { id },
      data: {
        status: action === "approve" ? "approved" : "rejected",
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
