import { apiClient } from '@/lib/api-client';
import { getStylePrompt } from './prompt-config';

export interface ImageGenerationParams {
    prompt: string;
    style?: string;
    negativePrompt?: string;
    imageSize?: 'square' | 'portrait' | 'landscape';
    numImages?: number;
}

export interface ImageGenerationResult {
    images: Array<{
        url: string;
        width: number;
        height: number;
    }>;
}

interface ServerImageResult {
    url?: string;
    revisedPrompt?: string;
}

const dimensions = {
    square: { size: '1024x1024', width: 1024, height: 1024 },
    portrait: { size: '720x1280', width: 720, height: 1280 },
    landscape: { size: '1280x720', width: 1280, height: 720 },
} as const;

function unwrap<T>(response: T | { data?: T }): T {
    return (response as { data?: T })?.data ?? response as T;
}

/** Image generation always crosses the authenticated first-party API boundary. */
export class ServerImageService {
    async generateImage(params: ImageGenerationParams): Promise<ImageGenerationResult> {
        const selected = dimensions[params.imageSize ?? 'square'];
        const stylePrompt = params.style ? getStylePrompt(params.style) : '';
        const prompt = [params.prompt, stylePrompt].filter(Boolean).join(', ');
        const response = await apiClient.post<ServerImageResult | { data?: ServerImageResult }>(
            '/ai/generate/image',
            {
                prompt,
                size: selected.size,
                style: params.style,
            },
        );
        const result = unwrap(response);
        if (!result.url) {
            throw new Error('图片服务未返回可用地址');
        }
        const url = new URL(result.url);
        if (url.protocol !== 'https:') {
            throw new Error('图片服务返回了不安全的地址');
        }
        return {
            images: [{ url: url.toString(), width: selected.width, height: selected.height }],
        };
    }
}

export const imageService = new ServerImageService();
