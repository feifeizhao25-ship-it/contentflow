import { NextRequest, NextResponse } from 'next/server';
import { imageService } from '@/lib/image-service';
import { getTenantId } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
    try {
        const tenantId = await getTenantId();
        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized: 请先登录' }, { status: 401 });
        }

        const body = await request.json();
        const { prompt, negative_prompt, imageSize, style } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const result = await imageService.generateImage({
            prompt,
            style,
            negativePrompt: negative_prompt,
            imageSize: imageSize,
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Image generation error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
