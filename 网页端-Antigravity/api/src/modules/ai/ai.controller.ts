import { Controller, Post, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AIService } from './ai.service';
import { PointsService } from '../points/points.service';
import { PersonaService } from '../persona/persona.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('ai')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AIController {
  constructor(
    private readonly aiService: AIService,
    private readonly pointsService: PointsService,
    private readonly personaService: PersonaService,
  ) { }

  @Post('generate/article')
  @ApiOperation({ summary: 'AI文章/脚本生成' })
  async generateArticle(@Request() req: any, @Body() body: any) {
    const { topic, style, platform, keywords, personaId } = body;
    const userId = req.user.sub;
    const tenantId = req.user.tenantId;

    // 1. 获取人设上下文
    let personaContext = '';
    /* DEMO BYPASS: skip persona check
    if (personaId) {
      const persona = await this.personaService.findOne(tenantId, personaId);
      if (persona) {
        const writingExamples = Array.isArray(persona.writing_examples)
          ? persona.writing_examples.filter((item): item is string => typeof item === 'string')
          : [];
        const examplesText = writingExamples.length > 0 ? `, 范例: ${writingExamples.join('; ')}` : '';
        personaContext = `名称: ${persona.name}, 语气: ${persona.tone_of_voice}, 定位: ${persona.description}${examplesText}`;
      }
    }
    */

    // DEMO BYPASS: skip points check
    // await this.pointsService.spendPoints(userId, 5, 'ai_generation', `AI 内容生成: ${topic}`);

    // 3. 调用 AI 引擎
    const result = await this.aiService.generateArticle({
      topic,
      style: style || 'professional',
      platform: platform || 'xhs',
      keywords,
      personaContext,
    });

    // 4. 异步记录记录使用
    this.aiService.recordGeneration(tenantId, userId, {
      generationType: 'article',
      inputParams: { topic, style, platform, keywords, personaId },
      outputContent: result.content,
      status: 'success',
    });

    return result;
  }

  @Post('generate/titles')
  @ApiOperation({ summary: 'AI标题生成' })
  async generateTitles(@Request() req: any, @Body() body: any) {
    const { topic, platform, count } = body;
    // DEMO BYPASS: skip points check
    // await this.pointsService.spendPoints(req.user.sub, 1, 'ai_generation', `AI 标题生成: ${topic}`);

    const titles = await this.aiService.generateTitles(topic, platform || 'xhs', count || 5);
    return { titles };
  }

  @Post('analyze/viral')
  @ApiOperation({ summary: '爆款内容分析' })
  async analyzeViral(@Request() req: any, @Body() body: any) {
    const { content } = body;
    // DEMO BYPASS: skip points check
    // await this.pointsService.spendPoints(req.user.sub, 2, 'ai_analysis', '爆款内容拆解');

    const analysis = await this.aiService.analyzeViralContent(content);
    return { analysis };
  }

  @Post('generate/image')
  @ApiOperation({ summary: 'AI图片生成' })
  async generateImage(@Request() req: any, @Body() body: any) {
    const { prompt, size, style, seed } = body;

    // DEMO BYPASS: skip points check
    // await this.pointsService.spendPoints(req.user.sub, 10, 'ai_image_generation', `AI 配图生成: ${prompt}`);

    const result = await this.aiService.generateImage({ prompt, size, style });

    this.aiService.recordGeneration(req.user.tenantId, req.user.sub, {
      generationType: 'image',
      inputParams: { prompt, size, style, seed },
      outputContent: result.url,
      status: 'success',
    });

    return result;
  }
}
