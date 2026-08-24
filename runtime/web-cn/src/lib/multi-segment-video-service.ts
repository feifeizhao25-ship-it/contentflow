import { fal } from "@fal-ai/client";
import { getStylePrompt } from './prompt-config';

export interface MultiSegmentVideoParams {
    prompt: string;
    style?: string;
    imageUrl: string;
    aspect_ratio: '16:9' | '9:16' | '1:1';
    totalDuration: number; // Total duration in seconds (max 60)
    segmentDuration?: 5 | 10; // Duration of each segment
}

export interface VideoSegment {
    url: string;
    segmentNumber: number;
    duration: number;
}

export interface MultiSegmentVideoResult {
    segments: VideoSegment[];
    finalVideoUrl?: string;
    status: 'generating' | 'merging' | 'completed' | 'failed';
    progress: number; // 0-100
}

// Configure Fal client
fal.config({
    credentials: process.env.FAL_API_KEY,
});

export class MultiSegmentVideoService {
    private static readonly MODEL_ID = "fal-ai/veo3.1";
    private static readonly REF_MODEL_ID = "fal-ai/veo3.1/reference-to-video";

    /**
     * Generate a multi-segment video by creating consistent segments and merging them
     */
    static async generateMultiSegmentVideo(
        params: MultiSegmentVideoParams,
        onProgress?: (progress: number, status: string) => void
    ): Promise<MultiSegmentVideoResult> {
        if (!process.env.FAL_API_KEY) {
            throw new Error('FAL_API_KEY is not configured');
        }

        const segmentDuration = params.segmentDuration || 5;
        const numSegments = Math.ceil(params.totalDuration / segmentDuration);

        // Enhance prompt with style if provided
        let basePrompt = params.prompt;
        if (params.style) {
            const stylePrompt = getStylePrompt(params.style);
            if (stylePrompt) {
                basePrompt = `${params.prompt}, ${stylePrompt}`;
            }
        }

        console.log(`=== Generating ${numSegments} segments for ${params.totalDuration}s video ===`);

        const segments: VideoSegment[] = [];

        try {
            // Generate each segment
            for (let i = 0; i < numSegments; i++) {
                const segmentProgress = (i / numSegments) * 80; // 0-80% for generation
                onProgress?.(segmentProgress, `Generating segment ${i + 1}/${numSegments}...`);

                console.log(`Generating segment ${i + 1}/${numSegments}...`);

                // but add segment-specific guidance
                const baseSegmentPrompt = i === 0
                    ? basePrompt
                    : `${basePrompt}, continuing from previous scene, smooth transition`;

                const modelId = params.imageUrl ? MultiSegmentVideoService.REF_MODEL_ID : MultiSegmentVideoService.MODEL_ID;
                const input: any = {
                    prompt: baseSegmentPrompt + " . Text must be in Simplified Chinese or English only.",
                    duration: segmentDuration >= 10 ? '8s' : '4s',
                    aspect_ratio: params.aspect_ratio || '16:9',
                };

                if (params.imageUrl) {
                    input.image_urls = [params.imageUrl];
                }

                const result: any = await fal.subscribe(modelId, {
                    input: input,
                    logs: true,
                    onQueueUpdate: (update) => {
                        console.log(`Segment ${i + 1} queue update:`, update.status);
                    },
                });

                const videoUrl = result.data?.video?.url || result.video?.url;

                if (!videoUrl) {
                    throw new Error(`Failed to generate segment ${i + 1}`);
                }

                segments.push({
                    url: videoUrl,
                    segmentNumber: i + 1,
                    duration: segmentDuration,
                });

                console.log(`Segment ${i + 1} generated:`, videoUrl);
            }

            // Now merge the segments
            onProgress?.(85, 'Merging video segments...');
            console.log('=== Merging segments ===');

            const finalVideoUrl = await this.mergeVideoSegments(segments, params.aspect_ratio);

            onProgress?.(100, 'Video generation completed!');

            return {
                segments,
                finalVideoUrl,
                status: 'completed',
                progress: 100,
            };
        } catch (error) {
            console.error('Multi-segment video generation error:', error);
            return {
                segments,
                status: 'failed',
                progress: 0,
            };
        }
    }

    /**
     * Merge video segments using professional video merger service
     */
    private static async mergeVideoSegments(
        segments: VideoSegment[],
        aspect_ratio: string
    ): Promise<string> {
        console.log('Merging video segments...');

        // If only one segment, no need to merge
        if (segments.length === 1) {
            return segments[0].url;
        }

        void aspect_ratio;
        throw new Error(
            'VIDEO_WORKER_NOT_CONFIGURED：多分镜合成需要持久化 Worker 和对象存储，未返回第一片段作为伪成片',
        );
    }

    /**
     * Generate a single extended video (alternative approach)
     * Some models support longer durations directly
     */
    static async generateExtendedVideo(params: MultiSegmentVideoParams): Promise<string> {
        console.log(`=== Generating extended ${params.totalDuration}s video ===`);

        // Clamp duration to model limits
        const duration = Math.min(params.totalDuration, 10);

        const modelId = params.imageUrl ? MultiSegmentVideoService.REF_MODEL_ID : MultiSegmentVideoService.MODEL_ID;
        const input: any = {
            prompt: params.prompt + " . Text must be in Simplified Chinese or English only.",
            duration: duration >= 10 ? '8s' : '4s',
            aspect_ratio: params.aspect_ratio || '16:9',
        };

        if (params.imageUrl) {
            input.image_urls = [params.imageUrl];
        }

        const result: any = await fal.subscribe(modelId, {
            input: input,
            logs: true,
            onQueueUpdate: (update) => {
                console.log('Queue update:', update.status);
            },
        });

        const videoUrl = result.data?.video?.url || result.video?.url;

        if (!videoUrl) {
            throw new Error('Failed to generate extended video');
        }

        return videoUrl;
    }
}

export const multiSegmentVideoService = {
    generateMultiSegmentVideo: MultiSegmentVideoService.generateMultiSegmentVideo.bind(MultiSegmentVideoService),
    generateExtendedVideo: MultiSegmentVideoService.generateExtendedVideo.bind(MultiSegmentVideoService),
};
