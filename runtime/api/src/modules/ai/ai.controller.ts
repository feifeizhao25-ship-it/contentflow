import { BadRequestException, Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AI_TEXT_LABEL, buildAiMediaMetadata, labelAiGeneratedText } from '../../common/ai-content-label';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AIService } from './ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AiAllowanceService } from './ai-allowance.service';

@ApiTags('ai')
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
  async generateArticle(@Request() req: any, @Body() body: any) {
    await this.allowance.assertAllowed(req.user.tenantId);
    const { topic, style, platform, keywords } = body;
    
    const result = await this.aiService.generateArticle({
      topic,
      style: style || 'professional',
      platform: platform || 'xhs',
      keywords,
    });

    // 显式标识（《人工智能生成合成内容标识办法》）：正文本身带「AI 生成」，
    // 复制、保存、分发时不会丢；留存的生成记录里也是带标识的版本。
    const labelled = labelAiGeneratedText(result.content);

    // 记录使用
    await this.aiService.recordGeneration(req.user.tenantId, req.user.sub, {
      generationType: 'article',
      inputParams: { topic, style, platform, keywords },
      outputContent: labelled,
      modelProvider: result.provider,
      modelName: result.model,
      tokensInput: result.usage.prompt_tokens,
      tokensOutput: result.usage.completion_tokens,
      costAmount: result.cost_usd ?? undefined,
      durationMs: result.latency_ms,
      status: 'success',
    });
    await this.allowance.chargeTokens(req.user.tenantId, result.usage.total_tokens, 'article');

    return { ...result, content: labelled, aiGenerated: true, aiLabel: AI_TEXT_LABEL };
  }

  @Post('generate/script')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '短视频分镜脚本生成' })
  async generateScript(@Request() req: any, @Body() body: any) {
    await this.allowance.assertAllowed(req.user.tenantId);
    const topic = String(body?.topic ?? '').trim().slice(0, 200);
    if (!topic) throw new BadRequestException('请输入创作主题');
    const type = String(body?.type ?? '爆款解说').slice(0, 50);
    const platform = String(body?.platform ?? '抖音').slice(0, 20);
    const result = await this.aiService.generateScript({ topic, type, platform });
    await this.aiService.recordGeneration(req.user.tenantId, req.user.sub, {
      generationType: 'script',
      inputParams: { topic, type, platform },
      outputContent: JSON.stringify({ title: result.title, scenes: result.scenes }),
      modelProvider: result.provider,
      modelName: result.model,
      tokensInput: result.usage.prompt_tokens,
      tokensOutput: result.usage.completion_tokens,
      costAmount: result.cost_usd ?? undefined,
      durationMs: result.latency_ms,
      status: 'success',
    });
    await this.allowance.chargeTokens(req.user.tenantId, result.usage.total_tokens, 'script');
    // 显式标识（《人工智能生成合成内容标识办法》）：随结果返回，前端展示与导出时附上。
    return { title: result.title, scenes: result.scenes, aiLabel: AI_TEXT_LABEL };
  }

  @Post('generate/titles')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AI标题生成' })
  async generateTitles(@Request() req: any, @Body() body: any) {
    await this.allowance.assertAllowed(req.user.tenantId);
    const { topic, platform, count } = body;
    const result = await this.aiService.generateTitlesWithUsage(topic, platform || 'xhs', count || 5);
    await this.aiService.recordGeneration(req.user.tenantId, req.user.sub, {
      generationType: 'titles', inputParams: { topic, platform, count },
      outputContent: JSON.stringify(result.titles), tokensInput: result.usage.prompt_tokens,
      tokensOutput: result.usage.completion_tokens, modelProvider: result.provider,
      modelName: result.model, costAmount: result.cost_usd ?? undefined,
      durationMs: result.latency_ms, status: 'success',
    });
    await this.allowance.chargeTokens(req.user.tenantId, result.usage.total_tokens, 'titles');

    return { titles: result.titles };
  }

  @Post('analyze/viral')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '爆款内容分析' })
  async analyzeViral(@Request() req: any, @Body() body: any) {
    await this.allowance.assertAllowed(req.user.tenantId);
    const { content } = body;
    const result = await this.aiService.analyzeViralContentWithUsage(content);
    await this.aiService.recordGeneration(req.user.tenantId, req.user.sub, {
      generationType: 'viral_analysis', inputParams: { content }, outputContent: JSON.stringify(result.analysis),
      modelProvider: result.provider, modelName: result.model, tokensInput: result.usage.prompt_tokens,
      tokensOutput: result.usage.completion_tokens, costAmount: result.cost_usd ?? undefined,
      durationMs: result.latency_ms, status: 'success',
    });
    await this.allowance.chargeTokens(req.user.tenantId, result.usage.total_tokens, 'viral_analysis');
    return { analysis: result.analysis };
  }

  @Post('generate/image')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AI图片生成' })
  async generateImage(@Request() req: any, @Body() body: any) {
    await this.allowance.assertAllowed(req.user.tenantId);
    const { prompt, size, style, seed } = body;

    const result = await this.aiService.generateImage({
      prompt,
      size,
      style,
      seed,
    });

    // 记录使用
    await this.aiService.recordGeneration(req.user.tenantId, req.user.sub, {
      generationType: 'image',
      inputParams: { prompt, size, style, seed },
      outputContent: result.url,
      modelProvider: result.provider,
      modelName: result.model,
      costAmount: result.cost_usd ?? undefined,
      status: 'success',
    });
    await this.allowance.chargeImage(req.user.tenantId);

    // 显式标识 + 隐式标识元数据随结果返回：前端展示「AI 生成」，导出图片时写入文件元数据。
    return {
      ...result,
      aiGenerated: true,
      aiLabel: AI_TEXT_LABEL,
      aiMetadata: buildAiMediaMetadata({ mediaType: 'image', model: result.model }),
    };
  }
}
