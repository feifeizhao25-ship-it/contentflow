import { Injectable, Logger, InternalServerErrorException, HttpException, HttpStatus } from '@nestjs/common';
import { AIService } from './ai.service';
import { UsageService, ResourceType } from '../system/usage.service';
import { AI_MONTHLY_QUOTA_MESSAGE } from './ai-allowance.service';
import { ComplianceService } from './compliance.service';
import { GenerateContentPackDto } from './dto/generate-content-pack.dto';
import { labelAiGeneratedText, buildAiMediaMetadata } from '../../common/ai-content-label';
import { RagPolicyService } from './rag-policy.service';

@Injectable()
export class ContentPackService {
    private readonly logger = new Logger(ContentPackService.name);

    constructor(
        private readonly aiService: AIService,
        private readonly usageService: UsageService,
        private readonly complianceService: ComplianceService,
        private readonly ragPolicyService: RagPolicyService,
    ) { }

    async generatePack(tenantId: string, dto: GenerateContentPackDto, userId?: string) {
        // 1. 额度闸：与其它 AI 生成接口一致——先查每日成本预算，再查套餐月度 AI 令牌额度。
        //    原来只查月度额度，且额度不足抛的是普通 Error（被全局过滤器换成「服务暂时出错」）。
        await this.aiService.assertTenantDailyBudget(tenantId);
        const hasQuota = await this.usageService.checkQuota(tenantId, ResourceType.TOKENS);
        if (!hasQuota) {
            throw new HttpException({ message: AI_MONTHLY_QUOTA_MESSAGE, error: 'AI_MONTHLY_QUOTA' }, HttpStatus.TOO_MANY_REQUESTS);
        }

        this.logger.log(`Generating content pack for topic: ${dto.topic}`);

        try {
            // 2. Multi-step AI Pipeline
            // Step A: Headlines x 10
            const platformsStr = dto.platforms?.join(',') || '全渠道';
            const titleResult = await this.aiService.generateTitlesWithUsage(dto.topic, platformsStr, 10);
            const titles = titleResult.titles;

            // Step B: Script/Body
            const policySources = await this.ragPolicyService.select(dto.platforms || [], dto.topic);
            // 资料过期时如实告诉用户「合规规则资料需要人工复核」，而不是笼统的「未引用」。
            const freshness = policySources.length ? null : await this.ragPolicyService.freshnessReport?.().catch(() => null);
            const scriptPrompt = `请根据主题 "${dto.topic}" 和标题 "${titles[0]}" 创作一篇深度脚本。要求：逻辑清晰、使用普通人能理解的表达；如资料包含合规要求，在结尾增加发布前核对清单。${this.ragPolicyService.buildContext(policySources)}`;
            const scriptData = await this.aiService.generateText({ prompt: scriptPrompt });
            let script = scriptData.content;

            // 3. Compliance Scrubbing
            script = await this.complianceService.scrubOutput(script);

            // 4. AI 生成内容显式标识（导出文本必须可辨识为 AI 生成）
            script = labelAiGeneratedText(script);

            // 5. Usage Tracking
            const totalTokens =
                titleResult.usage.total_tokens + scriptData.usage.total_tokens;
            if (!Number.isSafeInteger(totalTokens) || totalTokens <= 0) {
                throw new Error('AI provider did not return valid token usage');
            }
            await this.usageService.trackUsage(tenantId, ResourceType.TOKENS, totalTokens, {
                topic: dto.topic,
                type: 'content_pack'
            });
            // 计入每日成本预算：原来内容包从不写生成记录，日预算统计里看不到这部分花费。
            let generationId: string | undefined;
            if (userId) {
                const cost = [titleResult.cost_usd, scriptData.cost_usd].reduce<number>((sum, value) => sum + (Number(value) || 0), 0);
                const record: any = await this.aiService.recordGeneration(tenantId, userId, {
                    generationType: 'content_pack',
                    inputParams: { topic: dto.topic, platforms: dto.platforms },
                    outputContent: script,
                    modelProvider: scriptData.provider,
                    modelName: scriptData.model,
                    tokensInput: (titleResult.usage.prompt_tokens || 0) + (scriptData.usage.prompt_tokens || 0),
                    tokensOutput: (titleResult.usage.completion_tokens || 0) + (scriptData.usage.completion_tokens || 0),
                    costAmount: cost || undefined,
                    status: 'success',
                });
                generationId = record?.id;
            }

            return {
                success: true,
                data: {
                    titles,
                    script,
                    sources: policySources.map(source => ({ id: source.id, source_url: source.source_url, source_name: source.source_name, published_at: source.published_at, retrieved_at: source.retrieved_at, jurisdiction: source.jurisdiction, source_tier: source.source_tier })),
                    sources_status: policySources.length ? 'verified' : freshness?.needsReview ? 'review_required' : 'none',
                    sources_note: policySources.length
                        ? '以上资料已加入本次模型上下文；仍需发布者按最新平台页面人工复核'
                        : freshness?.needsReview
                            ? (freshness.notice ?? '合规规则资料需要人工复核')
                            : '本次生成未引用有效的外部合规资料；仅供草稿使用，发布前请核对最新平台规则',
                    metadata: {
                        usage: { tokens: totalTokens },
                        platforms: dto.platforms,
                        ai_content: buildAiMediaMetadata({ mediaType: 'text', contentId: generationId }),
                    }
                }
            };
        } catch (error) {
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
