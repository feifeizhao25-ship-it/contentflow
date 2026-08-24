import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const apiKey = process.env.FAL_API_KEY;
    console.log('Testing REST API with key length:', apiKey?.length);

    try {
        // 1. Submit request
        const submitRes = await fetch("https://queue.fal.run/fal-ai/flux/schnell", {
            method: "POST",
            headers: {
                "Authorization": `Key ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt: "A cute robot content creator, vector art, flat design",
                image_size: "square_hd"
            }),
        });

        console.log('Submit status:', submitRes.status);
        const submitData = await submitRes.json();
        console.log('Submit data:', submitData);

        if (!submitRes.ok) {
            return NextResponse.json({ error: 'Submit failed', details: submitData }, { status: submitRes.status });
        }

        const requestId = submitData.request_id;
        const statusUrl = submitData.status_url;

        // 2. Poll once (in real app we poll loop)
        const statusRes = await fetch(statusUrl, {
            headers: {
                "Authorization": `Key ${apiKey}`,
            },
        });
        const statusData = await statusRes.json();

        return NextResponse.json({
            success: true,
            requestId,
            statusData
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
