import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service';
import { PLATFORM_STRATEGIES } from '@/lib/viral-config';

export const maxDuration = 60;

// Platform publishing frequency recommendations (posts per week)
const PLATFORM_FREQUENCIES: Record<string, number> = {
    xhs: 7,        // 小红书：每天1篇（高频种草）
    douyin: 5,     // 抖音：每周5篇（工作日）
    channels: 3,   // 视频号：每周3篇
    wechat: 2,     // 公众号：每周2篇（深度内容）
    bilibili: 2,   // B站：每周2篇（精品视频）
    weibo: 7,      // 微博：每天1篇（热点追踪）
    zhihu: 1,      // 知乎：每周1篇（深度问答）
    toutiao: 3,    // 今日头条：每周3篇
    kuaishou: 5,   // 快手：每周5篇
    baijiahao: 2,  // 百家号：每周2篇
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { theme, platforms, weeksCount = 52 } = body;

        if (!theme) {
            return NextResponse.json({ error: 'Theme is required' }, { status: 400 });
        }

        console.log('=== Generating Annual Plan ===');
        console.log('Theme:', theme);
        console.log('Platforms:', platforms);
        console.log('Weeks:', weeksCount);

        // Build the AI prompt for annual plan generation
        const platformStrategies = platforms.map((p: string) => {
            const strategy = PLATFORM_STRATEGIES[p];
            const frequency = PLATFORM_FREQUENCIES[p] || 3;
            return `${p} (${strategy?.name || p}): ${frequency}篇/周 - ${strategy?.viralLogic || '优质内容'}`;
        }).join('\n');

        const prompt = `你是一位资深的内容营销策划专家。请为主题"${theme}"制定一个${weeksCount}周的全平台内容发布计划。

目标平台及发布频率：
${platformStrategies}

要求：
1. 根据每个平台的爆款特征和发布频率，生成具体的内容主题
2. 内容主题要符合2026年的趋势和各平台的爆款逻辑
3. 确保内容有连贯性和递进性，形成完整的营销闭环
4. 考虑节日、热点、季节性话题
5. 每个主题要具体、可执行，不要太宽泛

请以JSON格式返回，格式如下：
{
  "planName": "计划名称",
  "theme": "${theme}",
  "totalWeeks": ${weeksCount},
  "schedule": [
    {
      "week": 1,
      "startDate": "2026-01-06",
      "topics": [
        {
          "platform": "xhs",
          "title": "具体的内容标题",
          "style": "professional/humorous/emotional等",
          "reason": "为什么这个主题适合这个平台和时间点"
        }
      ]
    }
  ]
}

只返回JSON，不要其他说明文字。`;

        const result = await aiService.generateArticle({
            prompt,
            maxTokens: 4000,
            temperature: 0.8,
        });

        const response = result.content;

        console.log('AI Response:', response.substring(0, 500));

        // Parse the JSON response
        let planData;
        try {
            // Extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                planData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.error('Failed to parse AI response:', parseError);
            // Fallback: generate a basic plan
            planData = generateFallbackPlan(theme, platforms, weeksCount);
        }

        return NextResponse.json({
            success: true,
            plan: planData,
        });
    } catch (error: any) {
        console.error('Annual plan generation error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to generate annual plan',
        }, { status: 500 });
    }
}

// Fallback plan generator
function generateFallbackPlan(theme: string, platforms: string[], weeksCount: number) {
    const schedule = [];
    const startDate = new Date('2026-01-06'); // First Monday of 2026

    for (let week = 1; week <= Math.min(weeksCount, 12); week++) {
        const weekDate = new Date(startDate);
        weekDate.setDate(startDate.getDate() + (week - 1) * 7);

        const topics = platforms.flatMap((platform: string) => {
            const frequency = PLATFORM_FREQUENCIES[platform] || 3;
            const weekTopics = [];

            for (let i = 0; i < frequency; i++) {
                weekTopics.push({
                    platform,
                    title: `${theme} - 第${week}周内容${i + 1}`,
                    style: 'professional',
                    reason: `根据${platform}平台特性定制的内容`,
                });
            }

            return weekTopics;
        });

        schedule.push({
            week,
            startDate: weekDate.toISOString().split('T')[0],
            topics,
        });
    }

    return {
        planName: `${theme} - 年度内容计划`,
        theme,
        totalWeeks: weeksCount,
        schedule,
    };
}
