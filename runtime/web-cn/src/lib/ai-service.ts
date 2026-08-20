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

export interface ImageGenerationParams {
    prompt: string;
    size?: '256x256' | '512x512' | '1024x1024' | '1280x720' | '720x1280';
    style?: string;
    seed?: number;
}

export interface ImageGenerationResult {
    url: string;
    revisedPrompt?: string;
}

function unwrap<T>(response: T | { data?: T }): T {
    return (response as { data?: T })?.data ?? response as T;
}

function requireGeneratedAssetUrl(url: unknown): string {
    if (typeof url !== 'string' || !url.trim()) {
        throw new Error('图片服务未返回可用地址');
    }
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
        throw new Error('图片服务返回了不安全的地址');
    }
    return parsed.toString();
}

/**
 * Browser-safe AI facade. Provider credentials and failover stay in the API;
 * this module never calls a model vendor directly or reads provider secrets.
 */
export class AIService {
    async generateArticle(params: AIGenerationParams): Promise<AIGenerationResult> {
        const response = await apiClient.post<AIGenerationResult | { data?: AIGenerationResult }>(
            '/ai/generate/article',
            {
                topic: params.prompt,
                style: params.style,
                platform: 'xhs',
                personaId: params.personaId,
                maxTokens: params.maxTokens,
                temperature: params.temperature,
            },
        );
        const result = unwrap(response);
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
        const response = await apiClient.post<{ titles?: string[] } | { data?: { titles?: string[] } }>(
            '/ai/generate/titles',
            { topic, count },
        );
        return unwrap(response).titles ?? [];
    }

    async rewriteContent(content: string, style?: string): Promise<AIGenerationResult> {
        const prompt = `请改写以下内容，保持核心意思不变，但使用不同的表达方式：\n\n${content}`;
        return this.generateArticle({ prompt, style });
    }
}

export class ServerImageGenerationService {
    async generateImage(params: ImageGenerationParams): Promise<ImageGenerationResult> {
        const response = await apiClient.post<ImageGenerationResult | { data?: ImageGenerationResult }>(
            '/ai/generate/image',
            params,
        );
        const result = unwrap(response);
        return {
            url: requireGeneratedAssetUrl(result.url),
            revisedPrompt: result.revisedPrompt,
        };
    }
}

export type FalImageGenerationParams = ImageGenerationParams;
export type FalImageGenerationResult = ImageGenerationResult;

export const aiService = new AIService();
export const imageService = new ServerImageGenerationService();
export const falImageService = imageService;
