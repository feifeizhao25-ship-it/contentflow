import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { labelAiGeneratedText } from "../../common/ai-content-label";
import { normalizePaging } from "../../common/pagination";

/** 能审核内容的角色。JwtStrategy 每次请求都以数据库里当前的角色为准。 */
export const REVIEWER_ROLES = ["owner", "admin"];

/** 自行确认在内容与审核日志里的固定说明，界面据此显示「所有者自行确认」。 */
export const SELF_CONFIRM_LABEL = "所有者自行确认（工作区没有其他审核人）";

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

/** 素材类型。创作页目前只存 script（正文脚本）和 cover（封面）；image / video 进配图列表。 */
export const CONTENT_ASSET_TYPES = ["script", "cover", "image", "video"] as const;
export type ContentAssetType = (typeof CONTENT_ASSET_TYPES)[number];
export interface ContentAsset {
  type: ContentAssetType;
  url: string;
  label: string;
  meta?: { content?: string };
}
const ASSET_LABELS: Record<ContentAssetType, string> = {
  script: "正文脚本",
  cover: "封面图",
  image: "配图",
  video: "视频",
};
const MAX_ASSET_URL = 500; // 与 cover_url 的长度上限一致
const MAX_SCRIPT = 200_000; // 与 body 的长度上限一致

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || value.startsWith("/");
}

/**
 * 校验并规整创作页传来的素材。不合法时抛 400，说明是第几项、哪里不对。
 * 素材不单独建表：脚本就是正文 body，封面就是 cover_url，配图 / 视频进 media_urls，
 * 这样内容库、审核、发布看到的都是同一份数据。
 */
export function normalizeAssets(raw: unknown[]): ContentAsset[] {
  return raw.map((item, index) => {
    const n = index + 1;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new BadRequestException(`第 ${n} 个素材格式不对`);
    }
    const { type, url, meta } = item as { type?: unknown; url?: unknown; meta?: unknown };
    if (typeof type !== "string" || !(CONTENT_ASSET_TYPES as readonly string[]).includes(type)) {
      throw new BadRequestException(`第 ${n} 个素材类型不支持，只能是 ${CONTENT_ASSET_TYPES.join(" / ")}`);
    }
    const kind = type as ContentAssetType;
    const link = typeof url === "string" ? url.trim() : "";
    if (kind === "script") {
      const content = meta && typeof meta === "object" ? (meta as { content?: unknown }).content : undefined;
      if (typeof content !== "string") throw new BadRequestException(`第 ${n} 个素材（正文脚本）缺少内容`);
      if (content.length > MAX_SCRIPT) throw new BadRequestException(`第 ${n} 个素材（正文脚本）太长`);
      return { type: kind, url: "", label: ASSET_LABELS[kind], meta: { content } };
    }
    if (!link || link.length > MAX_ASSET_URL || !isHttpUrl(link)) {
      throw new BadRequestException(`第 ${n} 个素材（${ASSET_LABELS[kind]}）的地址不对`);
    }
    return { type: kind, url: link, label: ASSET_LABELS[kind] };
  });
}

const VIDEO_URL = /\.(mp4|mov|webm|m3u8)(\?|#|$)/i;

function mediaList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];
}

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

  /** 内容的素材视图：正文脚本、封面、配图（来自 body、cover_url、media_urls）。 */
  async listAssets(id: string, tenantId: string): Promise<{ assets: ContentAsset[] }> {
    const content: any = await this.findById(id, tenantId);
    if (content.status === "deleted") throw new NotFoundException("内容不存在");
    const assets: ContentAsset[] = [];
    if (typeof content.body === "string" && content.body.trim()) {
      assets.push({ type: "script", url: "", label: ASSET_LABELS.script, meta: { content: content.body } });
    }
    if (typeof content.cover_url === "string" && content.cover_url.trim()) {
      assets.push({ type: "cover", url: content.cover_url, label: ASSET_LABELS.cover });
    }
    for (const url of mediaList(content.media_urls)) {
      if (url === content.cover_url) continue;
      const type: ContentAssetType = VIDEO_URL.test(url) ? "video" : "image";
      assets.push({ type, url, label: ASSET_LABELS[type] });
    }
    return { assets };
  }

  /**
   * 保存素材：脚本写进正文，封面写进 cover_url，配图 / 视频追加到 media_urls（去重）。
   * 走 update()，所以「只有草稿或已驳回能改」「AI 内容保留 AI 生成标识」「只写白名单字段」照样生效。
   */
  async appendAssets(id: string, tenantId: string, userId: string, raw: unknown[]) {
    const assets = normalizeAssets(Array.isArray(raw) ? raw : []);
    const content: any = await this.findById(id, tenantId);
    if (content.status === "deleted") throw new NotFoundException("内容不存在");
    const patch: Record<string, unknown> = {};
    const media = mediaList(content.media_urls);
    for (const asset of assets) {
      if (asset.type === "script") {
        if (asset.meta?.content !== content.body) patch.body = asset.meta?.content;
      } else if (asset.type === "cover") {
        if (asset.url !== content.cover_url) patch.cover_url = asset.url;
        if (!media.includes(asset.url)) media.push(asset.url);
      } else if (!media.includes(asset.url)) {
        media.push(asset.url);
      }
    }
    if (media.length !== mediaList(content.media_urls).length) patch.media_urls = media;
    if (Object.keys(patch).length > 0) {
      await this.update(id, tenantId, userId, patch);
    }
    return this.listAssets(id, tenantId);
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
    // 只软删除本工作区的内容。别的工作区或不存在都是 404，不把 Prisma 的「找不到行」变成 500。
    const existing = await this.prisma.content.findFirst({
      where: { id, tenant_id: tenantId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("内容不存在");
    try {
      return await this.prisma.content.update({
        where: { id },
        data: { status: "deleted" },
      });
    } catch (error) {
      if ((error as { code?: string })?.code === "P2025") throw new NotFoundException("内容不存在");
      throw error;
    }
  }

  async submitForReview(id: string, tenantId: string, userId?: string) {
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
    const updated = await this.prisma.content.update({
      where: { id, tenant_id: tenantId },
      data: { status: "pending_review" },
    });
    if (userId) {
      // 留痕：谁在什么时候提交的（reviewer_id 记操作人）
      await this.prisma.reviewLog.create({
        data: { content_id: id, reviewer_id: userId, action: "submit" },
      });
    }
    return updated;
  }

  /**
   * 审核人策略：谁能通过 / 驳回、作者能不能自己确认。
   *
   * - 只有所有者、管理员能审核；**不能审核自己创作（或自己提交）的内容**。
   * - 工作区里没有「作者以外的所有者 / 管理员」时（单人工作区，或只有所有者一个人有审核权），
   *   所有者的内容没有人能审，会永远卡在待审核。这时允许**所有者**走「自行确认」：
   *   必须显式二次确认，记录为 self_confirm（审核日志与内容上都写明「所有者自行确认」），
   *   而不是伪装成普通审核通过。管理员、编辑等其他角色不能自行确认。
   */
  async reviewPolicy(tenantId: string, user: { sub: string; role: string }) {
    const otherReviewers = await this.prisma.user.count({
      where: {
        tenant_id: tenantId,
        status: "active",
        role: { in: REVIEWER_ROLES },
        id: { not: user.sub },
      },
    });
    const canReview = REVIEWER_ROLES.includes(user.role);
    return {
      userId: user.sub,
      role: user.role,
      canReview,
      otherReviewers,
      canSelfConfirm: user.role === "owner" && otherReviewers === 0,
    };
  }

  /** 作者 = 创建人；提交审核的人也算（防止「别人建、自己提、自己批」）。 */
  private async isAuthorOrSubmitter(content: { id: string; created_by: string | null }, userId: string) {
    if (content.created_by && content.created_by === userId) return true;
    const lastSubmit = await this.prisma.reviewLog.findFirst({
      where: { content_id: content.id, action: "submit" },
      orderBy: { created_at: "desc" },
    });
    return Boolean(lastSubmit && lastSubmit.reviewer_id === userId);
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

    const reason = typeof comment === "string" ? comment.trim() : "";
    if (action === "reject" && !reason) {
      throw new BadRequestException("驳回时请填写原因，方便作者修改");
    }

    // 作者不能自己批准 / 驳回自己的内容（单人工作区走 selfConfirm，需二次确认并单独记录）
    if (await this.isAuthorOrSubmitter(content, reviewerId)) {
      throw new ForbiddenException("不能审核自己创作或提交的内容，请让工作区里的其他所有者或管理员审核");
    }

    // 更新内容状态
    await this.prisma.content.update({
      where: { id },
      data: {
        status: action === "approve" ? "approved" : "rejected",
        reviewed_by: reviewerId,
        reviewed_at: new Date(),
        review_comment: reason || null,
      },
    });

    // 记录审核日志
    await this.prisma.reviewLog.create({
      data: {
        content_id: id,
        reviewer_id: reviewerId,
        action,
        comment: reason || null,
      },
    });

    return { success: true };
  }

  /**
   * 所有者自行确认（只在工作区没有其他审核人时允许，见 reviewPolicy）。
   * 必须带 confirm=true（界面上的二次确认），记录为 self_confirm。
   */
  async selfConfirm(
    id: string,
    tenantId: string,
    user: { sub: string; role: string },
    data: { confirm: boolean; note?: string },
  ) {
    if (data?.confirm !== true) {
      throw new BadRequestException("请先确认你已自行检查这条内容");
    }
    const policy = await this.reviewPolicy(tenantId, user);
    if (!policy.canSelfConfirm) {
      throw new ForbiddenException(
        user.role === "owner"
          ? "工作区里还有其他所有者或管理员，请让他们审核"
          : "只有工作区所有者在没有其他审核人时可以自行确认",
      );
    }
    const content = await this.prisma.content.findFirst({ where: { id, tenant_id: tenantId } });
    if (!content || content.status !== "pending_review") {
      throw new NotFoundException("没有待审核的内容，请先提交审核");
    }
    const note = typeof data.note === "string" ? data.note.trim() : "";
    const comment = `${SELF_CONFIRM_LABEL}${note ? `：${note}` : ""}`;
    const now = new Date();
    await this.prisma.content.update({
      where: { id },
      data: { status: "approved", reviewed_by: user.sub, reviewed_at: now, review_comment: comment },
    });
    await this.prisma.reviewLog.create({
      data: {
        content_id: id,
        reviewer_id: user.sub,
        action: "self_confirm",
        comment,
        changes: { self_confirm: true, other_reviewers: policy.otherReviewers, confirmed_at: now.toISOString() },
      },
    });
    return { success: true, selfConfirmed: true };
  }

  /** 审核记录（时间倒序），用于界面展示驳回原因与自行确认留痕。 */
  async reviewLogs(id: string, tenantId: string) {
    const content = await this.prisma.content.findFirst({ where: { id, tenant_id: tenantId }, select: { id: true } });
    if (!content) throw new NotFoundException("内容不存在");
    return this.prisma.reviewLog.findMany({
      where: { content_id: id },
      orderBy: { created_at: "desc" },
      take: 50,
      select: { id: true, reviewer_id: true, action: true, comment: true, created_at: true },
    });
  }
}
