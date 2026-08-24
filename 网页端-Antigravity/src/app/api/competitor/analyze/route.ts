import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const { platform, accountUrl, type = 'profile' } = await request.json();

        if (!platform || !accountUrl) {
            return NextResponse.json({ error: 'Platform and URL are required' }, { status: 400 });
        }

        console.log(`=== AI Competitor Analysis: ${platform} - ${accountUrl} ===`);

        const prompt = type === 'profile'
            ? `你是一位资深的短视频和社交媒体运营专家。
请分析一个在${platform}平台上的竞品账号（链接为：${accountUrl}）。
由于你无法直接访问实时互联网链接，请基于该平台目前的爆款逻辑、用户画像以及此类账号的典型特征，生成一份模拟的“深度竞争情报”。

分析要求包括：
1. 粉丝量和活跃度预估
2. 内容核心卖点（内容差异化）
3. 高频使用的爆款关键词与标签
4. 建议的对标策略

返回JSON格式：
{
  "name": "模拟竞品名称",
  "followers": "32.5W",
  "engagement_rate": "12.5%",
  "viral_logic": "通过什么吸引用户",
  "key_keywords": ["关键词1", "关键词2"],
  "content_strategy": "内容策略描述",
  "swot": {
    "strength": "优势",
    "weakness": "劣势",
    "opportunity": "机会",
    "threat": "威胁"
  },
  "suggestions": ["建议1", "建议2"]
}
只返回JSON，不要其他文字。`
            : `请深度拆解一个在${platform}平台上的爆款内容（链接：${accountUrl}）。
请从标题、封面、脚本结构、评论区引导四个维度进行分析。
并给出3个可直接复用的“爆款模版公式”。

返回JSON格式。`;

        const result = await aiService.generateArticle({
            prompt,
            maxTokens: 2000,
            temperature: 0.7,
        });

        let analysisData = {};
        try {
            const jsonMatch = result.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysisData = JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            throw new Error('AI 分析结果解析失败');
        }

        return NextResponse.json({
            success: true,
            data: analysisData
        });
    } catch (error: any) {
        console.error('Competitor analysis error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
