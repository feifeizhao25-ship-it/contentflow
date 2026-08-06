// AI 服务接口定义
import { apiClient } from '@/lib/api-client';
export interface AIGenerationParams {
    prompt: string;
    style?: string;
    personaId?: string;
    maxTokens?: number;
    temperature?: number;
}

export interface AIGenerationResult {
    content: string;
    model?: string;
    provenance?: 'knowledge-assisted' | 'ai-generated';
    sources?: Array<{
        title: string;
        url: string;
        publisher: string;
        verifiedAt: string;
    }>;
    quality?: {
        accuracy: number;
        professionalism: number;
        platformFit: number;
        citation: number;
        safety: number;
        total: number;
        suggestions: string[];
    };
    disclaimer?: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

// 图片生成参数
export interface ImageGenerationParams {
    prompt: string;
    size?: '256x256' | '512x512' | '1024x1024' | '1280x720' | '720x1280';
    style?: string;
}

export interface ImageGenerationResult {
    url: string;
    revisedPrompt?: string;
}

// OpenRouter 服务
export class OpenRouterService {
    private apiKey: string;
    private baseURL: string;

    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY || '';
        this.baseURL = 'https://openrouter.ai/api/v1';
    }

    async generateText(params: AIGenerationParams): Promise<AIGenerationResult> {
        const stylePrompts: Record<string, string> = {
            professional: '请用专业、严谨、逻辑感强的语气撰写',
            humorous: '请用幽默风趣、富有网感、顽梗的语气撰写',
            xhs_influencer: '请用典型的小红书种草语气，多使用 Emoji，语气亲切并带有强烈的分享欲',
            anime: '请用热血、二次元动漫风、带有画面感的语气撰写',
            chinese_ink: '请用中国风、唯美、具有诗意和文化底蕴的语气撰写',
            cinematic: '请用史诗感、电影叙事感、张力十足的语气撰写',
            vintage: '请用富有年代感、怀旧、复古港风的语气撰写',
            cyberpunk: '请用硬核、科幻感、具有赛博朋克未来感的语气撰写',
        };

        const systemPrompt = params.style
            ? stylePrompts[params.style]
            : '请撰写高质量的内容';

        try {
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'HTTP-Referer': 'https://fenfa.ai',
                    'X-Title': 'FenfaAI',
                },
                body: JSON.stringify({
                    model: 'google/gemini-pro-1.5', // More stable ID across OpenRouter
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: params.prompt },
                    ],
                    max_tokens: params.maxTokens || 2000,
                    temperature: params.temperature || 0.7,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();

            return {
                content: data.choices[0].message.content,
                usage: data.usage ? {
                    promptTokens: data.usage.prompt_tokens,
                    completionTokens: data.usage.completion_tokens,
                    totalTokens: data.usage.total_tokens,
                } : undefined,
            };
        } catch (error) {
            console.error('OpenRouter generation error:', error);
            throw error;
        }
    }

    async generateTitles(topic: string, count: number = 10): Promise<string[]> {
        const prompt = `请为主题"${topic}"生成${count}个吸引人的标题。要求：
1. 标题要有吸引力，能激发读者兴趣
2. 适合社交媒体平台（抖音、小红书等）
3. 可以使用emoji增加视觉效果
4. 每个标题一行，不要编号

请直接输出标题列表：`;

        try {
            const result = await this.generateText({ prompt, temperature: 0.9 });
            const titles = result.content
                .split('\n')
                .filter(line => line.trim().length > 0)
                .slice(0, count);

            return titles;
        } catch (error) {
            console.error('Title generation error:', error);
            throw error;
        }
    }
}

// SiliconFlow 服务（硅基流动）
export class SiliconFlowService {
    private apiKey: string;
    private baseURL: string;

    constructor() {
        this.apiKey = process.env.SILICONFLOW_API_KEY || '';
        this.baseURL = 'https://api.siliconflow.cn/v1';
    }

    async generateText(params: AIGenerationParams): Promise<AIGenerationResult> {
        const stylePrompts: Record<string, string> = {
            professional: '请用专业、严谨、逻辑感强的语气撰写',
            humorous: '请用幽默风趣、富有网感、顽梗的语气撰写',
            xhs_influencer: '请用典型的小红书种草语气，多使用 Emoji，语气亲切并带有强烈的分享欲',
            anime: '请用热血、二次元动漫风、带有画面感的语气撰写',
            chinese_ink: '请用中国风、唯美、具有诗意和文化底蕴的语气撰写',
            cinematic: '请用史诗感、电影叙事感、张力十足的语气撰写',
            vintage: '请用富有年代感、怀旧、复古港风的语气撰写',
            cyberpunk: '请用硬核、科幻感、具有赛博朋克未来感的语气撰写',
        };

        const systemPrompt = params.style
            ? stylePrompts[params.style]
            : '请撰写高质量的内容';

    // Model list: GLM-4.7 (Primary), nanobanana, Qwen, DeepSeek
    const models = [
        'Pro/zai-org/GLM-4.7',  // GLM-4.7 最新旗舰模型
        'nanobanana/nanabanana-v5', // nanobanana 模型
        'Qwen/Qwen2.5-72B-Instruct',
        'deepseek-ai/DeepSeek-V3',
    ];
    let lastError = null;

    for (const model of models) {
        try {
            console.log(`Trying model: ${model}`);
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: params.prompt },
                    ],
                    max_tokens: params.maxTokens || 3000, // 增加到 3000
                    temperature: params.temperature || 0.7,
                    stream: false,
                }),
            });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`SiliconFlow API error (${model}): ${response.status} - ${JSON.stringify(errorData)}`);
                }

                const data = await response.json();
                if (!data.choices?.[0]?.message?.content) {
                    throw new Error(`Empty response from model ${model}`);
                }

                return {
                    content: data.choices[0].message.content,
                    usage: data.usage ? {
                        promptTokens: data.usage.prompt_tokens,
                        completionTokens: data.usage.completion_tokens,
                        totalTokens: data.usage.total_tokens,
                    } : undefined,
                };
            } catch (error: any) {
                console.warn(`Model ${model} failed, trying next...`, error.message);
                lastError = error;
                continue;
            }
        }
        throw lastError || new Error('All SiliconFlow models failed');
    }

    async generateTitles(topic: string, count: number = 10): Promise<string[]> {
        const prompt = `请为主题"${topic}"生成${count}个吸引人的标题。要求：
1. 标题要有吸引力，能激发读者兴趣
2. 适合社交媒体平台（抖音、小红书等）
3. 可以使用emoji增加视觉效果
4. 每个标题一行，不要编号

请直接输出标题列表：`;

        try {
            const result = await this.generateText({ prompt, temperature: 0.9 });
            const titles = result.content
                .split('\n')
                .filter(line => line.trim().length > 0)
                .slice(0, count);

            return titles;
        } catch (error) {
            console.error('Title generation error:', error);
            throw error;
        }
    }
}

// AI 服务工厂
export class AIService {
    async generateArticle(params: AIGenerationParams): Promise<AIGenerationResult> {
        const response: any = await apiClient.post('/ai/generate/article', {
            topic: params.prompt,
            style: params.style,
            platform: 'xhs',
        });
        const result = response?.data ?? response;
        return {
            content: result.content ?? '',
            model: result.model ?? 'server-managed',
            usage: result.usage,
            provenance: result.provenance,
            sources: result.sources ?? [],
            quality: result.quality,
            disclaimer: result.disclaimer,
        };
    }

    async generateTitles(topic: string, count?: number): Promise<string[]> {
        const response: any = await apiClient.post('/ai/generate/titles', { topic, count });
        const result = response?.data ?? response;
        return result.titles ?? [];
    }

    async rewriteContent(content: string, style?: string): Promise<AIGenerationResult> {
        const prompt = `请改写以下内容，保持核心意思不变，但使用不同的表达方式：\n\n${content}`;
        return this.generateArticle({ prompt, style: style as any });
    }
}

// 导出默认实例
export const aiService = new AIService();

// 图片生成服务（使用 Polinations AI - 免费高质量图片生成）
export class ImageGenerationService {
    private baseURL: string = 'https://image.pollinations.ai';
    private model: string = 'flux'; // 使用 Polinations 的 FLUX 模型

    constructor() {
        console.log('ImageGenerationService initialized (pollinations.ai - free service)');
    }

    async generateImage(params: ImageGenerationParams): Promise<ImageGenerationResult> {
        try {
            // 构建增强提示词
            const enhancedPrompt = this.enhancePrompt(params.prompt, params.style);

            console.log('Generating image with pollinations.ai (FLUX model)...');

            // Polinations AI 使用简单的 URL 参数
            const { width, height } = this.parseSize(params.size);
            
            // 构建 URL（无需 API key）
            const promptEncoded = encodeURIComponent(enhancedPrompt);
            const imageUrl = `${this.baseURL}/prompt/${promptEncoded}?width=${width}&height=${height}&nologo=true&seed=${Date.now()}`;

            console.log('Image URL generated:', imageUrl.substring(0, 100) + '...');

            return {
                url: imageUrl,
                revisedPrompt: enhancedPrompt,
            };
        } catch (error) {
            console.error('Image generation error:', error);
            return this.getFallbackImage(params.prompt);
        }
    }

    private parseSize(size?: string): { width: number; height: number } {
        const sizeMap: Record<string, { width: number; height: number }> = {
            '256x256': { width: 256, height: 256 },
            '512x512': { width: 512, height: 512 },
            '1024x1024': { width: 1024, height: 1024 },
            '1280x720': { width: 1280, height: 720 },
            '720x1280': { width: 720, height: 1280 },
        };
        return sizeMap[size || '1024x1024'] || { width: 1024, height: 1024 };
    }

    private enhancePrompt(prompt: string, style?: string): string {
        // 根据内容主题增强提示词
        const styleEnhancements: Record<string, string> = {
            professional: 'Professional, clean, minimal, high quality, commercial photography style',
            humorous: 'Fun, vibrant, colorful, cartoon illustration style',
            xhs_influencer: 'Aesthetic, Instagram style, trendy, high saturation, warm tones',
            emotional: 'Warm, emotional, soft lighting, heartfelt',
            storytelling: 'Cinematic, storytelling, dramatic lighting, narrative scene',
            casual: 'Casual, lifestyle, natural light, relaxed atmosphere',
        };

        const baseEnhancement = style && styleEnhancements[style]
            ? styleEnhancements[style]
            : 'High quality, professional photography';

        return `${prompt}, ${baseEnhancement}, 8k, high detail, masterpiece`;
    }

    // 降级方案：使用占位图服务
    private getFallbackImage(prompt: string): ImageGenerationResult {
        // 从 prompt 中提取关键词生成相关占位图
        const keywords = prompt.split(' ').slice(0, 3).join('+');
        return {
            url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`,
            revisedPrompt: prompt,
        };
    }
}

// 导出图片服务实例
export const imageService = new ImageGenerationService();

// ========== FAL.AI 图片生成服务 (nano-banana-pro) ==========

export interface FalImageGenerationParams {
    prompt: string;
    size?: '256x256' | '512x512' | '1024x1024' | '1280x720' | '720x1280';
    style?: string;
    seed?: number;
}

export interface FalImageGenerationResult {
    url: string;
    revisedPrompt?: string;
}

export class FalImageGenerationService {
    private apiBaseUrl: string;

    constructor() {
        this.apiBaseUrl = '/api/ai';
        console.log('FalImageGenerationService initialized (fal.ai nano-banana-pro)');
    }

    async generateImage(params: FalImageGenerationParams): Promise<FalImageGenerationResult> {
        try {
            console.log('Generating image with fal.ai nano-banana-pro...');

            const response = await fetch(`${this.apiBaseUrl}/generate/image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(params),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('Image generated successfully:', data.url?.substring(0, 50) + '...');

            return {
                url: data.url,
                revisedPrompt: data.revisedPrompt,
            };
        } catch (error) {
            console.error('fal.ai image generation error:', error);
            throw error;
        }
    }
}

// 导出 fal.ai 图片服务实例
export const falImageService = new FalImageGenerationService();
