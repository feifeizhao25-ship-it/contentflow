import { NextRequest, NextResponse } from 'next/server';
import { fal } from "@fal-ai/client";

export async function GET(request: NextRequest) {
    try {
        // Configure fal
        fal.config({
            credentials: process.env.FAL_API_KEY,
        });

        console.log('=== Testing fal.subscribe ===');
        console.log('API Key configured:', !!process.env.FAL_API_KEY);

        // Test with a simple prompt
        const result = await fal.subscribe("fal-ai/kling-video/v2.1/pro/text-to-video", {
            input: {
                prompt: "A beautiful sunset over the ocean",
                aspect_ratio: "16:9",
                duration: 5,
            },
            logs: true,
            onQueueUpdate: (update) => {
                console.log('Queue update:', JSON.stringify(update));
            },
        });

        console.log('=== Result ===');
        console.log(JSON.stringify(result, null, 2));

        return NextResponse.json({
            success: true,
            result: result,
        });
    } catch (error: any) {
        console.error('=== Error ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);

        return NextResponse.json({
            success: false,
            error: error.message,
            errorType: error.constructor.name,
            stack: error.stack,
        }, { status: 500 });
    }
}
