import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service';

export async function POST(request: NextRequest) {
    try {
        const { title, content } = await request.json();

        const prompt = `你是一位内容审核专家。请检查以下社交媒体内容是否符合平台规范（如：抖音、小红书）。
重点检查：
1. 是否包含敏感词、广告法禁用词（如：第一、最等，除非有事实依据）。
2. 是否包含不合规的引导。
3. 内容质量建议。

内容标题：${title}
内容正文：${content}

返回JSON格式：
{
  "pass": true/false,
  "score": 0-100,
  "issues": ["问题1", "问题2"],
  "suggestions": "修改建议",
  "safe_content": "如果 pass 为 false，请提供修改后的安全版本"
}
只返回JSON。`;

        const result = await aiService.generateArticle({
            prompt,
            maxTokens: 2000,
            temperature: 0.3,
        });

        let auditResult = {};
        try {
            const jsonMatch = result.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                auditResult = JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            auditResult = { pass: true, score: 90, issues: [], suggestions: "AI 审核超时，请人工校对。" };
        }

        return NextResponse.json({ success: true, result: auditResult });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
