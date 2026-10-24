import { Injectable, NotFoundException, BadRequestException, ForbiddenException, HttpException, InternalServerErrorException, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PublishQueueService } from '../../queue/publish-queue.service';
import { TenantService } from '../tenant/tenant.service';
import { AdapterRegistry } from './adapters/adapter.registry';
import { ConfigService } from '@nestjs/config';
import { evaluateDomesticContent } from '../../common/domestic-content-compliance';
import { isRealNameRequiredForPublish } from '../auth/real-name/real-name.verifier';
import { labelAiGeneratedText, AI_TEXT_LABEL, aigcProviderCode } from '../../common/ai-content-label';
import { MANUAL_DONE, MANUAL_PENDING, MANUAL_PLATFORMS, isManualPlatform, normalizeManualPostUrl } from './manual-publish';
import { PUBLISH_LOG_MAX_ROWS, PublishTaskFilter, channelUnavailableReason, publishTaskWhere, publishTasksToCsv } from './publish-log';
import { adaptBodyForPlatform } from '../ai/platform-adaptation';
import { WebhookService } from '../developer/webhook.service';
import { RagPolicyService } from '../ai/rag-policy.service';

@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publishQueue: PublishQueueService,
    private readonly tenantService: TenantService,
    private readonly adapterRegistry: AdapterRegistry,
    private readonly config: ConfigService,
    @Optional() private readonly webhooks?: WebhookService,
    @Optional() private readonly rag?: RagPolicyService,
  ) {}

  /**
   * 发布信息类服务要求实名：REAL_NAME_REQUIRED_FOR_PUBLISH 打开时，必须已验证手机号并完成实名认证。
   * 实名认证服务是外部资质、尚未接入，所以打开开关后在接入之前没有人能发布——这是刻意的。
   */
  private async assertRealNameIfRequired(userId: string): Promise<void> {
    if (!isRealNameRequiredForPublish(this.config.get('REAL_NAME_REQUIRED_FOR_PUBLISH'))) return;
    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone_verified: true, status: true, real_name_verified: true } as any,
    })) as any;
    if (!user || user.status !== 'active') throw new ForbiddenException('账号不存在或已注销');
    if (!user.phone_verified) {
      throw new ForbiddenException({ code: 'PHONE_REQUIRED', message: '发布内容前请先绑定并验证手机号' });
    }
    if (!user.real_name_verified) {
      throw new ForbiddenException({ code: 'REAL_NAME_REQUIRED', message: '发布内容前需要完成实名认证' });
    }
  }

  async createTask(tenantId: string, userId: string, data: {
    contentId: string;
    platformAccountIds: string[];
    publishType: 'immediate' | 'scheduled';
    scheduledAt?: Date;
    riskAcknowledged?: boolean;
  }) {
    if (!['immediate', 'scheduled'].includes(data.publishType)) throw new BadRequestException('发布类型无效');
    const accountIds = [...new Set(data.platformAccountIds || [])];
    if (!accountIds.length) throw new BadRequestException('请至少选择一个平台账号');
    if (accountIds.length !== data.platformAccountIds.length) throw new BadRequestException('平台账号不能重复');
    const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : undefined;
    if (data.publishType === 'scheduled' && (!scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now())) {
      throw new BadRequestException('定时发布时间必须晚于当前时间');
    }
    await this.assertRealNameIfRequired(userId);
    // 检查内容是否存在且已审核通过
    const content = await this.prisma.content.findFirst({
      where: { id: data.contentId, tenant_id: tenantId },
    });

    if (!content) {
      throw new NotFoundException('内容不存在');
    }

    if (content.status !== 'approved' && content.status !== 'published') {
      throw new BadRequestException('内容未通过审核');
    }

    await this.assertDomesticCompliance(
      [content.title, content.body, content.body_html].filter(Boolean).join('\n'),
      data.riskAcknowledged === true,
    );

    // 检查配额
    // 一次发到 N 个账号计 N 条；按北京时间自然月计数（见 TenantService.currentUsageStats）。
    const canPublish = await this.tenantService.checkQuota(tenantId, 'publish', accountIds.length);
    if (!canPublish) {
      throw new BadRequestException('发布次数已达上限，请升级套餐');
    }

    // 在写入任何任务前一次性验证所有账号与真实适配器能力，避免批量部分成功。
    const accounts = await Promise.all(
      accountIds.map(async (accountId) => {
        const account = await this.prisma.platformAccount.findFirst({
          where: { id: accountId, tenant_id: tenantId },
        });
        if (!account || account.status !== 'active') {
          throw new NotFoundException(`平台账号不存在或已禁用: ${accountId}`);
        }
        let adapter;
        try { adapter = this.adapterRegistry.get(account.platform); }
        catch { throw new BadRequestException(channelUnavailableReason(account.platform, 'no_adapter', 'create')); }
        if (!adapter.isLive) throw new BadRequestException(channelUnavailableReason(account.platform, 'not_live', 'create'));
        return account;
      }),
    );

    const tasks = await Promise.all(
      accounts.map(async (account) => {
        const scheduledTime = data.publishType === 'scheduled' && scheduledAt
          ? scheduledAt
          : new Date();

        const task = await this.prisma.publishTask.create({
          data: {
            tenant_id: tenantId,
            content_id: data.contentId,
            platform_account_id: account.id,
            created_by: userId,
            publish_type: data.publishType,
            scheduled_at: scheduledTime,
            status: 'queued',
            queued_at: new Date(),
          },
        });

        try {
          const delay = Math.max(0, scheduledTime.getTime() - Date.now());
          await this.publishQueue.addPublishTask({
            taskId: task.id,
            contentId: data.contentId,
            platformAccountId: account.id,
            platform: account.platform,
            scheduledAt: scheduledTime,
          }, delay);
        } catch (error) {
          await this.prisma.publishTask.update({ where: { id: task.id }, data: { status: 'failed', error_code: 'QUEUE_UNAVAILABLE', error_message: '发布队列暂时不可用' } });
          throw new InternalServerErrorException('发布队列暂时不可用，任务未进入发布流程');
        }

        return task;
      })
    );

    // 增加使用量统计
    await this.tenantService.incrementUsage(tenantId, 'publish', tasks.length);

    return tasks;
  }

  /** 发布前的共同检查：内容存在、已审核通过、过国内版合规检查。 */
  private async loadPublishableContent(tenantId: string, contentId: string, riskAcknowledged = false) {
    const content = await this.prisma.content.findFirst({ where: { id: contentId, tenant_id: tenantId } });
    if (!content) throw new NotFoundException('内容不存在');
    if (content.status !== 'approved' && content.status !== 'published') throw new BadRequestException('内容未通过审核');
    await this.assertDomesticCompliance(
      [content.title, content.body, content.body_html].filter(Boolean).join('\n'),
      riskAcknowledged,
    );
    return content;
  }

  /**
   * 国内发布前检查。明确违规直接拒绝。资料过期（保守模式）时，
   * “可能有风险”不停止生成，但发布前必须由用户确认已自行核对。
   */
  private async assertDomesticCompliance(text: string, riskAcknowledged = false): Promise<void> {
    if (this.config.get<string>('MARKET_REGION', 'cn') !== 'cn') return;
    let conservative = false;
    try {
      conservative = !!(await this.rag?.freshnessReport())?.needsReview;
    } catch {
      conservative = false;
    }
    const compliance = evaluateDomesticContent(text, { conservative });
    if (!compliance.passed) {
      throw new BadRequestException({
        code: 'CONTENT_COMPLIANCE_BLOCKED',
        message: '内容未通过国内版发布前检查。这不是法律意见。',
        ruleSetVersion: compliance.ruleSetVersion,
        level: compliance.level,
        disclaimer: compliance.disclaimer,
        hits: compliance.hits,
      });
    }
    const review = compliance.hits.filter((hit) => hit.severity === 'review');
    if (conservative && review.length && !riskAcknowledged) {
      throw new BadRequestException({
        code: 'COMPLIANCE_RISK_ACK_REQUIRED',
        message: '规则资料已过期，本次按更严格的标准提示风险。确认你已自行核对后才能发布。这不是法律意见。',
        ruleSetVersion: compliance.ruleSetVersion,
        level: compliance.level,
        disclaimer: compliance.disclaimer,
        hits: review,
      });
    }
  }

  /**
   * 人工确认发布：小红书 / 视频号 / 公众号。不进发布队列、不调用任何平台接口，
   * 只记录任务（manual_pending），由用户复制文案、下载封面后自己到平台发出。
   * 计入每月发布条数（与自动发布同一口径）。
   */
  async createManualTasks(tenantId: string, userId: string, data: { contentId: string; platforms: string[]; scheduledAt?: Date; riskAcknowledged?: boolean }) {
    const platforms = [...new Set(data.platforms || [])];
    if (!platforms.length) throw new BadRequestException('请至少选择一个平台');
    const unsupported = platforms.filter((p) => !isManualPlatform(p));
    if (unsupported.length) throw new BadRequestException('人工确认发布支持小红书、视频号、公众号、抖音、B站（均为手动发布，非自动发布）');
    const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : new Date();
    if (Number.isNaN(scheduledAt.getTime())) throw new BadRequestException('计划发布时间格式不正确');
    await this.assertRealNameIfRequired(userId);
    const content = await this.loadPublishableContent(tenantId, data.contentId, data.riskAcknowledged === true);
    if (!(await this.tenantService.checkQuota(tenantId, 'publish', platforms.length))) {
      throw new BadRequestException('本月发布次数已达上限，请升级套餐或下月再发');
    }
    const aiGenerated = content.source === 'ai';
    const body = content.body || '';
    const tasks = [];
    for (const platform of platforms) {
      // 按平台留一份文案快照（AI 生成的内容必须带显式标识）
      // 批2/批3：按平台改写后的正文快照（抖音/B站也是人工确认发布，不是自动发布）
      const variant = adaptBodyForPlatform(body, platform, content.title || '');
      const snapshot = aiGenerated ? labelAiGeneratedText(variant.body) : variant.body;
      const platformContent = await this.prisma.platformContent.upsert({
        where: { content_id_platform: { content_id: content.id, platform } },
        create: { content_id: content.id, platform, title: content.title, body: snapshot, cover_url: content.cover_url },
        update: { title: content.title, body: snapshot, cover_url: content.cover_url },
      });
      tasks.push(await this.prisma.publishTask.create({
        data: {
          tenant_id: tenantId,
          content_id: content.id,
          platform_content_id: platformContent.id,
          created_by: userId,
          publish_type: 'manual',
          scheduled_at: scheduledAt,
          status: MANUAL_PENDING,
        },
      }));
    }
    await this.tenantService.incrementUsage(tenantId, 'publish', tasks.length);
    return tasks;
  }

  /** 「复制文案」「下载封面」用的发布素材。 */
  async getManualKit(taskId: string, tenantId: string) {
    const task = await this.prisma.publishTask.findFirst({
      where: { id: taskId, tenant_id: tenantId },
      include: { content: { select: { title: true, body: true, cover_url: true, source: true } }, platform_content: true },
    });
    if (!task) throw new NotFoundException('任务不存在');
    const platform = task.platform_content?.platform ?? '';
    if (!isManualPlatform(platform)) throw new BadRequestException('该任务不是人工确认发布任务');
    const aiGenerated = task.content?.source === 'ai';
    const rawBody = task.platform_content?.body ?? task.content?.body ?? '';
    return {
      platform,
      platformName: MANUAL_PLATFORMS[platform].name,
      guide: MANUAL_PLATFORMS[platform].guide,
      title: task.platform_content?.title ?? task.content?.title ?? '',
      // AI 生成的内容：复制出去的文案必须带「AI 生成」显式标识，不能弱化
      body: aiGenerated ? labelAiGeneratedText(rawBody) : rawBody,
      coverUrl: task.platform_content?.cover_url ?? task.content?.cover_url ?? null,
      aiGenerated,
      aiLabel: aiGenerated ? AI_TEXT_LABEL : null,
      // 隐式标识要素：下载封面时写入图片元数据
      contentId: task.content_id,
      providerCode: aigcProviderCode(),
      status: task.status,
      postUrl: task.platform_post_url,
    };
  }

  /** 用户确认已在平台手动发布；可回填作品链接（只保存，不抓取）。 */
  async confirmManualPublished(taskId: string, tenantId: string, postUrl?: string) {
    const task = await this.prisma.publishTask.findFirst({
      where: { id: taskId, tenant_id: tenantId },
      include: { platform_content: { select: { platform: true } } },
    });
    if (!task) throw new NotFoundException('任务不存在');
    const platform = task.platform_content?.platform ?? '';
    if (!isManualPlatform(platform)) throw new BadRequestException('该任务不是人工确认发布任务');
    if (task.status !== MANUAL_PENDING && task.status !== MANUAL_DONE) throw new BadRequestException('当前状态不能标记为已手动发布');
    let url: string | null;
    try {
      url = normalizeManualPostUrl(platform, postUrl);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : '作品链接格式不正确');
    }
    const updated = await this.prisma.publishTask.update({
      where: { id: taskId },
      data: { status: MANUAL_DONE, platform_post_url: url ?? task.platform_post_url ?? null, completed_at: task.completed_at ?? new Date() },
    });
    // 批3 Webhook：人工确认完成也算 publish.task.success（manual:true 标明非自动发布）
    void this.webhooks?.dispatch(tenantId, 'publish.task.success', { task_id: taskId, platform, post_url: url ?? null, manual: true });
    return updated;
  }

  /**
   * 发布任务列表。筛选（关键词、平台、状态、日期）与导出共用 publishTaskWhere，
   * 只查当前工作区自己的任务。
   */
  async getTasks(tenantId: string, options: { filter?: PublishTaskFilter; status?: string; page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 20 } = options;
    const skip = (page - 1) * pageSize;

    const filter: PublishTaskFilter = { ...(options.filter ?? {}) };
    if (options.status && !filter.statuses) filter.statuses = [options.status];
    const where = publishTaskWhere(tenantId, filter);

    const [tasks, total] = await Promise.all([
      this.prisma.publishTask.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { created_at: 'desc' },
        include: {
          content: { select: { title: true } },
          platform_account: { select: { platform: true, account_name: true, account_nickname: true } },
          platform_content: { select: { platform: true } },
        },
      }),
      this.prisma.publishTask.count({ where }),
    ]);

    return {
      tasks,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 导出发布日志（CSV，中文表头）：只含当前工作区的任务，与列表同一筛选条件。
   * 超过上限时只导出最新的 PUBLISH_LOG_MAX_ROWS 条，并在返回里标明被截断。
   */
  async exportTasksCsv(tenantId: string, filter: PublishTaskFilter): Promise<{ csv: string; rows: number; truncated: boolean }> {
    const where = publishTaskWhere(tenantId, filter);
    const tasks = await this.prisma.publishTask.findMany({
      where,
      take: PUBLISH_LOG_MAX_ROWS + 1,
      orderBy: { created_at: 'desc' },
      include: {
        content: { select: { title: true } },
        platform_account: { select: { platform: true, account_name: true, account_nickname: true } },
        platform_content: { select: { platform: true } },
      },
    });
    const truncated = tasks.length > PUBLISH_LOG_MAX_ROWS;
    const rows = truncated ? tasks.slice(0, PUBLISH_LOG_MAX_ROWS) : tasks;
    return { csv: publishTasksToCsv(rows), rows: rows.length, truncated };
  }

  /**
   * 批量重试：逐条走 retryTask（同样只认本工作区、只认失败任务、通道未接入的照样拒绝），
   * 不因为一条失败就整批回滚；返回每条的结果和中文原因。
   */
  async retryTasks(taskIds: string[], tenantId: string) {
    const ids = [...new Set((taskIds || []).map(String))];
    if (!ids.length) throw new BadRequestException('请选择要重试的任务');
    if (ids.length > 50) throw new BadRequestException('一次最多重试 50 条任务');
    const results: Array<{ id: string; ok: boolean; reason?: string }> = [];
    for (const id of ids) {
      try {
        await this.retryTask(id, tenantId);
        results.push({ id, ok: true });
      } catch (error) {
        const reason = error instanceof HttpException ? this.httpReason(error) : '暂时无法重试';
        results.push({ id, ok: false, reason });
      }
    }
    return { requested: ids.length, retried: results.filter((r) => r.ok).length, results };
  }

  private httpReason(error: HttpException): string {
    const body: any = error.getResponse();
    const message = typeof body === 'string' ? body : Array.isArray(body?.message) ? body.message[0] : body?.message;
    return typeof message === 'string' && /[一-鿿]/.test(message) ? message : '暂时无法重试';
  }

  async retryTask(taskId: string, tenantId: string) {
    const task = await this.prisma.publishTask.findFirst({
      where: { id: taskId, tenant_id: tenantId },
      include: { platform_account: true },
    });

    if (!task) {
      throw new NotFoundException('任务不存在');
    }

    if (task.status !== 'failed') {
      throw new BadRequestException('只有失败的任务可以重试');
    }

    if (!task.platform_account_id || !task.platform_account) {
      throw new BadRequestException(channelUnavailableReason(null, 'no_account', 'retry'));
    }

    let adapter;
    try { adapter = this.adapterRegistry.get(task.platform_account.platform); }
    catch { throw new BadRequestException(channelUnavailableReason(task.platform_account.platform, 'no_adapter', 'retry')); }
    if (!adapter.isLive) throw new BadRequestException(channelUnavailableReason(task.platform_account.platform, 'not_live', 'retry'));

    await this.prisma.publishTask.update({ where: { id: taskId }, data: { status: 'queued', retry_count: { increment: 1 }, started_at: null, completed_at: null, error_code: null, error_message: null } });
    try {
      await this.publishQueue.retryPublishTask({ taskId: task.id, contentId: task.content_id, platformAccountId: task.platform_account_id, platform: task.platform_account.platform });
    } catch {
      await this.prisma.publishTask.update({ where: { id: taskId }, data: { status: 'failed', error_code: 'QUEUE_UNAVAILABLE', error_message: '发布队列暂时不可用' } });
      throw new InternalServerErrorException('发布队列暂时不可用，任务未重新进入发布流程');
    }

    return { success: true, message: '任务已重新加入队列' };
  }

  async cancelTask(taskId: string, tenantId: string) {
    const task = await this.prisma.publishTask.findFirst({
      where: { id: taskId, tenant_id: tenantId },
    });

    if (!task) {
      throw new NotFoundException('任务不存在');
    }

    if (!['pending', 'queued', 'failed', MANUAL_PENDING].includes(task.status)) {
      throw new BadRequestException('当前状态无法取消');
    }

    return this.prisma.publishTask.update({
      where: { id: taskId },
      data: { status: 'cancelled' },
    });
  }
}
