import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AIService } from './ai.service';
import { ResourceType, UsageService } from '../system/usage.service';
import { IMAGE_TOKEN_EQUIVALENT } from './model-pricing';

export const AI_MONTHLY_QUOTA_MESSAGE = '本月 AI 额度已用完，可升级套餐，或在下月 1 日额度恢复后再试';

/**
 * 所有 AI 生成接口（文章、标题、脚本、图片、爆款分析、内容包）共用的额度闸。
 *
 * 原来文章、标题、脚本、图片接口只查「租户每日成本预算」，而国内模型的成本一直记成 null，
 * 预算永远是 0，于是免费版等于无限 AI；套餐里的「每月 N 万 AI 令牌」只有内容包在查。
 * 现在：
 *  1. 每日成本预算（超出 → 429「今日 AI 用量已达上限」）；
 *  2. 套餐月度 AI 令牌额度（超出 → 429「本月 AI 额度已用完…」）；
 *  3. 生成成功后按实际 token 数（图片按固定折算）记入当月用量。
 */
@Injectable()
export class AiAllowanceService {
  private readonly logger = new Logger(AiAllowanceService.name);

  constructor(
    private readonly aiService: AIService,
    private readonly usageService: UsageService,
  ) {}

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

  /** 文本生成：按供应商返回的 token 总数记账。 */
  async chargeTokens(tenantId: string, totalTokens: number, type: string): Promise<void> {
    const tokens = Math.max(0, Math.round(Number(totalTokens) || 0));
    if (!tokens) {
      this.logger.warn(`AI 调用未返回 token 用量（${type}），本次未计入额度`);
      return;
    }
    await this.usageService.trackUsage(tenantId, ResourceType.TOKENS, tokens, { type });
  }

  /** 图片生成：计一张图，并按固定折算计入 AI 令牌额度。 */
  async chargeImage(tenantId: string): Promise<void> {
    await this.usageService.trackUsageBatch(tenantId, {
      [ResourceType.IMAGES]: 1,
      [ResourceType.TOKENS]: IMAGE_TOKEN_EQUIVALENT,
    }, { type: 'image' });
  }
}
