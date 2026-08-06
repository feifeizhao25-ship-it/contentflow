
import { videoService } from './video-service';
import { videoMerger } from './video-merger-service';

export interface TrafficSandwichParams {
    userVideoUrl: string;
    productName: string;
    style?: string; // e.g. "High Energy", "Minimalist"
    aspectRatio?: '16:9' | '9:16' | '1:1';
}

export interface TrafficSandwichResult {
    url: string;
    status: 'completed' | 'failed' | 'processing';
    steps?: {
        name: string;
        status: 'pending' | 'completed' | 'failed';
    }[];
}

class TrafficSandwichService {

    async generateSandwich(
        params: TrafficSandwichParams,
        onProgress?: (progress: number, status: string) => void
    ): Promise<TrafficSandwichResult> {
        console.log('=== Starting Traffic Sandwich Generation ===');
        console.log('Params:', params);

        try {
            const { userVideoUrl, productName, style = 'High Energy', aspectRatio = '16:9' } = params;

            // 1. Generate Intro (Hook)
            onProgress?.(10, 'Generating High-Energy Hook...');
            const hookPrompt = `Commercial intro for ${productName}, ${style} style, text "${productName}", exciting, cinematic lighting, 4k`;
            console.log('Generating Hook:', hookPrompt);

            const hookResult = await videoService.generateVideo({
                scriptId: `hook_${Date.now()}`,
                scriptContent: hookPrompt,
                aspectRatio: aspectRatio,
                duration: 'short',
                domain: 'lifestyle',
                platform: 'douyin'
            });

            if (!hookResult?.videoUrl) throw new Error("Failed to generate Hook video");
            const hookUrl = hookResult.videoUrl;

            // 2. Generate Outro (CTA)
            onProgress?.(40, 'Generating Call-to-Action...');
            const ctaPrompt = `Commercial outro for ${productName}, ${style} style, text "Buy Now", smooth transition, logo animation, 4k`;
            console.log('Generating CTA:', ctaPrompt);

            const ctaResult = await videoService.generateVideo({
                scriptId: `cta_${Date.now()}`,
                scriptContent: ctaPrompt,
                aspectRatio: aspectRatio,
                duration: 'short',
                domain: 'lifestyle',
                platform: 'douyin'
            });

            if (!ctaResult?.videoUrl) throw new Error("Failed to generate CTA video");
            const ctaUrl = ctaResult.videoUrl;

            // 3. Merge Videos
            onProgress?.(70, 'Merging Sandwich...');
            const videoUrls = [hookUrl, userVideoUrl, ctaUrl];
            console.log('Merging URLs:', videoUrls);

            const mergeResult = await videoMerger.mergeVideos({
                videoUrls,
                aspectRatio,
                outputFormat: 'mp4'
            });

            if (mergeResult.status !== 'completed') throw new Error("Failed to merge videos");

            onProgress?.(100, 'Done!');

            return {
                url: mergeResult.url,
                status: 'completed'
            };

        } catch (error) {
            console.error('Traffic Sandwich failed:', error);
            throw error;
        }
    }
}

export const trafficSandwichService = new TrafficSandwichService();
