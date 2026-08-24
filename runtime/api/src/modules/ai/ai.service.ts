import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { parseGeneratedTitles } from './title-parser';

interface AIResponse {
  content: string;
  model: string;
  provider: 'openrouter' | 'deepseek' | 'qwen';
  latency_ms: number;
  cost_usd: number | null;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface TitlesResponse {
  titles: string[];
  usage: AIResponse['usage'];
  model: string;
  provider: AIResponse['provider'];
  latency_ms: number;
  cost_usd: number | null;
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly qwenApiKey: string;
  private readonly deepseekApiKey: string;
  private readonly falApiKey: string;
  private readonly openRouterApiKey: string;
  private openRouterFailures = 0;
  private openRouterOpenUntil = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.qwenApiKey = this.configService.get('QWEN_API_KEY', '');
    this.deepseekApiKey = this.configService.get('DEEPSEEK_API_KEY', '');
    this.falApiKey = this.configService.get('FAL_API_KEY', '');
    this.openRouterApiKey = this.configService.get('OPENROUTER_API_KEY', '');
  }

  async generateText(params: {
    prompt: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<AIResponse> {
    const startedAt = Date.now();
    const maxTokens = Math.min(4000, Math.max(1, params.maxTokens || 2000));
    const model: string = params.model || (this.openRouterApiKey
      ? this.configService.get<string>('OPENROUTER_MODEL_FAST', 'qwen/qwen3-30b-a3b-instruct-2507')
      : 'qwen-turbo');
    if (this.openRouterApiKey) {
      if (Date.now() < this.openRouterOpenUntil) {
        throw new Error('OpenRouter circuit is open; retry after cooldown');
      }
      const models = [
        model,
        ...this.configService.get<string>('OPENROUTER_FALLBACK_MODELS', 'deepseek/deepseek-v3.2,google/gemini-2.5-flash-lite')
          .split(',').map((item: string) => item.trim()).filter(Boolean),
      ];
      let response: Response;
      try {
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.openRouterApiKey}`, 'HTTP-Referer': this.configService.get('OPENROUTER_SITE_URL', 'https://fenfa.ai'), 'X-Title': '分发侠' },
          body: JSON.stringify({ models, messages: [{ role: 'user', content: params.prompt }], max_tokens: maxTokens, temperature: params.temperature ?? 0.7, provider: { data_collection: 'deny', zdr: true, require_parameters: true } }),
        });
      } catch (error) {
        this.registerOpenRouterFailure();
        throw error;
      }
      if (!response.ok) {
        this.registerOpenRouterFailure();
        throw new Error(`OpenRouter API error: ${response.status} ${await response.text()}`);
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        this.registerOpenRouterFailure();
        throw new Error('OpenRouter returned empty content');
      }
      this.openRouterFailures = 0;
      this.openRouterOpenUntil = 0;
      return {
        content,
        model: String(data.model || model),
        provider: 'openrouter',
        latency_ms: Date.now() - startedAt,
        cost_usd: Number.isFinite(Number(data.usage?.cost)) ? Number(data.usage.cost) : null,
        usage: { prompt_tokens: data.usage?.prompt_tokens || 0, completion_tokens: data.usage?.completion_tokens || 0, total_tokens: data.usage?.total_tokens || 0 },
      };
    }
    const provider = model.includes('deepseek') ? 'deepseek' : 'qwen';
    const apiKey = provider === 'deepseek' ? this.deepseekApiKey : this.qwenApiKey;
    if (!apiKey) {
      throw new Error(`${provider.toUpperCase()} API key is not configured`);
    }

    const baseUrl = provider === 'deepseek' 
      ? 'https://api.deepseek.com/v1' 
      : 'https://dashscope.aliyuncs.com/api/v1';

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'user', content: params.prompt }
          ],
          max_tokens: maxTokens,
          temperature: params.temperature || 0.7,
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

      return { content, model, provider, latency_ms: Date.now() - startedAt, cost_usd: null, usage };
    } catch (error) {
      this.logger.error('AI generation failed:', error);
      throw error;
    }
  }

  private registerOpenRouterFailure() {
    this.openRouterFailures += 1;
    const threshold = Math.max(1, this.configService.get<number>('OPENROUTER_CIRCUIT_FAILURES', 3));
    if (this.openRouterFailures >= threshold) {
      const cooldownMs = Math.max(1000, this.configService.get<number>('OPENROUTER_CIRCUIT_COOLDOWN_MS', 60000));
      this.openRouterOpenUntil = Date.now() + cooldownMs;
      this.logger.warn(`OpenRouter circuit opened for ${cooldownMs}ms after ${this.openRouterFailures} failures`);
    }
  }

  async generateArticle(params: {
    topic: string;
    style: string;
    platform: string;
    keywords?: string[];
  }): Promise<{ content: string; visualPrompts?: string[]; model: string; provider: string; latency_ms: number; cost_usd: number | null; usage: AIResponse['usage'] }> {
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
      model: result.model,
      provider: result.provider,
      latency_ms: result.latency_ms,
      cost_usd: result.cost_usd,
      usage: result.usage,
    };
  }

  async analyzeViralContent(content: string): Promise<any> {
    return (await this.analyzeViralContentWithUsage(content)).analysis;
  }

  async analyzeViralContentWithUsage(content: string): Promise<{ analysis: any } & Omit<AIResponse, 'content'>> {
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
      return { analysis: JSON.parse(result.content), model: result.model, provider: result.provider, latency_ms: result.latency_ms, cost_usd: result.cost_usd, usage: result.usage };
    } catch {
      return { analysis: { raw_analysis: result.content }, model: result.model, provider: result.provider, latency_ms: result.latency_ms, cost_usd: result.cost_usd, usage: result.usage };
    }
  }

  async assertTenantDailyBudget(tenantId: string): Promise<void> {
    const usage = await this.getTenantDailyBudgetUsage(tenantId);
    if (usage.limit_usd > 0 && usage.spent_usd >= usage.limit_usd) {
      throw new Error(`AI tenant daily budget exceeded (${usage.spent_usd.toFixed(4)}/${usage.limit_usd.toFixed(2)} USD)`);
    }
  }

  async getTenantDailyBudgetUsage(tenantId: string) {
    const budgetUsd = Math.max(0, this.configService.get<number>('AI_TENANT_DAILY_BUDGET_USD', 20));
    if (budgetUsd === 0) return { spent_usd: 0, limit_usd: 0, remaining_usd: -1, usage_ratio: 0, warning_level: 'disabled' };
    const nowInChina = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const dayStart = new Date(Date.UTC(nowInChina.getUTCFullYear(), nowInChina.getUTCMonth(), nowInChina.getUTCDate()) - 8 * 60 * 60 * 1000);
    const aggregate = await this.prisma.aIGeneration.aggregate({
      where: { tenant_id: tenantId, status: 'success', created_at: { gte: dayStart } },
      _sum: { cost_amount: true },
    });
    const spent = Number(aggregate._sum.cost_amount || 0);
    const ratio = spent / budgetUsd;
    const warningLevel = ratio >= 1 ? 'blocked' : ratio >= 0.95 ? 'critical' : ratio >= 0.8 ? 'warning' : 'normal';
    return { spent_usd: spent, limit_usd: budgetUsd, remaining_usd: Math.max(budgetUsd - spent, 0), usage_ratio: Number(ratio.toFixed(4)), warning_level: warningLevel, timezone: 'Asia/Shanghai' };
  }

  async generateTitles(topic: string, platform: string, count: number = 5): Promise<string[]> {
    return (await this.generateTitlesWithUsage(topic, platform, count)).titles;
  }

  async generateTitlesWithUsage(
    topic: string,
    platform: string,
    count: number = 5,
  ): Promise<TitlesResponse> {
    const result = await this.generateText({
      prompt: `请为"${topic}"在${platform}平台生成${count}个吸引人的标题，每个标题20字以内，用换行分隔`,
      maxTokens: 500,
    });

    // 结构化解析：剥离「以下是……」等说明性前后缀，
    // 解析不到有效标题时抛错（fail closed），不把说明文字当标题返回。
    const titles = parseGeneratedTitles(result.content, count);
    return { titles, usage: result.usage, model: result.model, provider: result.provider, latency_ms: result.latency_ms, cost_usd: result.cost_usd };
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
    durationMs?: number;
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
        duration_ms: data.durationMs,
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
