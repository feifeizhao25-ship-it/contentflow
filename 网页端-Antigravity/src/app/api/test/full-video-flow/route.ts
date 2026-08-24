import { NextRequest, NextResponse } from 'next/server';
import { fal } from "@fal-ai/client";

export const maxDuration = 300; // 5 minutes timeout

export async function GET(request: NextRequest) {
    try {
        // Configure fal
        fal.config({
            credentials: process.env.FAL_API_KEY,
        });

        console.log('=== Testing complete video flow ===');

        // Step 1: Generate image
        console.log('Step 1: Generating image...');
        const imageResult: any = await fal.subscribe("fal-ai/flux/schnell", {
            input: {
                prompt: "A beautiful sunset over the ocean",
            },
        });

        console.log('Image result:', JSON.stringify(imageResult, null, 2));
        const imageUrl = imageResult.data?.images?.[0]?.url || imageResult.images?.[0]?.url;
        console.log('Image URL:', imageUrl);

        if (!imageUrl) {
            throw new Error('Failed to generate image');
        }

        // Step 2: Generate video from image
        console.log('Step 2: Generating video from image...');
        console.log('Using image URL:', imageUrl);

        const videoResult: any = await fal.subscribe("fal-ai/kling-video/v2.1/pro/image-to-video", {
            input: {
                image_url: imageUrl,
                prompt: "Ocean waves gently moving, cinematic",
                duration: '5',
            },
            logs: true,
            onQueueUpdate: (update) => {
                console.log('Video queue update:', JSON.stringify(update));
            },
        });

        console.log('=== Video Result ===');
        console.log(JSON.stringify(videoResult, null, 2));

        return NextResponse.json({
            success: true,
            imageUrl: imageUrl,
            videoUrl: videoResult.video?.url,
            videoResult: videoResult,
        });
    } catch (error: any) {
        console.error('=== Error ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error status:', error.status);
        console.error('Error body:', JSON.stringify(error.body, null, 2));

        return NextResponse.json({
            success: false,
            error: error.message,
            errorType: error.constructor.name,
            status: error.status,
            body: error.body,
        }, { status: 500 });
    }
}
