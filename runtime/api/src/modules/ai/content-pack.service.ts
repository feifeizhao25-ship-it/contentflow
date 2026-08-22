import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { AIService } from './ai.service';
import { UsageService, ResourceType } from '../system/usage.service';
import { ComplianceService } from './compliance.service';
import { GenerateContentPackDto } from './dto/generate-content-pack.dto';
import { labelAiGeneratedText, buildAiMediaMetadata } from '../../common/ai-content-label';

@Injectable()
export class ContentPackService {
    private readonly logger = new Logger(ContentPackService.name);

    constructor(
        private readonly aiService: AIService,
        private readonly usageService: UsageService,
        private readonly complianceService: ComplianceService,
    ) { }

    async generatePack(tenantId: string, dto: GenerateContentPackDto) {
        // 1. Quota Check
        const hasQuota = await this.usageService.checkQuota(tenantId, ResourceType.TOKENS);
        if (!hasQuota) {
            throw new Error('额度不足，请升级套餐');
        }

        this.logger.log(`Generating content pack for topic: ${dto.topic}`);

        try {
            // 2. Multi-step AI Pipeline
            // Step A: Headlines x 10
            const platformsStr = dto.platforms?.join(',') || '全渠道';
            const titleResult = await this.aiService.generateTitlesWithUsage(dto.topic, platformsStr, 10);
            const titles = titleResult.titles;

            // Step B: Script/Body
            const scriptPrompt = `请根据主题 "${dto.topic}" 和标题 "${titles[0]}" 创作一篇深度脚本。要求：逻辑清晰，金句频出。`;
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

            return {
                success: true,
                data: {
                    titles,
                    script,
                    // 来源区块：当前生成链路未接入 RAG/知识库检索，
                    // 明确标注「无来源」，绝不伪造引用。
                    sources: [],
                    sources_status: 'none',
                    sources_note: '本次生成未引用外部知识库或检索来源',
                    metadata: {
                        usage: { tokens: totalTokens },
                        platforms: dto.platforms,
                        ai_content: buildAiMediaMetadata({ mediaType: 'text' }),
                    }
                }
            };
        } catch (error) {
            this.logger.error(`Failed to generate pack: ${error.message}`);
            throw new InternalServerErrorException('生成内容包失败');
        }
    }
}
