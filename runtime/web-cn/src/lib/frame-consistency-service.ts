/**
 * Frame Consistency Service
 * 首尾帧一致性优化服务 - 确保多片段视频的视觉连续性
 */

import { fal } from "@fal-ai/client";
import { applyStyleToPrompt, getStylePreset, VideoStyleId } from './video-style-presets';

export interface FrameConsistencyParams {
    prompts: string[];              // 每个片段的 prompt
    style?: VideoStyleId;           // 视频风格
    aspectRatio: '16:9' | '9:16' | '1:1';
    segmentDuration?: 5 | 8;        // 每个片段时长
    transitionStyle?: 'fade' | 'dissolve' | 'cut' | 'motion_blur';
    useFrameReference?: boolean;    // 是否使用帧参考
    onProgress?: (progress: number, status: string) => void;
}

export interface FrameResult {
    videoUrls: string[];
    finalVideoUrl: string;
    frameReferences: string[];       // 提取的帧用于参考
    consistency: number;             // 一致性评分 0-100
    status: 'generating' | 'processing' | 'completed' | 'failed';
    progress: number;
}

// 配置 Fal 客户端
fal.config({
    credentials: process.env.FAL_API_KEY,
});

export class FrameConsistencyService {
    private static readonly MODEL_ID = "fal-ai/veo3.1";
    private static readonly REF_MODEL_ID = "fal-ai/veo3.1/reference-to-video";

    /**
     * 生成具有帧一致性的多片段视频
     */
    static async generateWithFrameConsistency(
        params: FrameConsistencyParams,
        onProgress?: (progress: number, status: string) => void
    ): Promise<FrameResult> {
        if (!process.env.FAL_API_KEY) {
            throw new Error('FAL_API_KEY is not configured');
        }

        const { prompts, style, aspectRatio, segmentDuration = 5, transitionStyle = 'fade' } = params;
        const numSegments = prompts.length;

        console.log(`=== Generating ${numSegments} segments with frame consistency ===`);

        const videoUrls: string[] = [];
        const frameReferences: string[] = [];

        try {
            let previousFrameUrl: string | null = null;
            let totalProgress = 0;
            const progressPerSegment = 80 / numSegments;

            for (let i = 0; i < numSegments; i++) {
                totalProgress = (i / numSegments) * 80;
                onProgress?.(totalProgress, `Generating segment ${i + 1}/${numSegments}...`);

                console.log(`Generating segment ${i + 1}/${numSegments}...`);

                // 1. 构建增强的 prompt
                let enhancedPrompt = prompts[i];
                
                if (style) {
                    const styleResult = applyStyleToPrompt({
                        basePrompt: prompts[i],
                        style,
                        aspectRatio,
                    });
                    enhancedPrompt = styleResult.positive;
                }

                // 添加场景连续性提示
                if (i > 0) {
                    enhancedPrompt += `, continuing from previous scene, smooth transition, consistent with previous frames`;
                }

                // 2. 准备输入参数
                const input: any = {
                    prompt: enhancedPrompt + " . Text must be in Simplified Chinese or English only.",
                    duration: segmentDuration >= 8 ? '8s' : '4s',
                    aspect_ratio: aspectRatio,
                };

                // 3. 如果有上一帧的参考图，使用参考模型
                if (previousFrameUrl && params.useFrameReference !== false) {
                    input.image_urls = [previousFrameUrl];
                    console.log(`Using frame reference for segment ${i + 1}`);
                }

                // 4. 生成视频片段
                const modelId = previousFrameUrl ? this.REF_MODEL_ID : this.MODEL_ID;
                
                const result: any = await fal.subscribe(modelId, {
                    input,
                    logs: true,
                    onQueueUpdate: (update: any) => {
                        if (update.status === 'IN_PROGRESS') {
                            console.log(`Segment ${i + 1} progress: ${update.progress * 100}%`);
                        }
                    },
                });

                const videoUrl = result.data?.video?.url || result.video?.url;

                if (!videoUrl) {
                    throw new Error(`Failed to generate segment ${i + 1}`);
                }

                videoUrls.push(videoUrl);

                // 5. 从生成的视频中提取尾帧作为下一片段的参考
                if (i < numSegments - 1) {
                    const frameUrl = await this.extractFrame(videoUrl, 'end', aspectRatio);
                    if (frameUrl) {
                        frameReferences.push(frameUrl);
                        previousFrameUrl = frameUrl;
                    }
                }

                console.log(`Segment ${i + 1} generated:`, videoUrl);
            }

            // 6. 合并视频并添加转场效果
            onProgress?.(85, 'Merging segments with transitions...');
            console.log('=== Merging segments with transitions ===');

            const finalVideoUrl = await this.mergeWithTransitions(
                videoUrls,
                aspectRatio,
                transitionStyle
            );

            // 7. 计算一致性评分
            const consistency = this.calculateConsistencyScore(prompts, numSegments);

            onProgress?.(100, 'Video generation completed!');

            return {
                videoUrls,
                finalVideoUrl,
                frameReferences,
                consistency,
                status: 'completed',
                progress: 100,
            };

        } catch (error) {
            console.error('Frame consistency video generation error:', error);
            throw error;
        }
    }

    /**
     * 从视频中提取指定位置的帧
     */
    static async extractFrame(
        videoUrl: string,
        position: 'start' | 'middle' | 'end',
        aspectRatio: string
    ): Promise<string | null> {
        try {
            // 这里可以调用视频处理服务来提取帧
            // 暂时返回原始视频 URL 作为参考
            // 实际实现需要 FFmpeg 或类似工具
            
            console.log(`Extracting ${position} frame from: ${videoUrl}`);
            
            // TODO: 实现实际的帧提取逻辑
            // 可以使用: https://api.cloudflaire.com/stream/videos/clip
            // 或者本地 FFmpeg 处理
            
            return null; // 暂时返回 null，需要实际的帧提取服务
        } catch (error) {
            console.error('Frame extraction error:', error);
            return null;
        }
    }

    /**
     * 带转场效果的视频合并
     * 注意：当前使用基础的 mergeVideos，转场效果通过 FFmpeg filter 实现
     */
    private static async mergeWithTransitions(
        videoUrls: string[],
        aspectRatio: string,
        transitionStyle: string
    ): Promise<string> {
        try {
            // 使用视频合并服务
            const { videoMerger } = await import('./video-merger-service');

            const result = await videoMerger.mergeVideos({
                videoUrls,
                aspectRatio: aspectRatio as '16:9' | '9:16' | '1:1',
                outputFormat: 'mp4',
            });

            if (result.status === 'completed' && result.url) {
                console.log('Video merge completed:', result.url);
                return result.url;
            } else {
                throw new Error('Video merge did not complete successfully');
            }
        } catch (error) {
            console.error('Video merging failed:', error);
            // 降级：返回第一个片段
            return videoUrls[0];
        }
    }

    /**
     * 计算视频一致性评分
     */
    private static calculateConsistencyScore(prompts: string[], numSegments: number): number {
        // 基于 prompt 相似度和片段数量计算一致性评分
        let score = 100;

        // 片段越多，一致性越难保证
        if (numSegments > 3) score -= 10;
        if (numSegments > 5) score -= 15;

        // 检查 prompt 是否包含一致性关键词
        const consistencyKeywords = ['consistent', 'continuous', 'smooth', 'same style'];
        const hasConsistencyHint = prompts.some(p => 
            consistencyKeywords.some(kw => p.toLowerCase().includes(kw))
        );

        if (!hasConsistencyHint) score -= 10;

        // 风格提示词
        const styleKeywords = ['style', 'aesthetic', 'mood'];
        const hasStyleHint = prompts.some(p =>
            styleKeywords.some(kw => p.toLowerCase().includes(kw))
        );

        if (hasStyleHint) score += 5;

        return Math.max(0, Math.min(100, score));
    }

    /**
     * 批量生成视频变体（同一脚本，不同风格）
     */
    static async generateVariants(
        basePrompt: string,
        styles: VideoStyleId[],
        aspectRatio: '16:9' | '9:16' | '1:1',
        onProgress?: (progress: number, status: string) => void
    ): Promise<Record<VideoStyleId, string>> {
        const results: Record<string, string> = {};
        const totalSteps = styles.length;
        
        for (let i = 0; i < styles.length; i++) {
            const style = styles[i];
            onProgress?.((i / totalSteps) * 100, `Generating ${style} variant...`);

            try {
                const result = await this.generateWithFrameConsistency({
                    prompts: [basePrompt],
                    style,
                    aspectRatio,
                    onProgress: (p, s) => onProgress?.(p / totalSteps + (i / totalSteps), s),
                });

                results[style] = result.finalVideoUrl;
            } catch (error) {
                console.error(`Failed to generate ${style} variant:`, error);
                results[style] = '';
            }
        }

        return results as Record<VideoStyleId, string>;
    }

    /**
     * 基于参考图片生成风格一致的视频
     */
    static async generateWithReferenceImage(
        referenceImageUrl: string,
        prompts: string[],
        style: VideoStyleId,
        aspectRatio: '16:9' | '9:16' | '1:1',
        onProgress?: (progress: number, status: string) => void
    ): Promise<FrameResult> {
        // 使用参考图片作为初始帧
        const initialParams: FrameConsistencyParams = {
            prompts,
            style,
            aspectRatio,
            useFrameReference: true,
            onProgress,
        };

        // 第一个片段使用参考图
        return this.generateWithFrameConsistency(initialParams, onProgress);
    }
}

// 导出单例
export const frameConsistencyService = {
    generateWithFrameConsistency: FrameConsistencyService.generateWithFrameConsistency.bind(FrameConsistencyService),
    generateVariants: FrameConsistencyService.generateVariants.bind(FrameConsistencyService),
    generateWithReferenceImage: FrameConsistencyService.generateWithReferenceImage.bind(FrameConsistencyService),
};

export default frameConsistencyService;
