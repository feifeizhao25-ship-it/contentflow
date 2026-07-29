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
  private readonly qwenApiKey: string;
  private readonly deepseekApiKey: string;
  private readonly openrouterApiKey: string;
  private readonly falApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.qwenApiKey = this.configService.get('QWEN_API_KEY', '');
    this.deepseekApiKey = this.configService.get('DEEPSEEK_API_KEY', '');
    this.openrouterApiKey = this.configService.get('OPENROUTER_API_KEY', '');
    this.falApiKey = this.configService.get('FAL_API_KEY', '');
  }

  async generateText(params: {
    prompt: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<AIResponse> {
    const configuredModels = this.configService
      .get('OPENROUTER_MODELS', 'x-ai/grok-4.5')
      .split(',')
      .map((value: string) => value.trim())
      .filter(Boolean);
    const model = params.model || configuredModels[0] || 'x-ai/grok-4.5';
    const useOpenRouter = model.includes('/') || configuredModels.includes(model);
    const provider = useOpenRouter
      ? 'openrouter'
      : model.includes('deepseek') ? 'deepseek' : 'qwen';
    const apiKey = provider === 'openrouter'
      ? this.openrouterApiKey
      : provider === 'deepseek' ? this.deepseekApiKey : this.qwenApiKey;
    if (!apiKey) {
      throw new Error(`${provider.toUpperCase()} API key not configured`);
    }

    const baseUrl = provider === 'openrouter'
      ? this.configService.get('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1')
      : provider === 'deepseek'
        ? 'https://api.deepseek.com/v1'
        : 'https://dashscope.aliyuncs.com/api/v1';
    const openRouterHeaders = provider === 'openrouter' ? {
      'HTTP-Referer': this.configService.get(
        'OPENROUTER_SITE_URL',
        'https://contentflow.invalid',
      ),
      'X-Title': 'ContentFlow',
    } : {};
    const openRouterRouting = provider === 'openrouter' ? {
      models: configuredModels,
      provider: {
        data_collection: 'deny',
        zdr: true,
        allow_fallbacks: configuredModels.length > 1,
      },
    } : {};

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          ...openRouterHeaders,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'user', content: params.prompt }
          ],
          max_tokens: params.maxTokens || 2000,
          temperature: params.temperature || 0.7,
          ...openRouterRouting,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`AI API error: ${error}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '';

      // 记录使用量
      const usage = {
        prompt_tokens: data.usage?.prompt_tokens || 0,
        completion_tokens: data.usage?.completion_tokens || 0,
        total_tokens: data.usage?.total_tokens || 0,
      };

      this.logger.log(`AI generation completed: ${usage.total_tokens} tokens`);

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
  }): Promise<{ content: string; visualPrompts?: string[] }> {
    // 根据平台构建不同的提示词
    const platformPrompts: Record<string, string> = {
      xhs: `请为小红书创作一篇爆款笔记，主题：${params.topic}，风格：${params.style}`,
      douyin: `请为抖音创作一个短视频脚本，主题：${params.topic}，风格：${params.style}`,
      wechat: `请为微信公众号创作一篇深度文章，主题：${params.topic}，风格：${params.style}`,
      zhihu: `请为知乎创作一篇专业回答/文章，主题：${params.topic}，风格：${params.style}`,
    };

    const basePrompt = platformPrompts[params.platform] || 
      `请创作一篇关于${params.topic}的内容，风格：${params.style}`;

    const result = await this.generateText({
      prompt: `${basePrompt}
关键词：${params.keywords?.join('、') || params.topic}

要求：
1. 开头要有吸引力
2. 内容要有价值
3. 结尾要有引导

请在回答最后输出3个用于AI生图的英文提示词（Visual Prompts），每个占一行，用---分隔`,
      maxTokens: 3000,
    });

    // 解析视觉提示词
    const visualPrompts: string[] = [];
    const lines = result.content.split('\n');
    let capturing = false;
    
    for (const line of lines) {
      if (line.includes('VISUAL_PROMPTS') || line.includes('---')) {
        capturing = true;
        continue;
      }
      if (capturing && line.trim() && !line.includes('http')) {
        visualPrompts.push(line.trim());
      }
    }

    return {
      content: result.content.split(/---?\s*VISUAL_PROMPTS/)[0].trim(),
      visualPrompts: visualPrompts.slice(0, 3),
    };
  }

  async analyzeViralContent(content: string): Promise<any> {
    const result = await this.generateText({
      prompt: `分析以下内容的爆款要素：

${content}

请从以下维度分析（JSON格式）：
1. 标题吸引力评分和技巧
2. 开头钩子分析
3. 内容结构特点
4. 情绪触发点
5. 可复制的模板`,
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

    return result.content
      .split('\n')
      .map(t => t.replace(/^\d+\.\s*/, '').trim())
      .filter(t => t.length > 0)
      .slice(0, count);
  }

  // 记录AI生成历史
  async recordGeneration(tenantId: string, userId: string, data: {
    generationType: string;
    inputParams: any;
    outputContent?: string;
    modelProvider?: string;
    modelName?: string;
    tokensInput?: number;
    tokensOutput?: number;
    costAmount?: number;
    status: string;
  }) {
    return this.prisma.aIGeneration.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        generation_type: data.generationType,
        input_params: data.inputParams,
        model_provider: data.modelProvider,
        model_name: data.modelName,
        output_content: data.outputContent,
        tokens_input: data.tokensInput,
        tokens_output: data.tokensOutput,
        cost_amount: data.costAmount,
        status: data.status,
        completed_at: data.status === 'success' ? new Date() : undefined,
      },
    });
  }

  // ========== FAL.AI 图片生成 (nano-banana-pro) ==========
  
  async generateImage(params: {
    prompt: string;
    size?: string;
    style?: string;
    seed?: number;
  }): Promise<{ url: string; revisedPrompt?: string }> {
    if (!this.falApiKey) {
      throw new Error('FAL_API_KEY not configured');
    }

    // 解析尺寸
    const sizeMap: Record<string, { width: number; height: number }> = {
      '256x256': { width: 256, height: 256 },
      '512x512': { width: 512, height: 512 },
      '1024x1024': { width: 1024, height: 1024 },
      '1280x720': { width: 1280, height: 720 },
      '720x1280': { width: 720, height: 1280 },
    };
    const { width, height } = sizeMap[params.size || '1024x1024'] || { width: 1024, height: 1024 };

    // 增强提示词
    const styleEnhancements: Record<string, string> = {
      professional: 'Professional, clean, minimal, high quality, commercial photography style',
      humorous: 'Fun, vibrant, colorful, cartoon illustration style',
      xhs_influencer: 'Aesthetic, Instagram style, trendy, high saturation, warm tones',
      emotional: 'Warm, emotional, soft lighting, heartfelt',
      storytelling: 'Cinematic, storytelling, dramatic lighting, narrative scene',
      casual: 'Casual, lifestyle, natural light, relaxed atmosphere',
    };
    const enhancedPrompt = params.style && styleEnhancements[params.style]
      ? `${params.prompt}, ${styleEnhancements[params.style]}, 8k, high detail, masterpiece`
      : `${params.prompt}, high quality, 8k, masterpiece`;

    try {
      this.logger.log('Generating image with fal.ai nano-banana-pro...');

      // fal.ai 使用异步队列模式，先提交任务
      const submitResponse = await fetch('https://fal.run/fal-ai/nano-banana-pro', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Key ${this.falApiKey}`,
        },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          image_size: { width, height },
          seed: params.seed || Math.floor(Math.random() * 1000000),
          num_images: 1,
        }),
      });

      if (!submitResponse.ok) {
        const error = await submitResponse.text();
        throw new Error(`fal.ai submit error: ${error}`);
      }

      const submitData = await submitResponse.json();
      const requestId = submitData.request_id;

      this.logger.log(`fal.ai request submitted: ${requestId}`);

      // 轮询获取结果
      let result = null;
      const maxAttempts = 60; // 最多等待30秒
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 等待0.5秒

        const statusResponse = await fetch(`https://fal.run/fal-ai/nano-banana-pro/requests/${requestId}`, {
          headers: {
            'Authorization': `Key ${this.falApiKey}`,
          },
        });

        if (!statusResponse.ok) {
          continue;
        }

        const statusData = await statusResponse.json();
        
        if (statusData.status === 'completed') {
          result = statusData;
          break;
        } else if (statusData.status === 'failed') {
          throw new Error(`fal.ai generation failed: ${statusData.error}`);
        }
      }

      if (!result) {
        throw new Error('fal.ai generation timeout');
      }

      // 获取生成的图片URL
      const imageUrl = result.images?.[0]?.url || result.image?.url;
      
      this.logger.log(`fal.ai image generated: ${imageUrl}`);

      return {
        url: imageUrl,
        revisedPrompt: enhancedPrompt,
      };
    } catch (error) {
      this.logger.error('fal.ai image generation failed:', error);
      throw error;
    }
  }
}
