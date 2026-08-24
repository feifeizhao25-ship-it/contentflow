import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AIService } from './ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('ai')
@Controller('ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

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
    await this.aiService.assertTenantDailyBudget(req.user.tenantId);
    const { topic, style, platform, keywords } = body;
    
    const result = await this.aiService.generateArticle({
      topic,
      style: style || 'professional',
      platform: platform || 'xhs',
      keywords,
    });

    // 记录使用
    await this.aiService.recordGeneration(req.user.tenantId, req.user.sub, {
      generationType: 'article',
      inputParams: { topic, style, platform, keywords },
      outputContent: result.content,
      modelProvider: result.provider,
      modelName: result.model,
      tokensInput: result.usage.prompt_tokens,
      tokensOutput: result.usage.completion_tokens,
      costAmount: result.cost_usd ?? undefined,
      durationMs: result.latency_ms,
      status: 'success',
    });

    return result;
  }

  @Post('generate/titles')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AI标题生成' })
  async generateTitles(@Request() req: any, @Body() body: any) {
    await this.aiService.assertTenantDailyBudget(req.user.tenantId);
    const { topic, platform, count } = body;
    const result = await this.aiService.generateTitlesWithUsage(topic, platform || 'xhs', count || 5);
    await this.aiService.recordGeneration(req.user.tenantId, req.user.sub, {
      generationType: 'titles', inputParams: { topic, platform, count },
      outputContent: JSON.stringify(result.titles), tokensInput: result.usage.prompt_tokens,
      tokensOutput: result.usage.completion_tokens, modelProvider: result.provider,
      modelName: result.model, costAmount: result.cost_usd ?? undefined,
      durationMs: result.latency_ms, status: 'success',
    });
    
    return { titles: result.titles };
  }

  @Post('analyze/viral')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '爆款内容分析' })
  async analyzeViral(@Request() req: any, @Body() body: any) {
    await this.aiService.assertTenantDailyBudget(req.user.tenantId);
    const { content } = body;
    const result = await this.aiService.analyzeViralContentWithUsage(content);
    await this.aiService.recordGeneration(req.user.tenantId, req.user.sub, {
      generationType: 'viral_analysis', inputParams: { content }, outputContent: JSON.stringify(result.analysis),
      modelProvider: result.provider, modelName: result.model, tokensInput: result.usage.prompt_tokens,
      tokensOutput: result.usage.completion_tokens, costAmount: result.cost_usd ?? undefined,
      durationMs: result.latency_ms, status: 'success',
    });
    return { analysis: result.analysis };
  }

  @Post('generate/image')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AI图片生成 (nano-banana-pro)' })
  async generateImage(@Request() req: any, @Body() body: any) {
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
      modelProvider: 'fal.ai',
      modelName: 'nano-banana-pro',
      status: 'success',
    });

    return result;
  }
}
