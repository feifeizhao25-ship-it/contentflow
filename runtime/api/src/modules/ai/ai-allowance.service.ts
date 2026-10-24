import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AIService } from './ai.service';
import { IMAGE_TOKEN_EQUIVALENT } from './model-pricing';
import {
  AI_MONTHLY_QUOTA_MESSAGE,
  AiQuotaExceededError,
  AiRequestInProgressError,
  ReservationProduct,
  ResourceType,
  UsageService,
} from '../system/usage.service';

export { AI_MONTHLY_QUOTA_MESSAGE, AiQuotaExceededError, AiRequestInProgressError };

/**
 * 所有 AI 生成接口（文章、标题、脚本、图片、爆款分析、内容包）共用的额度闸。
 *
 * 调用模型之前先在数据库里占住令牌（多实例安全），成功后按实际用量入账并退回多占的部分，
 * 失败则退回。模型已经成功但入账或生成记录没写上时，结算数据留在预占行里，对账任务会补记。
 */
@Injectable()
export class AiAllowanceService {
  private readonly logger = new Logger(AiAllowanceService.name);

  constructor(
    private readonly aiService: AIService,
    private readonly usageService: UsageService,
  ) {}

  async withReservation<T>(opts: {
    tenantId: string;
    kind: string;
    holdTokens: number;
    idempotencyKey: string;
    run: () => Promise<ReservationProduct<T>>;
  }): Promise<T> {
    await this.aiService.assertTenantDailyBudget(opts.tenantId);
    try {
      return await this.usageService.withAiHold({
        tenantId: opts.tenantId,
        holdTokens: opts.holdTokens,
        kind: opts.kind,
        idempotencyKey: opts.idempotencyKey,
      }, opts.run);
    } catch (error) {
      if (error instanceof AiQuotaExceededError) {
        throw new HttpException({ message: error.message, error: 'AI_MONTHLY_QUOTA' }, HttpStatus.TOO_MANY_REQUESTS);
      }
      if (error instanceof AiRequestInProgressError) {
        throw new HttpException({ message: error.message, error: 'AI_REQUEST_IN_PROGRESS' }, HttpStatus.CONFLICT);
      }
      throw error;
    }
  }

  /** 每日预算 + 月度剩余（含预占）。图片等固定消耗传入 requiredTokens。 */
  async assertAllowed(tenantId: string, requiredTokens?: number): Promise<void> {
    await this.aiService.assertTenantDailyBudget(tenantId);
    const hasQuota = requiredTokens === undefined
      ? await this.usageService.checkQuota(tenantId, ResourceType.TOKENS)
      : await this.usageService.checkQuota(tenantId, ResourceType.TOKENS, requiredTokens);
    if (!hasQuota) {
      throw new HttpException(
        { message: requiredTokens === undefined ? AI_MONTHLY_QUOTA_MESSAGE : `本月 AI 剩余额度不足，本次生成需要 ${requiredTokens} 令牌，可升级套餐，或在下月 1 日额度恢复后再试`, error: 'AI_MONTHLY_QUOTA' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** 文本生成：按供应商返回的 token 总数记账。预占流程不要再调用这里。 */
  async chargeTokens(tenantId: string, totalTokens: number, type: string): Promise<void> {
    const tokens = Math.max(0, Math.round(Number(totalTokens) || 0));
    if (!tokens) {
      this.logger.warn(`AI 调用未返回 token 用量（${type}），本次未计入额度`);
      return;
    }
    await this.usageService.trackUsage(tenantId, ResourceType.TOKENS, tokens, { type });
  }

  /** 图片生成：计一张图，并按固定折算计入 AI 令牌额度。预占流程不要再调用这里。 */
  async chargeImage(tenantId: string): Promise<void> {
    await this.usageService.trackUsageBatch(tenantId, {
      [ResourceType.IMAGES]: 1,
      [ResourceType.TOKENS]: IMAGE_TOKEN_EQUIVALENT,
    }, { type: 'image' });
  }
}
