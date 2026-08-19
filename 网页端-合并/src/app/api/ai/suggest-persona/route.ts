import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service';

export async function POST(request: NextRequest) {
    try {
        const { topic } = await request.json();

        const prompt = `作为一个品牌运营专家，请为话题《${topic}》推荐3个不同的自媒体人设（Persona）。
对于每个人设，请提供：
1. 人设名称（如：硬核技术宅、治愈系博主等）
2. 核心价值观
3. 语言风格（幽默、严谨、感性等）
4. 适合的平台（抖音、小红书、B站等）
5. 针对该话题的一句金句（Hook）

返回JSON数组格式。`;

        const result = await aiService.generateArticle({
            prompt,
            maxTokens: 1500,
            temperature: 0.8,
        });

        let personas = [];
        try {
            const jsonMatch = result.content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (jsonMatch) {
                personas = JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.error('Failed to parse personas', e);
        }

        return NextResponse.json({ success: true, personas });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
