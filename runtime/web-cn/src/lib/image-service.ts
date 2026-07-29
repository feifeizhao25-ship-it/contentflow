import { fal } from "@fal-ai/client";
import { getStylePrompt } from './prompt-config';

// Configure Fal client
fal.config({
    credentials: process.env.FAL_API_KEY,
});

// Fal.ai 图片生成服务
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

export class FalImageService {
    async generateImage(params: ImageGenerationParams): Promise<ImageGenerationResult> {
        try {
            console.log('=== Generating image with Nano Banana Pro (Gemini 3 Pro Image) ===');
            console.log('Prompt:', params.prompt);
            console.log('Style:', params.style);
            console.log('Image size:', params.imageSize);

            // Enhance prompt with style if provided
            let basePrompt = params.prompt;
            if (params.style) {
                const stylePrompt = getStylePrompt(params.style);
                if (stylePrompt) {
                    basePrompt = `${params.prompt}, ${stylePrompt}`;
                }
            }

            // Enforce language constraints for the model
            const languageConstraint = " . IMPORTANT: Any text in the image must be strictly in Simplified Chinese or English only. High resolution, sharp focus, masterpiece.";
            const finalPrompt = basePrompt + languageConstraint;

            // Use Fal.ai Nano Banana Pro (Gemini 3 Pro Image)
            const model = "fal-ai/nano-banana-pro";

            // Map size to aspect ratio for Nano Banana
            let aspectRatio = "1:1";
            if (params.imageSize === 'portrait') aspectRatio = "3:4";
            if (params.imageSize === 'landscape') aspectRatio = "16:9";

            console.log(`Calling Fal.ai with model: ${model}, aspect_ratio: ${aspectRatio}`);

            const result: any = await fal.subscribe(model, {
                input: {
                    prompt: finalPrompt,
                    aspect_ratio: aspectRatio as "1:1" | "3:4" | "16:9",
                    num_images: params.numImages || 1,
                },
            });

            console.log('Fal.ai Nano Banana response success');

            // Handle response - Nano Banana returns { images: [{ url: ... }] }
            const images = result.images || result.data?.images || [];

            if (!images || images.length === 0) {
                throw new Error('No images returned from Fal.ai Nano Banana');
            }

            return {
                images: images.map((img: any) => ({
                    url: img.url,
                    width: img.width || (params.imageSize === 'portrait' ? 768 : (params.imageSize === 'landscape' ? 1024 : 1024)),
                    height: img.height || (params.imageSize === 'portrait' ? 1024 : (params.imageSize === 'landscape' ? 576 : 1024)),
                })),
            };
        } catch (error) {
            console.error('Fal.ai image generation error:', error);
            throw error;
        }
    }
}

// 导出默认实例
export const imageService = new FalImageService();
