import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/supabase-server';

// FAL.AI API 配置
const FAL_API_KEY = process.env.FAL_API_KEY || 'b4694091-bbfc-4c3d-92fd-37187e74bc58:29f281ced5b472e8880779f1b651e9e8';
const FAL_API_URL = 'https://fal.run/fal-ai/nano-banana-pro';

export async function POST(request: NextRequest) {
    try {
        const tenantId = await getTenantId();
        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized: 请先登录' }, { status: 401 });
        }

        const body = await request.json();
        const { prompt, size, style, seed } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        // 解析尺寸
        const sizeMap: Record<string, { width: number; height: number }> = {
            '256x256': { width: 256, height: 256 },
            '512x512': { width: 512, height: 512 },
            '1024x1024': { width: 1024, height: 1024 },
            '1280x720': { width: 1280, height: 720 },
            '720x1280': { width: 720, height: 1280 },
        };
        const { width, height } = sizeMap[size || '1024x1024'] || { width: 1024, height: 1024 };

        // 增强提示词
        const styleEnhancements: Record<string, string> = {
            professional: 'Professional, clean, minimal, high quality, commercial photography style',
            humorous: 'Fun, vibrant, colorful, cartoon illustration style',
            xhs_influencer: 'Aesthetic, Instagram style, trendy, high saturation, warm tones',
            emotional: 'Warm, emotional, soft lighting, heartfelt',
            storytelling: 'Cinematic, storytelling, dramatic lighting, narrative scene',
            casual: 'Casual, lifestyle, natural light, relaxed atmosphere',
        };
        const enhancedPrompt = style && styleEnhancements[style]
            ? `${prompt}, ${styleEnhancements[style]}, 8k, high detail, masterpiece`
            : `${prompt}, high quality, 8k, masterpiece`;

        console.log('Generating image with fal.ai nano-banana-pro...');

        // 提交任务到 fal.ai
        const submitResponse = await fetch(FAL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Key ${FAL_API_KEY}`,
            },
            body: JSON.stringify({
                prompt: enhancedPrompt,
                image_size: { width, height },
                seed: seed || Math.floor(Math.random() * 1000000),
                num_images: 1,
            }),
        });

        if (!submitResponse.ok) {
            const error = await submitResponse.text();
            console.error('fal.ai submit error:', error);
            return NextResponse.json({ error: `fal.ai error: ${error}` }, { status: 500 });
        }

        const submitData = await submitResponse.json();
        const requestId = submitData.request_id;
        console.log(`fal.ai request submitted: ${requestId}`);

        // 轮询获取结果
        let result = null;
        const maxAttempts = 60; // 最多等待30秒
        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(resolve => setTimeout(resolve, 500));

            const statusResponse = await fetch(`${FAL_API_URL}/requests/${requestId}`, {
                headers: {
                    'Authorization': `Key ${FAL_API_KEY}`,
                },
            });

            if (!statusResponse.ok) {
                continue;
            }

            const statusData = await statusResponse.json();

            if (statusData.status === 'completed') {
                result = statusData;
                break;
            } else if (statusData.status === 'failed') {
                throw new Error(`fal.ai generation failed: ${statusData.error}`);
            }
        }

        if (!result) {
            return NextResponse.json({ error: 'Generation timeout' }, { status: 500 });
        }

        const imageUrl = result.images?.[0]?.url || result.image?.url;
        console.log(`fal.ai image generated: ${imageUrl}`);

        return NextResponse.json({
            url: imageUrl,
            revisedPrompt: enhancedPrompt,
        });
    } catch (error: any) {
        console.error('fal.ai image generation error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
