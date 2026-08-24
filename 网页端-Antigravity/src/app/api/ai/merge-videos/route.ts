import { NextRequest, NextResponse } from 'next/server';
import { videoMerger } from '@/lib/video-merger-service';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
    try {
        const { videoUrls, aspectRatio = '16:9' } = await request.json();

        if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
            return NextResponse.json({ error: 'videoUrls array is required' }, { status: 400 });
        }

        console.log(`Merging ${videoUrls.length} videos with aspect ratio ${aspectRatio}`);

        const result = await videoMerger.mergeVideos({
            videoUrls,
            aspectRatio: aspectRatio as '16:9' | '9:16' | '1:1',
            outputFormat: 'mp4'
        });

        if (result.status === 'completed' && result.url) {
            return NextResponse.json({ url: result.url });
        } else {
            return NextResponse.json({
                error: 'Merge failed',
                details: result
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error('Video merge API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
