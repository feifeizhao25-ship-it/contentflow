import { Injectable, Logger, InternalServerErrorException, HttpException, HttpStatus } from '@nestjs/common';
import { AIService } from './ai.service';
import { UsageService, AiQuotaExceededError, AiRequestInProgressError } from '../system/usage.service';
import { AI_HOLD_TOKENS } from './ai-holds';
import { ComplianceService } from './compliance.service';
import { GenerateContentPackDto } from './dto/generate-content-pack.dto';
import { labelAiGeneratedText, buildAiMediaMetadata } from '../../common/ai-content-label';
import { RagPolicyService } from './rag-policy.service';
import { adaptForPlatforms } from './platform-adaptation';
import { isGlobalMarket, mt } from '../../common/i18n/market-text';
import { Optional } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { disclosureHint, resolveTargetMarket, targetMarketPromptLine } from '../../common/target-market';
import { buildPositioning } from './positioning';
import { GROUNDING_NOTICE_EN, GROUNDING_NOTICE_ZH, groundClaims, materialPromptBlock } from './grounding';

@Injectable()
export class ContentPackService {
    private readonly logger = new Logger(ContentPackService.name);

    constructor(
        private readonly aiService: AIService,
        private readonly usageService: UsageService,
        private readonly complianceService: ComplianceService,
        private readonly ragPolicyService: RagPolicyService,
        @Optional() private readonly prisma?: PrismaService,
    ) { }

    /** 账号定位：所选人设的配置文字 + 本租户自己得分最高的历史标题。读失败不影响生成，只是不个性化。 */
    private async loadPositioning(tenantId: string, personaId?: string) {
        let persona: { name: string; description: string | null; config: unknown } | null = null;
        let topTitles: Array<{ title: string | null; viral_score: number | null }> = [];
        try {
            if (this.prisma && personaId) {
                persona = await this.prisma.persona.findFirst({
                    where: { id: personaId, OR: [{ tenant_id: tenantId }, { is_system: true }] },
                    select: { name: true, description: true, config: true },
                });
            }
            if (this.prisma) {
                topTitles = await this.prisma.content.findMany({
                    where: { tenant_id: tenantId, viral_score: { not: null }, title: { not: null } },
                    orderBy: { viral_score: 'desc' },
                    take: 5,
                    select: { title: true, viral_score: true },
                });
            }
        } catch (error) {
            this.logger.warn(`positioning lookup failed: ${(error as Error).message}`);
        }
        return buildPositioning({ persona, topTitles }, isGlobalMarket());
    }

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
            const platformsStr = dto.platforms?.join(',') || mt('全渠道', 'all channels');
            const positioning = await this.loadPositioning(tenantId, dto.personaId);
            const titleResult = positioning.promptBlock
                ? await this.aiService.generateTitlesWithUsage(dto.topic, platformsStr, dto.count ?? 10, positioning.promptBlock)
                : await this.aiService.generateTitlesWithUsage(dto.topic, platformsStr, dto.count ?? 10);
            const targetMarket = isGlobalMarket() ? resolveTargetMarket(dto.targetMarket) : null;
            const materialBlock = materialPromptBlock(dto.material, isGlobalMarket());
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
            const scriptPrompt = isGlobalMarket()
                ? `Write an in-depth script on the topic "${dto.topic}" with the headline "${titles[0]}". Be logical and use plain language. If the sources below contain compliance requirements, add a pre-publication checklist at the end. Write in English only.${targetMarket ? ` ${targetMarketPromptLine(targetMarket)}` : ''}${this.ragPolicyService.buildContext(policySources)}${positioning.promptBlock}${materialBlock}`
                : `请根据主题 "${dto.topic}" 和标题 "${titles[0]}" 创作一篇深度脚本。要求：逻辑清晰、使用普通人能理解的表达；如资料包含合规要求，在结尾增加发布前核对清单。${this.ragPolicyService.buildContext(policySources)}${positioning.promptBlock}${materialBlock}`;
            const scriptData = await this.aiService.generateTextForMarket({ prompt: scriptPrompt, route: 'bulk', userText: `${dto.topic} ${titles[0]}` });
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
            const grounding = groundClaims(script, `${dto.topic} ${titles.join(' ')}`, dto.material);

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
                    sources_note: isGlobalMarket()
                        ? (policySources.length
                            ? 'The sources above were added to this generation as context. The publisher must still check them against the current platform pages.'
                            : 'This draft did not cite any verified external compliance source. Use it as a draft only and check the latest platform rules before publishing.')
                        : policySources.length
                        ? '以上资料已加入本次模型上下文；仍需发布者按最新平台页面人工复核'
                        : freshness?.needsReview
                            ? `${freshness.notice ?? '合规规则资料需要人工复核'}${String(freshness.notice ?? '').includes('生成仍然可用') ? '' : '。AI 生成仍然可用，发布前请自行确认。'}`
                            : '本次生成未引用有效的外部合规资料；仅供草稿使用，发布前请核对最新平台规则',
                    compliance: compliance ? {
                        level: compliance.level,
                        disclaimer: compliance.disclaimer,
                        mode: compliance.mode,
                        hits: compliance.hits,
                        hit_counts: (compliance as any).hitCounts,
                        rules_checked: (compliance as any).rulesChecked,
                        not_checked: (compliance as any).notChecked,
                    } : undefined,
                    positioning_used: { persona: positioning.used.persona, persona_name: positioning.used.personaName, top_titles: positioning.used.topTitles, reference_only: true },
                    grounding: {
                        material_supplied: grounding.materialSupplied,
                        supported_by_material: grounding.supportedByMaterial,
                        unverified: grounding.unverified,
                        notice: isGlobalMarket() ? GROUNDING_NOTICE_EN : GROUNDING_NOTICE_ZH,
                    },
                    ...(targetMarket ? { target_market: targetMarket, disclosure_hint: disclosureHint(targetMarket) } : {}),
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
