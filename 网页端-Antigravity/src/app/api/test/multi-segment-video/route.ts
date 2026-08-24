import { NextRequest, NextResponse } from 'next/server';
import { multiSegmentVideoService } from '@/lib/multi-segment-video-service';

export const maxDuration = 300;

/**
 * Test endpoint for multi-segment video generation
 * Usage: GET /api/test/multi-segment-video?duration=15
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const duration = parseInt(searchParams.get('duration') || '15');

        console.log('=== Testing Multi-Segment Video Generation ===');
        console.log('Duration:', duration, 'seconds');

        // First, generate a test image
        const { fal } = await import('@fal-ai/client');
        fal.config({ credentials: process.env.FAL_API_KEY });

        console.log('Generating test image...');
        const imageResult: any = await fal.subscribe("fal-ai/flux/schnell", {
            input: {
                prompt: "A beautiful futuristic cityscape at sunset",
                image_size: 'landscape_16_9',
            },
        });

        const imageUrl = imageResult.data?.images?.[0]?.url || imageResult.images?.[0]?.url;
        console.log('Test image generated:', imageUrl);

        if (!imageUrl) {
            return NextResponse.json({
                error: 'Failed to generate test image'
            }, { status: 500 });
        }

        // Now generate multi-segment video
        console.log('Starting multi-segment video generation...');
        const result = await multiSegmentVideoService.generateMultiSegmentVideo(
            {
                prompt: "A beautiful futuristic cityscape at sunset, smooth camera pan",
                imageUrl,
                aspect_ratio: '16:9',
                totalDuration: duration,
                segmentDuration: 5,
            },
            (progress, status) => {
                console.log(`Progress: ${progress}% - ${status}`);
            }
        );

        console.log('=== Multi-Segment Video Generation Result ===');
        console.log(JSON.stringify(result, null, 2));

        return NextResponse.json({
            success: true,
            duration,
            segments: result.segments.length,
            result,
            message: result.finalVideoUrl
                ? 'Video generated and merged successfully!'
                : 'Video segments generated, but merging failed (using first segment)',
        });
    } catch (error: any) {
        console.error('=== Multi-Segment Video Test Error ===');
        console.error(error);

        return NextResponse.json({
            error: error.message || 'Test failed',
            details: error.stack,
        }, { status: 500 });
    }
}
