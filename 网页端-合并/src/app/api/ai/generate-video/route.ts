import { NextRequest, NextResponse } from 'next/server';
import { videoService } from '@/lib/video-service';

export const maxDuration = 300; // 5 minutes timeout

export async function POST(request: NextRequest) {
    try {
        console.log('=== Video Generation API Called ===');
        const body = await request.json();
        console.log('Request body:', JSON.stringify(body, null, 2));

        const { prompt, aspect_ratio, imageUrl, style } = body;

        if (!prompt) {
            console.error('Error: Missing prompt');
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        console.log('Calling videoService.generateVideo with:');
        console.log('- Prompt:', prompt);
        console.log('- Style:', style);
        console.log('- Aspect ratio:', aspect_ratio);
        console.log('- Image URL:', imageUrl);

        const result = await videoService.generateVideo({
            scriptId: `gen_${Date.now()}`,
            scriptContent: prompt,
            style: style,
            aspectRatio: aspect_ratio || '16:9',
            domain: 'lifestyle',
            platform: 'douyin'
        });

        console.log('=== Video Generation Result ===');
        console.log(JSON.stringify(result, null, 2));

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('=== Video Generation API Error ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Error status:', error.status);
        console.error('Error body:', error.body);
        console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));

        return NextResponse.json({
            error: error.message || 'Video generation failed',
            details: {
                name: error.name,
                message: error.message,
                status: error.status,
                body: error.body,
            }
        }, { status: 500 });
    }
}
