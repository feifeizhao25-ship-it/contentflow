import { MATERIAL_MAX_CHARS } from './grounding';
import { BadRequestException, Controller, Post, Get, Body, UseGuards, UseInterceptors, Request, Headers } from '@nestjs/common';
import { AiConcurrencyInterceptor } from './ai-concurrency.interceptor';
import { aiTextLabel, labelAiGeneratedText } from '../../common/ai-content-label';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AIService } from './ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AiAllowanceService } from './ai-allowance.service';
import { AI_HOLD_TOKENS } from './ai-holds';
import { normalizeIdempotencyKey } from '../system/usage.service';

@ApiTags('ai')
@UseInterceptors(AiConcurrencyInterceptor)
@Controller('ai')
export class AIController {
  constructor(
    private readonly aiService: AIService,
    private readonly allowance: AiAllowanceService,
  ) {}

  @Get('usage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取今日 AI 成本预算与预警' })
  async getUsage(@Request() req: any) {
    return this.aiService.getTenantDailyBudgetUsage(req.user.tenantId);
  }

  @Post('generate/article')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AI文章生成' })
  async generateArticle(@Request() req: any, @Body() body: any, @Headers('idempotency-key') idempotencyKey?: string) {
    const { topic, style, platform, keywords } = body;
    const material = typeof body?.material === 'string' ? body.material.slice(0, MATERIAL_MAX_CHARS) : undefined;
    return this.allowance.withReservation({
      tenantId: req.user.tenantId,
      kind: 'article',
      holdTokens: AI_HOLD_TOKENS.article,
      idempotencyKey: normalizeIdempotencyKey(idempotencyKey),
      run: async () => {
        const result = await this.aiService.generateArticle({
          topic,
          style: style || 'professional',
          platform: platform || 'xhs',
          keywords,
          material,
        });
        // 显式标识（《人工智能生成合成内容标识办法》）：正文本身带「AI 生成」，
        // 复制、保存、分发时不会丢；留存的生成记录里也是带标识的版本。
        const labelled = labelAiGeneratedText(result.content);
        return {
          tokens: result.usage.total_tokens,
          response: { ...result, content: labelled, aiGenerated: true, aiLabel: aiTextLabel() },
          generation: {
            userId: req.user.sub,
            generationType: 'article',
            inputParams: { topic, style, platform, keywords },
            outputContent: labelled,
            modelProvider: result.provider,
            modelName: result.model,
            tokensInput: result.usage.prompt_tokens,
            tokensOutput: result.usage.completion_tokens,
            costAmount: result.cost_amount ?? undefined,
            durationMs: result.latency_ms,
            status: 'success',
          },
        };
      },
    });
  }

  @Post('generate/script')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '短视频分镜脚本生成' })
  async generateScript(@Request() req: any, @Body() body: any, @Headers('idempotency-key') idempotencyKey?: string) {
    const topic = String(body?.topic ?? '').trim().slice(0, 200);
    if (!topic) throw new BadRequestException('请输入创作主题');
    const type = String(body?.type ?? '爆款解说').slice(0, 50);
    const platform = String(body?.platform ?? '抖音').slice(0, 20);
    return this.allowance.withReservation({
      tenantId: req.user.tenantId,
      kind: 'script',
      holdTokens: AI_HOLD_TOKENS.script,
      idempotencyKey: normalizeIdempotencyKey(idempotencyKey),
      run: async () => {
        const result = await this.aiService.generateScript({ topic, type, platform });
        return {
          tokens: result.usage.total_tokens,
          response: { title: result.title, scenes: result.scenes, aiLabel: aiTextLabel() },
          generation: {
            userId: req.user.sub,
            generationType: 'script',
            inputParams: { topic, type, platform },
            outputContent: JSON.stringify({ title: result.title, scenes: result.scenes }),
            modelProvider: result.provider,
            modelName: result.model,
            tokensInput: result.usage.prompt_tokens,
            tokensOutput: result.usage.completion_tokens,
            costAmount: result.cost_amount ?? undefined,
            durationMs: result.latency_ms,
            status: 'success',
          },
        };
      },
    });
  }

  @Post('generate/titles')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AI标题生成' })
  async generateTitles(@Request() req: any, @Body() body: any, @Headers('idempotency-key') idempotencyKey?: string) {
    const { topic, platform, count } = body;
    return this.allowance.withReservation({
      tenantId: req.user.tenantId,
      kind: 'titles',
      holdTokens: AI_HOLD_TOKENS.titles,
      idempotencyKey: normalizeIdempotencyKey(idempotencyKey),
      run: async () => {
        const result = await this.aiService.generateTitlesWithUsage(topic, platform || 'xhs', count || 5);
        return {
          tokens: result.usage.total_tokens,
          response: { titles: result.titles },
          generation: {
            userId: req.user.sub,
            generationType: 'titles',
            inputParams: { topic, platform, count },
            outputContent: JSON.stringify(result.titles),
            tokensInput: result.usage.prompt_tokens,
            tokensOutput: result.usage.completion_tokens,
            modelProvider: result.provider,
            modelName: result.model,
            costAmount: result.cost_amount ?? undefined,
            durationMs: result.latency_ms,
            status: 'success',
          },
        };
      },
    });
  }

  @Post('analyze/viral')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '爆款内容分析' })
  async analyzeViral(@Request() req: any, @Body() body: any, @Headers('idempotency-key') idempotencyKey?: string) {
    const { content } = body;
    return this.allowance.withReservation({
      tenantId: req.user.tenantId,
      kind: 'viral',
      holdTokens: AI_HOLD_TOKENS.viral,
      idempotencyKey: normalizeIdempotencyKey(idempotencyKey),
      run: async () => {
        const result = await this.aiService.analyzeViralContentWithUsage(content);
        return {
          tokens: result.usage.total_tokens,
          response: { analysis: result.analysis },
          generation: {
            userId: req.user.sub,
            generationType: 'viral_analysis',
            inputParams: { content },
            outputContent: JSON.stringify(result.analysis),
            modelProvider: result.provider,
            modelName: result.model,
            tokensInput: result.usage.prompt_tokens,
            tokensOutput: result.usage.completion_tokens,
            costAmount: result.cost_amount ?? undefined,
            durationMs: result.latency_ms,
            status: 'success',
          },
        };
      },
    });
  }

  @Post('generate/image')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AI图片生成' })
  async generateImage(@Request() req: any, @Body() body: any, @Headers('idempotency-key') idempotencyKey?: string) {
    const { prompt, size, style, seed } = body;
    return this.allowance.withReservation({
      tenantId: req.user.tenantId,
      kind: 'image',
      holdTokens: AI_HOLD_TOKENS.image,
      idempotencyKey: normalizeIdempotencyKey(idempotencyKey),
      run: async () => {
        const result = await this.aiService.generateImage({ prompt, size, style, seed });
        return {
          tokens: AI_HOLD_TOKENS.image,
          images: 1,
          attachContentId: 'image' as const,
          response: { ...result, aiGenerated: true, aiLabel: aiTextLabel() },
          generation: {
            userId: req.user.sub,
            generationType: 'image',
            inputParams: { prompt, size, style, seed },
            outputContent: result.url,
            modelProvider: result.provider,
            modelName: result.model,
            costAmount: result.cost_amount ?? undefined,
            status: 'success',
          },
        };
      },
    });
  }
}
