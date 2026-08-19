import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '@/lib/ai-service';
import { getTenantId } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
    try {
        const tenantId = await getTenantId();
        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized: 请先登录' }, { status: 401 });
        }

        const body = await request.json();
        const { topic, style, platform } = body;

        if (!topic) {
            return NextResponse.json(
                { error: '请提供主题或关键词' },
                { status: 400 }
            );
        }

        const aiService = new AIService();
        const { getPlatformStrategy } = await import('@/lib/viral-config');
        const strategy = getPlatformStrategy(platform);

        // --- Step 1: Viral Research & Reference Generation ---
        const researchPrompt = `你是一个资深的社交媒体运营专家。现在是2026年，请针对主题"${topic}"在平台"${strategy.name}"进行实时爆款作品调研。要求：总结当前该主题下排名为前列的爆款标题逻辑，并提取热门搜索关键词。`;
        const researchResult = await aiService.generateArticle({
            prompt: researchPrompt,
            style: 'professional',
        });
        const viralReferences = researchResult.content;

        // --- Step 2: Final Content Generation ---
        const platformPrompts: Record<string, string> = {
            xhs: `针对小红书。逻辑：${strategy.viralLogic}。参考：${viralReferences}。要求：黄金标题，Emoji丰富，亲切种草，含避坑/建议。`,
            douyin: `针对抖音视频。逻辑：${strategy.viralLogic}。参考：${viralReferences}。要求：前3秒强钩子，快节奏，神反转，字数精炼。`,
            zhihu: `针对知乎。逻辑：${strategy.viralLogic}。参考：${viralReferences}。要求：谢邀开头，硬核深度，逻辑清晰，有说服力。`,
        };

        const platformReq = platformPrompts[platform] || `适合在社交媒体发布。参考调研：${viralReferences}`;
        const finalPrompt = `任务：基于主题"${topic}"创作爆款内容。\n\n调研参考：\n${viralReferences}\n\n平台要求：\n${platformReq}\n\n文章结束后，请务必另起一行输出分隔符 "---VISUAL_PROMPTS_START---"，然后输出3个用于AI生图的英文提示词（Visual Prompt），每个提示词占一行，分别对应文章的开头、中间核心点和结尾场景。`;

        const result = await aiService.generateArticle({
            prompt: finalPrompt,
            style,
            maxTokens: 3000,
        });

        const rawContent = result.content;
        const splitRegex = /---?\s*VISUAL_PROMPTS_START\s*---?/i;
        const parts = rawContent.split(splitRegex);

        const content = parts[0].trim();
        const visualPromptsRaw = parts[1] ? parts[1].trim() : '';
        const visualPrompts = visualPromptsRaw
            .split('\n')
            .map(p => p.trim().replace(/^[\d\.\-\s]+/, ''))
            .filter(p => p.length > 0)
            .slice(0, 3); // Limit to 3 images

        return NextResponse.json({
            success: true,
            content: content,
            visualPrompts: visualPrompts.length > 0 ? visualPrompts : [topic], // Fallback to topic if no prompts
            usage: result.usage,
        });
    } catch (error: any) {
        console.error('Article generation error:', error);
        return NextResponse.json(
            { error: error.message || 'AI生成失败，请重试' },
            { status: 500 }
        );
    }
}
