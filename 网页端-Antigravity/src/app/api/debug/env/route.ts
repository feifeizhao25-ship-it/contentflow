import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const hasApiKey = !!process.env.FAL_API_KEY;
    const apiKeyLength = process.env.FAL_API_KEY?.length || 0;

    return NextResponse.json({
        hasApiKey,
        apiKeyLength,
        apiKeyPrefix: process.env.FAL_API_KEY?.substring(0, 10) + '...',
        nodeEnv: process.env.NODE_ENV,
    });
}
