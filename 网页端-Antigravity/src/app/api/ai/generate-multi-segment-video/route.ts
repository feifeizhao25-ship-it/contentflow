import { NextRequest, NextResponse } from 'next/server';
import { multiSegmentVideoService } from '@/lib/multi-segment-video-service';

export const maxDuration = 300; // 5 minutes timeout

export async function POST(request: NextRequest) {
    try {
        console.log('=== Multi-Segment Video Generation API Called ===');
        const body = await request.json();
        console.log('Request body:', JSON.stringify(body, null, 2));

        const { prompt, imageUrl, aspect_ratio, totalDuration, style } = body;

        if (!prompt || !imageUrl) {
            console.error('Error: Missing required parameters');
            return NextResponse.json({
                error: 'Prompt and imageUrl are required'
            }, { status: 400 });
        }

        const duration = Math.min(totalDuration || 10, 60); // Max 60 seconds
        console.log('Generating multi-segment video:');
        console.log('- Prompt:', prompt);
        console.log('- Style:', style);
        console.log('- Aspect ratio:', aspect_ratio);
        console.log('- Total duration:', duration, 'seconds');
        console.log('- Image URL:', imageUrl);

        // Use streaming response to send progress updates
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    const result = await multiSegmentVideoService.generateMultiSegmentVideo(
                        {
                            prompt,
                            style,
                            imageUrl,
                            aspect_ratio: aspect_ratio || '16:9',
                            totalDuration: duration,
                            segmentDuration: 5, // Generate 5-second segments
                        },
                        (progress, status) => {
                            // Send progress updates
                            const data = JSON.stringify({ progress, status }) + '\n';
                            controller.enqueue(encoder.encode(data));
                        }
                    );

                    // Send final result
                    const finalData = JSON.stringify({
                        progress: 100,
                        status: 'completed',
                        result,
                    }) + '\n';
                    controller.enqueue(encoder.encode(finalData));
                    controller.close();
                } catch (error: any) {
                    console.error('Multi-segment video generation error:', error);
                    const errorData = JSON.stringify({
                        progress: 0,
                        status: 'failed',
                        error: error.message,
                    }) + '\n';
                    controller.enqueue(encoder.encode(errorData));
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (error: any) {
        console.error('=== Multi-Segment Video Generation API Error ===');
        console.error('Error:', error);

        return NextResponse.json({
            error: error.message || 'Video generation failed',
        }, { status: 500 });
    }
}
