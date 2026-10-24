import { Injectable, Logger, InternalServerErrorException, HttpException, HttpStatus } from '@nestjs/common';
import { AIService } from './ai.service';
import { UsageService, AiQuotaExceededError, AiRequestInProgressError } from '../system/usage.service';
import { AI_HOLD_TOKENS } from './ai-holds';
import { ComplianceService } from './compliance.service';
import { GenerateContentPackDto } from './dto/generate-content-pack.dto';
import { labelAiGeneratedText, buildAiMediaMetadata } from '../../common/ai-content-label';
import { RagPolicyService } from './rag-policy.service';
import { adaptForPlatforms } from './platform-adaptation';

@Injectable()
export class ContentPackService {
    private readonly logger = new Logger(ContentPackService.name);

    constructor(
        private readonly aiService: AIService,
        private readonly usageService: UsageService,
        private readonly complianceService: ComplianceService,
        private readonly ragPolicyService: RagPolicyService,
    ) { }

    async generatePack(tenantId: string, dto: GenerateContentPackDto, userId?: string, idempotencyKey?: string) {
        // 额度闸：先查每日成本预算，再在数据库里占住本月令牌。占住之后才调用模型。
        await this.aiService.assertTenantDailyBudget(tenantId);
        this.logger.log(`Generating content pack for topic: ${dto.topic}`);

        try {
            return await this.usageService.withAiHold({
                tenantId,
                holdTokens: AI_HOLD_TOKENS.content_pack,
                kind: 'content_pack',
                idempotencyKey: idempotencyKey || '',
            }, async () => {
            // 2. Multi-step AI Pipeline
            // Step A: Headlines x 10
            const platformsStr = dto.platforms?.join(',') || '全渠道';
            const titleResult = await this.aiService.generateTitlesWithUsage(dto.topic, platformsStr, 10);
            const titles = titleResult?.titles;
            if (!Array.isArray(titles) || titles.length === 0 ||
                titles.some(title => typeof title !== 'string' || !title.trim())) {
                throw new Error('AI provider did not return usable titles');
            }
            const titleTokens = titleResult?.usage?.total_tokens;
            if (!Number.isSafeInteger(titleTokens) || titleTokens <= 0) {
                throw new Error('AI provider did not return valid title token usage');
            }

            // Step B: Script/Body
            const policySources = await this.ragPolicyService.select(dto.platforms || [], dto.topic);
            // 资料过期时如实告诉用户「合规规则资料需要人工复核」，而不是笼统的「未引用」。
            const freshness = policySources.length ? null : await this.ragPolicyService.freshnessReport?.().catch(() => null);
            const scriptPrompt = `请根据主题 "${dto.topic}" 和标题 "${titles[0]}" 创作一篇深度脚本。要求：逻辑清晰、使用普通人能理解的表达；如资料包含合规要求，在结尾增加发布前核对清单。${this.ragPolicyService.buildContext(policySources)}`;
            const scriptData = await this.aiService.generateText({ prompt: scriptPrompt });
            let script = scriptData?.content;
            if (typeof script !== 'string' || !script.trim()) {
                throw new Error('AI provider did not return usable body content');
            }
            const scriptTokens = scriptData?.usage?.total_tokens;
            if (!Number.isSafeInteger(scriptTokens) || scriptTokens <= 0) {
                throw new Error('AI provider did not return valid body token usage');
            }

            // 3. 明确违规才拦住。资料过期时仍生成，检查结果带上“可能有风险”。
            const conservative = Boolean(freshness?.needsReview);
            script = await this.complianceService.scrubOutput(script, { conservative });
            if (typeof script !== 'string' || !script.trim()) {
                throw new Error('Compliance processing returned empty body content');
            }
            const compliance = await this.complianceService.checkContent?.(script, { conservative });

            // 4. AI 生成内容显式标识（导出文本必须可辨识为 AI 生成）
            script = labelAiGeneratedText(script);

            const totalTokens = titleTokens + scriptTokens;
            if (!Number.isSafeInteger(totalTokens) || totalTokens <= 0) {
                throw new Error('AI provider did not return valid token usage');
            }
            const cost = [titleResult.cost_amount, scriptData.cost_amount].reduce<number>((sum, value) => sum + (Number(value) || 0), 0);
            const response = {
                success: true,
                data: {
                    titles,
                    script,
                    platform_variants: adaptForPlatforms(script, dto.platforms || [], dto.topic),
                    sources: policySources.map(source => ({ id: source.id, source_url: source.source_url, source_name: source.source_name, published_at: source.published_at, retrieved_at: source.retrieved_at, jurisdiction: source.jurisdiction, source_tier: source.source_tier })),
                    sources_status: policySources.length ? 'verified' : freshness?.needsReview ? 'review_required' : 'none',
                    sources_note: policySources.length
                        ? '以上资料已加入本次模型上下文；仍需发布者按最新平台页面人工复核'
                        : freshness?.needsReview
                            ? `${freshness.notice ?? '合规规则资料需要人工复核'}${String(freshness.notice ?? '').includes('生成仍然可用') ? '' : '。AI 生成仍然可用，发布前请自行确认。'}`
                            : '本次生成未引用有效的外部合规资料；仅供草稿使用，发布前请核对最新平台规则',
                    compliance: compliance ? {
                        level: compliance.level,
                        disclaimer: compliance.disclaimer,
                        mode: compliance.mode,
                        hits: compliance.hits,
                    } : undefined,
                    metadata: {
                        usage: { tokens: totalTokens },
                        platforms: dto.platforms,
                        ai_content: buildAiMediaMetadata({ mediaType: 'text' }),
                    }
                }
            };
            return {
                tokens: totalTokens,
                attachContentId: 'text' as const,
                response,
                generation: userId ? {
                    userId,
                    generationType: 'content_pack',
                    inputParams: { topic: dto.topic, platforms: dto.platforms },
                    outputContent: script,
                    modelProvider: scriptData.provider,
                    modelName: scriptData.model,
                    tokensInput: (titleResult.usage.prompt_tokens || 0) + (scriptData.usage.prompt_tokens || 0),
                    tokensOutput: (titleResult.usage.completion_tokens || 0) + (scriptData.usage.completion_tokens || 0),
                    costAmount: cost || undefined,
                    status: 'success',
                } : null,
            };
            });
        } catch (error) {
            if (error instanceof AiQuotaExceededError) {
                throw new HttpException({ message: error.message, error: 'AI_MONTHLY_QUOTA' }, HttpStatus.TOO_MANY_REQUESTS);
            }
            if (error instanceof AiRequestInProgressError) {
                throw new HttpException({ message: error.message, error: 'AI_REQUEST_IN_PROGRESS' }, HttpStatus.CONFLICT);
            }
            this.logger.error(`Failed to generate pack: ${error.message}`);
            // Keep actionable 4xx responses (especially compliance gate details)
            // intact. Only unexpected provider/runtime failures become a generic 500.
            if (error instanceof HttpException) {
                throw error;
            }
            throw new InternalServerErrorException('生成内容包失败');
        }
    }
}
