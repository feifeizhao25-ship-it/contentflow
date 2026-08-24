import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get('requestId');

    if (!requestId) {
        return NextResponse.json({ error: 'requestId required' }, { status: 400 });
    }

    const apiKey = process.env.FAL_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'FAL_API_KEY not configured' }, { status: 500 });
    }

    try {
        const url = `https://queue.fal.run/fal-ai/kling-video/v2.1/pro/text-to-video/requests/${requestId}`;
        console.log('Checking status for:', requestId);
        console.log('URL:', url);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Key ${apiKey}`,
            },
        });

        console.log('Response status:', response.status);
        const responseText = await response.text();
        console.log('Response body:', responseText);

        if (!response.ok) {
            return NextResponse.json({
                error: 'Fal.ai API error',
                status: response.status,
                body: responseText,
                url: url
            }, { status: 500 });
        }

        const data = JSON.parse(responseText);
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Test error:', error);
        return NextResponse.json({
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
