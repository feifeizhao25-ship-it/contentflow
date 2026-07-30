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
  xhs: [{
    title: '小红书社区规范',
    url: 'https://ark.xiaohongshu.com/ark',
    publisher: '小红书',
    verifiedAt: '2026-07-30',
  }],
  douyin: [{
    title: '抖音开放平台协议与平台规范入口',
    url: 'https://open.douyin.com/platform/resource/docs/operation-standard/agreement-protocol',
    publisher: '抖音',
    verifiedAt: '2026-07-30',
  }],
  linkedin: [{
    title: 'LinkedIn Professional Community Policies',
    url: 'https://www.linkedin.com/legal/professional-community-policies',
    publisher: 'LinkedIn',
    verifiedAt: '2026-07-30',
  }],
  tiktok: [{
    title: 'TikTok Community Guidelines',
    url: 'https://www.tiktok.com/community-guidelines/en/',
    publisher: 'TikTok',
    verifiedAt: '2026-07-30',
  }],
  youtube: [{
    title: 'YouTube Community Guidelines',
    url: 'https://www.youtube.com/howyoutubeworks/policies/community-guidelines/',
    publisher: 'YouTube',
    verifiedAt: '2026-07-30',
  }],
  instagram: [{
    title: 'Instagram Community Guidelines',
    url: 'https://help.instagram.com/477434105621119',
    publisher: 'Instagram',
    verifiedAt: '2026-07-30',
  }],
};

export function sourcesForPlatform(
  platform: string,
  now: Date = new Date(),
  maxAgeDays = 30,
): ContentSource[] {
  return (PLATFORM_KNOWLEDGE[platform.toLowerCase()] || [])
    .map((source) => {
      const ageMs = now.getTime() - new Date(`${source.verifiedAt}T00:00:00Z`).getTime();
      const current = Number.isFinite(ageMs) &&
        ageMs >= 0 &&
        ageMs <= maxAgeDays * 24 * 60 * 60 * 1000;
      return {
        ...source,
        freshnessStatus: current ? 'current' as const : 'review-required' as const,
      };
    })
    .filter((source) => source.freshnessStatus === 'current');
}

export function sanitizeTitles(raw: string, count: number): string[] {
  const explanation = /^(以下|说明|理由|技巧|note:|here are|why\b)/i;
  return raw
    .split('\n')
    .map((line) => line
      .replace(/^\s*(?:[-*•]|\d+[.)、．])\s*/, '')
      .replace(/^[`"'“”]+|[`"'“”]+$/g, '')
      .trim())
    .filter((line) =>
      line.length >= 4 &&
      line.length <= 100 &&
      !explanation.test(line) &&
      !/^[（(].*[）)]$/.test(line))
    .slice(0, Math.max(1, Math.min(count, 20)));
}

export function scoreContent(
  content: string,
  sources: ContentSource[],
  locale: 'zh-CN' | 'en' = 'en',
): QualityBreakdown {
  const hasStructure = /[\n#]|[。.!?]\s/.test(content);
  const hasInlineCitation = sources.some((source, index) =>
    content.includes(`[${index + 1}]`) ||
    content.includes(source.publisher) ||
    content.includes(source.url)
  );
  const accuracy = sources.length ? 26 : 20;
  const professionalism = hasStructure ? 23 : 18;
  const platformFit = content.length >= 80 ? 18 : 14;
  const citation = hasInlineCitation ? 14 : sources.length ? 8 : 4;
  const safety = 10;
  const total = accuracy + professionalism + platformFit + citation + safety;
  const suggestions: string[] = [];
  if (!sources.length) suggestions.push(locale === 'en'
    ? 'Add an authoritative source for factual claims.'
    : '请为事实性陈述补充权威来源。');
  else if (!hasInlineCitation) suggestions.push(locale === 'en'
    ? 'Connect factual claims to the numbered sources in the draft.'
    : '请将事实性陈述与文末编号来源逐条对应。');
  if (!hasStructure) suggestions.push(locale === 'en'
    ? 'Use headings or shorter paragraphs to improve readability.'
    : '请使用小标题或短段落提升可读性。');
  if (content.length < 80) suggestions.push(locale === 'en'
    ? 'Add supporting detail and a clear call to action.'
    : '请补充关键依据，并给出一个明确行动建议。');
  return { accuracy, professionalism, platformFit, citation, safety, total, suggestions };
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
    systemPrompt?: string;
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
    const openRouterHeaders: Record<string, string> =
      provider === 'openrouter'
        ? {
            'HTTP-Referer': this.configService.get<string>(
              'OPENROUTER_SITE_URL',
              'https://contentflow.invalid',
            ),
            'X-Title': 'ContentFlow',
          }
        : {};
    const openRouterRouting = provider === 'openrouter' ? {
      models: configuredModels,
      provider: {
        data_collection: 'deny',
        zdr: true,
        allow_fallbacks: configuredModels.length > 1,
      },
    } : {};
    const requestTimeoutMs = Math.max(
      5_000,
      Math.min(
        this.configService.get<number>('AI_REQUEST_TIMEOUT_MS', 60_000),
        120_000,
      ),
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          ...openRouterHeaders,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            ...(params.systemPrompt
              ? [{ role: 'system', content: params.systemPrompt }]
              : []),
            { role: 'user', content: params.prompt }
          ],
          max_tokens: params.maxTokens ?? 2000,
          temperature: params.temperature ?? 0.7,
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
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateArticle(params: {
    topic: string;
    style: string;
    platform: string;
    keywords?: string[];
    locale?: 'zh-CN' | 'en';
  }): Promise<{
    content: string;
    visualPrompts?: string[];
    provenance: 'knowledge-assisted' | 'ai-generated';
    sources: ContentSource[];
    quality: QualityBreakdown;
    disclaimer: string;
  }> {
    const locale = params.locale === 'en' ? 'en' : 'zh-CN';
    const platformPrompts: Record<string, Record<string, string>> = {
      'zh-CN': {
        xhs: `为小红书创作实用笔记，主题：${params.topic}，风格：${params.style}`,
        douyin: `为抖音创作短视频脚本，主题：${params.topic}，风格：${params.style}`,
        wechat: `为微信公众号创作深度文章，主题：${params.topic}，风格：${params.style}`,
        zhihu: `为知乎创作专业回答，主题：${params.topic}，风格：${params.style}`,
      },
      en: {
        linkedin: `Create a credible LinkedIn post for the selected market. Topic: ${params.topic}. Style: ${params.style}`,
        tiktok: `Create a concise TikTok script adapted to the selected market. Topic: ${params.topic}. Style: ${params.style}`,
        youtube: `Create a structured YouTube script. Topic: ${params.topic}. Style: ${params.style}`,
        instagram: `Create an accessible Instagram post. Topic: ${params.topic}. Style: ${params.style}`,
      },
    };
    const sources = sourcesForPlatform(params.platform);
    const sourceContext = sources.map((source, index) =>
      `[${index + 1}] ${source.publisher}: ${source.title} (${source.url}, verified ${source.verifiedAt})`
    ).join('\n');

    const basePrompt = platformPrompts[locale][params.platform] ||
      (locale === 'en'
        ? `Create content about ${params.topic}. Style: ${params.style}`
        : `创作关于${params.topic}的内容，风格：${params.style}`);
    const systemPrompt = locale === 'en'
      ? 'Write entirely in English. Separate verified facts from suggestions. Never invent statistics, sources, platform rules, or user testimonials.'
      : '全部使用简体中文。区分已核实事实与创作建议。禁止编造数据、来源、平台规则或用户证言。';

    const result = await this.generateText({
      systemPrompt,
      prompt: locale === 'en'
        ? `${basePrompt}
Keywords: ${params.keywords?.join(', ') || params.topic}
Authoritative context (cite only when relevant):
${sourceContext || 'No verified knowledge source matched. Do not present factual claims as verified.'}
Requirements: lead with audience value, use scannable sections, cite factual platform claims with [1], [2], etc., include a Sources section, end with one clear action, and append three English visual prompts after --- VISUAL_PROMPTS.`
        : `${basePrompt}
关键词：${params.keywords?.join('、') || params.topic}
权威上下文（仅在相关时引用）：
${sourceContext || '未匹配到已核实知识来源，不得把事实性陈述写成已验证结论。'}
要求：开头说明用户价值；分段清晰；平台事实必须用[1]、[2]等编号引用，并包含“来源”区块；结尾只有一个行动建议；最后在 --- VISUAL_PROMPTS 后输出3条英文生图提示词。`,
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

    const content = result.content.split(/---?\s*VISUAL_PROMPTS/i)[0].trim();
    return {
      content,
      visualPrompts: visualPrompts.slice(0, 3),
      provenance: sources.length ? 'knowledge-assisted' : 'ai-generated',
      sources,
      quality: scoreContent(content, sources, locale),
      disclaimer: locale === 'en'
        ? 'AI-generated draft. Verify factual, legal, medical, and financial claims before publishing.'
        : 'AI 生成草稿。发布前请核实事实、法律、医疗及金融相关表述。',
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

    return sanitizeTitles(result.content, count);
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
