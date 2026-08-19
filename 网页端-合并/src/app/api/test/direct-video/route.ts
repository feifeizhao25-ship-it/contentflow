import { NextRequest, NextResponse } from 'next/server';
import { fal } from "@fal-ai/client";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
    try {
        fal.config({
            credentials: process.env.FAL_API_KEY,
        });

        console.log('=== Direct Video Test ===');

        // Step 1: Generate a test image
        console.log('Generating test image...');
        const imageResult: any = await fal.subscribe("fal-ai/flux/schnell", {
            input: {
                prompt: "A beautiful landscape",
            },
        });

        const imageUrl = imageResult.data?.images?.[0]?.url || imageResult.images?.[0]?.url;
        console.log('Image URL:', imageUrl);

        if (!imageUrl) {
            return NextResponse.json({ error: 'Failed to generate image', imageResult }, { status: 500 });
        }

        // Step 2: Try to generate video
        console.log('Generating video from image...');
        console.log('Using model: fal-ai/kling-video/v2.1/pro/image-to-video');
        console.log('Image URL:', imageUrl);

        const videoResult: any = await fal.subscribe("fal-ai/kling-video/v2.1/pro/image-to-video", {
            input: {
                image_url: imageUrl,
                prompt: "Gentle camera movement, cinematic",
                duration: '5',
            },
            logs: true,
            onQueueUpdate: (update) => {
                console.log('Queue update:', JSON.stringify(update));
            },
        });

        console.log('=== Video Result ===');
        console.log(JSON.stringify(videoResult, null, 2));

        return NextResponse.json({
            success: true,
            imageUrl,
            videoUrl: videoResult.video?.url,
            fullResult: videoResult,
        });
    } catch (error: any) {
        console.error('=== Error ===');
        console.error('Type:', error.constructor.name);
        console.error('Message:', error.message);
        console.error('Status:', error.status);
        console.error('Body:', JSON.stringify(error.body, null, 2));
        console.error('Stack:', error.stack);

        return NextResponse.json({
            error: error.message,
            type: error.constructor.name,
            status: error.status,
            body: error.body,
            stack: error.stack,
        }, { status: 500 });
    }
}
