import { NextRequest, NextResponse } from 'next/server';
import { fal } from "@fal-ai/client";

export async function GET(request: NextRequest) {
    try {
        // Configure fal
        fal.config({
            credentials: process.env.FAL_API_KEY,
        });

        console.log('=== Testing simple image generation ===');
        console.log('API Key configured:', !!process.env.FAL_API_KEY);
        console.log('API Key length:', process.env.FAL_API_KEY?.length);

        // Try the simplest Flux model
        const result: any = await fal.subscribe("fal-ai/flux/schnell", {
            input: {
                prompt: "A beautiful sunset",
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
        console.error('Error response:', error.response);
        console.error('Error status:', error.status);
        console.error('Error body:', error.body);

        return NextResponse.json({
            success: false,
            error: error.message,
            errorType: error.constructor.name,
            status: error.status,
            body: error.body,
        }, { status: 500 });
    }
}
