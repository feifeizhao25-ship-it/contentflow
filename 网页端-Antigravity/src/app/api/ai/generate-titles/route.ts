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
        const { topic, platform } = body;

        if (!topic) {
            return NextResponse.json(
                { error: '请提供主题或关键词' },
                { status: 400 }
            );
        }

        const aiService = new AIService();

        const platformNames: Record<string, string> = {
            xhs: '小红书 (爆款、Emoji、种草风格)',
            douyin: '抖音 (悬念、前3秒吸引、短快)',
            channels: '微信视频号 (社交性、生活化)',
            wechat: '微信公众号 (深度、标题党、好奇心)',
            bilibili: 'Bilibili (中长内容、硬核、描述型)',
            weibo: '微博 (热点、吃瓜、短句)',
            zhihu: '知乎 (专业性、提问式、干货)',
            toutiao: '今日头条 (社会新闻、对比式、高点击)',
            kuaishou: '快手 (接地气、老铁、兄弟)',
            baijiahao: '百家号 (正式、权威、SEO)',
        };

        const target = platformNames[platform] || '社交媒体';
        const customPrompt = `请为主题"${topic}"生成10个针对${target}平台的爆款标题。要求每个标题一行。`;

        // We can use the more flexible generateTitle with a prompt if we add it to AIService, 
        // or just use the existing one. Let's update AIService to be more flexible.
        // For now, I'll use generateArticle with a title-specific prompt to get better control.
        const result = await aiService.generateArticle({
            prompt: customPrompt,
            maxTokens: 500,
        });

        const titles = result.content
            .split('\n')
            .map(line => line.replace(/^\d+[\.、\s]*/, '').trim())
            .filter(line => line.length > 0)
            .slice(0, 10);

        return NextResponse.json({
            success: true,
            titles,
        });
    } catch (error: any) {
        console.error('Title generation error:', error);
        return NextResponse.json(
            { error: error.message || '标题生成失败' },
            { status: 500 }
        );
    }
}
