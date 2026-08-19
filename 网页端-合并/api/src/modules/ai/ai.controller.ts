import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AIService } from './ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('ai')
@Controller('ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @Post('generate/article')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AI文章生成' })
  async generateArticle(@Request() req: any, @Body() body: any) {
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
      status: 'success',
    });

    return result;
  }

  @Post('generate/titles')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AI标题生成' })
  async generateTitles(@Request() req: any, @Body() body: any) {
    const { topic, platform, count } = body;
    const titles = await this.aiService.generateTitles(topic, platform || 'xhs', count || 5);
    
    return { titles };
  }

  @Post('analyze/viral')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '爆款内容分析' })
  async analyzeViral(@Request() req: any, @Body() body: any) {
    const { content } = body;
    const analysis = await this.aiService.analyzeViralContent(content);
    return { analysis };
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
