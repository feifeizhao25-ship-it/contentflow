import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

interface AIResponse {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly openRouterKey: string;
  private readonly siliconFlowKey: string;
  private readonly falApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.openRouterKey = this.configService.get('OPENROUTER_API_KEY', '');
    this.siliconFlowKey = this.configService.get('SILICONFLOW_API_KEY', '');
    this.falApiKey = this.configService.get('FAL_API_KEY', '');
  }

  async generateText(params: {
    prompt: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    systemMessage?: string;
  }): Promise<AIResponse> {
    const model = params.model || 'Qwen/Qwen2.5-7B-Instruct'; // SiliconFlow 上的主力模型

    let baseUrl = '';
    let apiKey = '';

    // 智能选择提供商 - 优先使用 SiliconFlow
    if (this.siliconFlowKey) {
      baseUrl = 'https://api.siliconflow.cn/v1';
      apiKey = this.siliconFlowKey;
    } else if (this.openRouterKey) {
      baseUrl = 'https://openrouter.ai/api/v1';
      apiKey = this.openRouterKey;
    } else {
      throw new Error('未配置 AI API Key (OPENROUTER or SILICONFLOW)');
    }

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://fenfaxia.ai', // For OpenRouter
          'X-Title': 'Fenfaxia',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            ...(params.systemMessage ? [{ role: 'system', content: params.systemMessage }] : []),
            { role: 'user', content: params.prompt }
          ],
          max_tokens: params.maxTokens || 2000,
          temperature: params.temperature || 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`AI API error: ${error}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '';

      const usage = {
        prompt_tokens: data.usage?.prompt_tokens || 0,
        completion_tokens: data.usage?.completion_tokens || 0,
        total_tokens: data.usage?.total_tokens || 0,
      };

      return { content, usage };
    } catch (error) {
      this.logger.error('AI generation failed:', error);
      throw error;
    }
  }

  async generateArticle(params: {
    topic: string;
    style: string;
    platform: string;
    keywords?: string[];
    personaContext?: string;
  }): Promise<{ content: string; visualPrompts?: string[] }> {
    const platformPrompts: Record<string, string> = {
      xhs: `请为小红书创作一篇爆款笔记，主题：${params.topic}，要求符合${params.style}风格。`,
      douyin: `请为抖音创作一个短视频脚本，主题：${params.topic}，要求符合${params.style}风格。`,
      wechat: `请为微信公众号创作一篇深度文章，主题：${params.topic}，要求符合${params.style}风格。`,
    };

    const basePrompt = platformPrompts[params.platform] || `请创作一篇关于${params.topic}的内容，风格核心为${params.style}`;

    const result = await this.generateText({
      prompt: `主题：${params.topic}\n关键词：${params.keywords?.join('、') || '无'}\n\n指令：${basePrompt}\n\n要求：\n1. 开头要有吸引力，能抓住读者注意力\n2. 内容要有价值、有趣或能引起共鸣\n3. 结尾要有互动或引导行为\n\n请在回答最后输出用于生图的英文提示词，格式为 VISUAL_PROMPTS: [提示词]`,
      systemMessage: params.personaContext ? `你的人设和风格设定如下，请严格遵守：${params.personaContext}` : '你是一个全能的爆款内容创作者。',
      maxTokens: 3000,
    });

    const contentParts = result.content.split(/VISUAL_PROMPTS:/i);
    const content = contentParts[0].trim();
    const visualPrompts = contentParts[1] ? contentParts[1].split('\n').filter(s => s.trim()).slice(0, 3) : [];

    return { content, visualPrompts };
  }

  async analyzeViralContent(content: string): Promise<any> {
    const result = await this.generateText({
      prompt: `分析以下内容的爆款要素：\n\n${content}\n\n请从以下维度分析（JSON格式）：\n1. hook_analysis (开头钩子)\n2. emotional_triggers (情绪触发点)\n3. optimization_suggestions (修正建议)`,
      maxTokens: 1500,
    });

    try {
      return JSON.parse(result.content);
    } catch {
      return { raw_analysis: result.content };
    }
  }

  async generateTitles(topic: string, platform: string, count: number = 5): Promise<string[]> {
    const result = await this.generateText({
      prompt: `请为"${topic}"在${platform}平台生成${count}个吸引人的标题，每个标题20字以内，用换行分隔`,
      maxTokens: 500,
    });
    return result.content.split('\n').map(t => t.replace(/^\d+\.\s*/, '').trim()).filter(t => t.length > 0).slice(0, count);
  }

  async recordGeneration(tenantId: string, userId: string, data: any) {
    try {
      return await this.prisma.aIGeneration.create({
        data: {
          tenant_id: tenantId,
          user_id: userId,
          generation_type: data.generationType,
          input_params: data.inputParams,
          output_content: data.outputContent,
          status: data.status,
          completed_at: new Date(),
        },
      });
    } catch (e) {
      this.logger.warn(`Failed to record generation: ${e.message}`);
      return { id: 'mock-gen-id', ...data };
    }
  }

  async generateImage(params: { prompt: string; size?: string; style?: string }) {
    if (!this.falApiKey) throw new Error('FAL_API_KEY not configured');
    const enhancedPrompt = `${params.prompt}, high resolution, 8k, masterpiece, ${params.style || 'digital art'}`;

    try {
      const res = await fetch('https://fal.run/fal-ai/nano-banana-pro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${this.falApiKey}` },
        body: JSON.stringify({ prompt: enhancedPrompt })
      });
      const data = await res.json();
      return { url: data.images?.[0]?.url || data.image?.url };
    } catch (e) {
      this.logger.error('Image Gen Failed', e);
      throw e;
    }
  }
}
