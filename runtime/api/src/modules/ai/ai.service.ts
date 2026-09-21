import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { parseGeneratedTitles } from './title-parser';
import {
  assertDomesticProviderConfigured,
  isDomesticMarket,
  resolveTextProvider,
} from './market-routing';

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

export interface ContentSource {
  title: string;
  url: string;
  publisher: string;
  verifiedAt: string;
  freshnessStatus?: 'current' | 'review-required';
}

export interface QualityBreakdown {
  accuracy: number;
  professionalism: number;
  platformFit: number;
  citation: number;
  safety: number;
  total: number;
  suggestions: string[];
}

const PLATFORM_KNOWLEDGE: Record<string, ContentSource[]> = {
  douyin: [{ title: '抖音开放平台协议与平台规范入口', url: 'https://open.douyin.com/platform/resource/docs/operation-standard/agreement-protocol', publisher: '抖音', verifiedAt: '2026-07-30' }],
  linkedin: [{ title: 'LinkedIn Professional Community Policies', url: 'https://www.linkedin.com/legal/professional-community-policies', publisher: 'LinkedIn', verifiedAt: '2026-07-30' }],
  tiktok: [{ title: 'TikTok Community Guidelines', url: 'https://www.tiktok.com/community-guidelines/en/', publisher: 'TikTok', verifiedAt: '2026-07-30' }],
};

export function sourcesForPlatform(platform: string, now = new Date(), maxAgeDays = 30): ContentSource[] {
  return (PLATFORM_KNOWLEDGE[platform.toLowerCase()] || []).map((source) => {
    const ageMs = now.getTime() - new Date(`${source.verifiedAt}T00:00:00Z`).getTime();
    const current = Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= maxAgeDays * 86400000;
    return { ...source, freshnessStatus: current ? 'current' as const : 'review-required' as const };
  }).filter((source) => source.freshnessStatus === 'current');
}

export function sanitizeTitles(raw: string, count: number): string[] {
  const explanation = /^(以下|说明|理由|技巧|note:|here are|why\b)/i;
  return raw.split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)、．])\s*/, '').replace(/^[`"'“”]+|[`"'“”]+$/g, '').trim())
    .filter((line) => line.length >= 4 && line.length <= 100 && !explanation.test(line) && !/^[（(].*[）)]$/.test(line))
    .slice(0, Math.max(1, Math.min(count, 20)));
}

export function scoreContent(content: string, sources: ContentSource[], locale: 'zh-CN' | 'en' = 'en'): QualityBreakdown {
  const structured = /[\n#]|[。.!?]\s/.test(content);
  const cited = sources.some((source, index) => content.includes(`[${index + 1}]`) || content.includes(source.publisher) || content.includes(source.url));
  const accuracy = sources.length ? 26 : 20;
  const professionalism = structured ? 23 : 18;
  const platformFit = content.length >= 80 ? 18 : 14;
  const citation = cited ? 14 : sources.length ? 8 : 4;
  const safety = 10;
  const suggestions: string[] = [];
  if (!sources.length) suggestions.push(locale === 'en' ? 'Add an authoritative source for factual claims.' : '请为事实性陈述补充权威来源。');
  else if (!cited) suggestions.push(locale === 'en' ? 'Connect factual claims to the numbered sources in the draft.' : '请将事实性陈述与编号来源对应。');
  return { accuracy, professionalism, platformFit, citation, safety, total: accuracy + professionalism + platformFit + citation + safety, suggestions };
}

/** 境内供应商的 OpenAI 兼容对话接口。地址写死，不从环境变量读。 */
export const DOMESTIC_CHAT_ENDPOINTS = {
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
} as const;

/** 通义万相文生图（DashScope 异步任务）。 */
export const DASHSCOPE_IMAGE_SYNTHESIS = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis';
export const DASHSCOPE_TASKS = 'https://dashscope.aliyuncs.com/api/v1/tasks/';

export const MAX_SCRIPT_SCENES = 12;

export function buildScriptPrompt(topic: string, type: string, platform: string): string {
  return [
    `为「${platform}」平台创作一条「${type}」类短视频的分镜脚本，主题：${topic}`,
    '',
    '要求：',
    `1. 分镜 4–${MAX_SCRIPT_SCENES} 个，总时长 30–90 秒`,
    '2. visual 用于驱动视频生成，必须是具体可视化的画面描述（场景、主体、镜头、光线），不要写抽象概念',
    '3. subtitle 是该分镜的口播/字幕文案，口语化',
    '4. time 是该分镜时长（秒，整数）',
    '',
    '只输出 JSON，不要 markdown 代码块，格式：',
    '{"title":"标题","scenes":[{"visual":"画面描述","subtitle":"字幕","time":6}]}',
  ].join('\n');
}

/** 模型有时会裹上 ```json 代码块或加前后缀，这里做一次容错提取。 */
export function parseScriptJson(raw: string): any {
  const cleaned = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('模型未返回可解析的 JSON');
  }
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly qwenApiKey: string;
  private readonly deepseekApiKey: string;
  private readonly falApiKey: string;
  private readonly openRouterApiKey: string;
  private readonly marketRegion: string;
  private openRouterFailures = 0;
  private openRouterOpenUntil = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.qwenApiKey = this.configService.get('QWEN_API_KEY', '');
    this.deepseekApiKey = this.configService.get('DEEPSEEK_API_KEY', '');
    this.falApiKey = this.configService.get('FAL_API_KEY', '');
    this.marketRegion = this.configService.get('MARKET_REGION', '');
    // 国内栈一律不持有这把 key，**即使环境里有**。
    // 边界写在代码里而不是只靠 compose：compose 删掉了，下一个人
    // 加回来就又出境了，而且不会有任何报错。
    this.openRouterApiKey = isDomesticMarket(this.marketRegion)
      ? ''
      : this.configService.get('OPENROUTER_API_KEY', '');
    // 国内栈没有任何境内 key 时，在启动阶段就说清楚，
    // 而不是等第一个用户点了生成才报。
    assertDomesticProviderConfigured({
      marketRegion: this.marketRegion,
      qwenApiKey: this.qwenApiKey,
      deepseekApiKey: this.deepseekApiKey,
    });
  }

  async generateText(params: {
    prompt: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<AIResponse> {
    const startedAt = Date.now();
    const maxTokens = Math.min(4000, Math.max(1, params.maxTokens || 2000));
    const decision = resolveTextProvider({
      marketRegion: this.marketRegion,
      openRouterApiKey: this.openRouterApiKey,
      requestedModel: params.model,
      offshoreDefaultModel: this.configService.get<string>(
        'OPENROUTER_MODEL_FAST',
        'qwen/qwen3-30b-a3b-instruct-2507',
      ),
    });
    const model: string = decision.model;
    if (decision.useOpenRouter) {
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
    return this.generateDomesticText(params, model, maxTokens, startedAt);
  }

  /**
   * 境内直连：通义千问（DashScope 兼容模式）与 DeepSeek。
   *
   * 2026-09-21 之前这里有两处让国内版的文本生成**一次也成功不了**：
   *  1. 千问的地址写成 `https://dashscope.aliyuncs.com/api/v1/chat/completions` ——
   *     DashScope 没有这个路径（OpenAI 兼容接口在 `/compatible-mode/v1`），永远 404；
   *  2. 未指定模型时一律用 `qwen-turbo`：只配了 DEEPSEEK_API_KEY 的部署
   *     （compose 写的是「两把至少要有一把」）每次都报「QWEN key 未配置」，
   *     从来不会去用已经配好的 DeepSeek。
   * 现在：调用方指定了模型就只用那一家；否则按已配置的 key 依次尝试，
   * 前一家失败换下一家。
   */
  private async generateDomesticText(
    params: { prompt: string; model?: string; temperature?: number },
    model: string,
    maxTokens: number,
    startedAt: number,
  ): Promise<AIResponse> {
    const candidates: Array<{ provider: 'qwen' | 'deepseek'; model: string; key: string }> = [];
    if (params.model) {
      const provider = model.includes('deepseek') ? 'deepseek' : 'qwen';
      candidates.push({ provider, model, key: provider === 'deepseek' ? this.deepseekApiKey : this.qwenApiKey });
    } else {
      if (this.qwenApiKey) candidates.push({ provider: 'qwen', model: this.configService.get('QWEN_MODEL', 'qwen-turbo'), key: this.qwenApiKey });
      if (this.deepseekApiKey) candidates.push({ provider: 'deepseek', model: this.configService.get('DEEPSEEK_MODEL', 'deepseek-chat'), key: this.deepseekApiKey });
    }
    const usable = candidates.filter((c) => c.key);
    if (!usable.length) {
      throw new Error(`${(candidates[0]?.provider ?? 'qwen').toUpperCase()} API key is not configured`);
    }

    const failures: string[] = [];
    for (const candidate of usable) {
      try {
        const response = await fetch(DOMESTIC_CHAT_ENDPOINTS[candidate.provider], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${candidate.key}` },
          body: JSON.stringify({
            model: candidate.model,
            messages: [{ role: 'user', content: params.prompt }],
            max_tokens: maxTokens,
            temperature: params.temperature ?? 0.7,
          }),
        });
        if (!response.ok) {
          failures.push(`${candidate.provider}:${response.status}`);
          continue;
        }
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content || '';
        if (!content) {
          failures.push(`${candidate.provider}:empty`);
          continue;
        }
        const usage = {
          prompt_tokens: data.usage?.prompt_tokens || 0,
          completion_tokens: data.usage?.completion_tokens || 0,
          total_tokens: data.usage?.total_tokens || 0,
        };
        this.logger.log(`AI generation completed via ${candidate.provider}: ${usage.total_tokens} tokens`);
        return { content, model: candidate.model, provider: candidate.provider, latency_ms: Date.now() - startedAt, cost_usd: null, usage };
      } catch (error) {
        failures.push(`${candidate.provider}:${error instanceof Error ? error.name : 'error'}`);
      }
    }
    // 不把供应商返回的原文带出去（可能含账户信息），只记失败摘要。
    this.logger.error(`Domestic AI providers all failed: ${failures.join(', ')}`);
    throw new Error(`AI API error: ${failures.join(', ')}`);
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
    // 国内版一律走通义万相（境内），不论环境里有没有 FAL_API_KEY——
    // 原来国内版也只会调 fal.ai（境外），给了 key 就出境，不给就永远「未配置」。
    if (isDomesticMarket(this.marketRegion)) {
      return this.generateImageDashScope(params);
    }
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

  /** 通义万相文生图：提交异步任务，轮询到 SUCCEEDED 取结果地址（结果地址约 24 小时有效）。 */
  private async generateImageDashScope(params: { prompt: string; size?: string; seed?: number }): Promise<{ url: string; revisedPrompt?: string }> {
    if (!this.qwenApiKey) {
      throw new Error('国内版图片生成使用通义万相，需要配置 QWEN_API_KEY（DashScope）');
    }
    const sizes: Record<string, string> = {
      '256x256': '512*512', '512x512': '512*512', '1024x1024': '1024*1024',
      '1280x720': '1280*720', '720x1280': '720*1280',
    };
    const size = sizes[params.size || '1024x1024'] ?? '1024*1024';
    const submit = await fetch(DASHSCOPE_IMAGE_SYNTHESIS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.qwenApiKey}`,
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: this.configService.get('DASHSCOPE_IMAGE_MODEL', 'wanx2.1-t2i-turbo'),
        input: { prompt: params.prompt },
        parameters: { size, n: 1, ...(params.seed ? { seed: params.seed } : {}) },
      }),
    });
    if (!submit.ok) throw new Error(`通义万相提交失败：${submit.status}`);
    const taskId = (await submit.json())?.output?.task_id;
    if (!taskId) throw new Error('通义万相未返回任务编号');

    const attempts = Math.max(1, Number(this.configService.get('DASHSCOPE_IMAGE_POLL_ATTEMPTS', 60)));
    const intervalMs = Math.max(0, Number(this.configService.get('DASHSCOPE_IMAGE_POLL_INTERVAL_MS', 1000)));
    for (let i = 0; i < attempts; i += 1) {
      if (intervalMs) await new Promise((resolve) => setTimeout(resolve, intervalMs));
      const res = await fetch(`${DASHSCOPE_TASKS}${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${this.qwenApiKey}` },
      });
      if (!res.ok) continue;
      const output = (await res.json())?.output;
      if (output?.task_status === 'SUCCEEDED') {
        const url = output?.results?.find((r: any) => r?.url)?.url;
        if (!url) throw new Error('通义万相未返回图片地址');
        return { url, revisedPrompt: output?.results?.[0]?.actual_prompt ?? params.prompt };
      }
      if (output?.task_status === 'FAILED' || output?.task_status === 'CANCELED') {
        throw new Error(`通义万相生成失败：${output?.code ?? output?.task_status}`);
      }
    }
    throw new Error('通义万相生成超时');
  }

  /**
   * 短视频分镜脚本。原来在 web-cn 的 Next 路由里直连 openrouter.ai（境外）；
   * 现在由后端按市场选择供应商（国内版只走境内），并记预算与生成记录。
   */
  async generateScript(input: { topic: string; type?: string; platform?: string }): Promise<{
    title: string;
    scenes: Array<{ visual: string; subtitle: string; time: number }>;
  } & Omit<AIResponse, 'content'>> {
    const result = await this.generateText({
      prompt: buildScriptPrompt(input.topic, input.type || '爆款解说', input.platform || '抖音'),
      maxTokens: 2000,
      temperature: 0.8,
    });
    const parsed = parseScriptJson(result.content);
    const scenes = (Array.isArray(parsed?.scenes) ? parsed.scenes : [])
      .slice(0, MAX_SCRIPT_SCENES)
      .map((scene: any) => ({
        visual: String(scene?.visual ?? '').trim(),
        subtitle: String(scene?.subtitle ?? '').trim(),
        time: Math.min(30, Math.max(1, Math.round(Number(scene?.time) || 6))),
      }))
      .filter((scene: { visual: string; subtitle: string }) => scene.visual || scene.subtitle);
    if (!scenes.length) throw new Error('模型未生成任何分镜');
    const { content: _content, ...meta } = result;
    return { title: String(parsed?.title || input.topic), scenes, ...meta };
  }
}
