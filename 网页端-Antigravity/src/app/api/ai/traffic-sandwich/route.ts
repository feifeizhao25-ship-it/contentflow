
import { NextRequest, NextResponse } from 'next/server';
import { trafficSandwichService } from '@/lib/traffic-sandwich-service';

export const maxDuration = 300; // 5 minutes timeout

export async function POST(request: NextRequest) {
    try {
        console.log('=== Traffic Sandwich API Called ===');
        const body = await request.json();
        const { userVideoUrl, productName, style, aspectRatio } = body;

        if (!userVideoUrl || !productName) {
            return NextResponse.json({
                error: 'userVideoUrl and productName are required'
            }, { status: 400 });
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    const result = await trafficSandwichService.generateSandwich(
                        { userVideoUrl, productName, style, aspectRatio },
                        (progress, status) => {
                            const data = JSON.stringify({ progress, status }) + '\n';
                            controller.enqueue(encoder.encode(data));
                        }
                    );

                    const finalData = JSON.stringify({
                        progress: 100,
                        status: 'completed',
                        result
                    }) + '\n';
                    controller.enqueue(encoder.encode(finalData));
                    controller.close();

                } catch (error: any) {
                    console.error('Traffic Sandwich API error:', error);
                    const errorData = JSON.stringify({
                        progress: 0,
                        status: 'failed',
                        error: error.message
                    }) + '\n';
                    controller.enqueue(encoder.encode(errorData));
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({
            error: error.message || 'Internal Server Error'
        }, { status: 500 });
    }
}
