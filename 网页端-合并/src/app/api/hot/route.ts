import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service';
import { tophubService } from '@/lib/tophub-service';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
    try {
        console.log('=== Fetching Trending Topics ===');

        // 1. Try Real-time Data Source (Tophub)
        const realTrends = await tophubService.getAggregatedTrends();
        if (realTrends && realTrends.length > 0) {
            console.log(`Using real-time data from Tophub (${realTrends.length} items)`);
            return NextResponse.json({
                success: true,
                data: realTrends
            });
        }

        console.log('Real-time data unavailable (missing key or error), falling back to AI hallucination...');

        // 2. Fallback: AI Hallucination
        const today = new Date().toISOString().split('T')[0];

        const prompt = `你是一位全网热点趋势分析师。今天是${today}。
请分析并总结当前（2026年1月）全网最火的3个话题趋势。
话题应当涵盖：AI科技、生活方式、职场/职场技能、或者当季热梗。

返回JSON数组格式，每个对象包含：
- id: 随机ID
- topic: 话题标题
- platform: 来源平台(如: 抖音, 小红书, 全平台)
- heat_score: 热度分(0-100)
- trend: 'rising'(上升) | 'stable'(稳定) | 'falling'(下降)
- urgency: 'high' | 'medium' | 'low'
- related_hashtags: [标签1, 标签2]
- content_suggestions: [建议1, 建议2]
- expires_in: 时效描述(如: 2小时, 5小时, 1天)

只返回JSON代码块，不要其他文字。`;

        // Create a timeout promise to prevent hanging
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('AI generation timed out')), 25000)
        );

        let result;
        try {
            result = await Promise.race([
                aiService.generateArticle({
                    prompt,
                    maxTokens: 1000,
                    temperature: 0.7,
                }),
                timeoutPromise
            ]) as any;
        } catch (error) {
            console.error('AI generation failed or timed out:', error);
            // Result remains undefined, so we'll use fallback
        }

        let trends = [];
        if (result && result.content) {
            try {
                const jsonMatch = result.content.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    trends = JSON.parse(jsonMatch[0]);
                }
            } catch (e) {
                console.error('Failed to parse AI trends:', e);
            }
        }

        // 3. Final Fallback: Hardcoded Data
        if (trends.length === 0) {
            console.log('Using fallback trends');
            trends = [
                { id: '1', topic: '2026 AI助手进化论', platform: '全平台', heat_score: 95, trend: 'rising', urgency: 'high', related_hashtags: ['#AI助手', '#生产力'], content_suggestions: ['测评主流助手', '普通人的机会'], expires_in: '3小时' },
                { id: '2', topic: '极简慢生活挑战', platform: '小红书', heat_score: 88, trend: 'rising', urgency: 'medium', related_hashtags: ['#极简生活', '#解压'], content_suggestions: ['我的极简一角', '断舍离指南'], expires_in: '12小时' },
                { id: '3', topic: '数字游民的春节清单', platform: '全平台', heat_score: 82, trend: 'stable', urgency: 'low', related_hashtags: ['#数字游民', '#春节不打烊'], content_suggestions: ['推荐好用的远程办公工具', '分享春节期间的灵感瞬间'], expires_in: '5小时' }
            ];
        }

        return NextResponse.json({
            success: true,
            data: trends
        });
    } catch (error: any) {
        console.error('Hot topics API error:', error);
        return NextResponse.json({
            success: false,
            error: error.message,
            data: [
                { id: 'f1', topic: '全网科技趋势分析', platform: '全平台', heat_score: 90, trend: 'rising', urgency: 'high', related_hashtags: ['#科技趋势', '#AI时代'], content_suggestions: ['分析未来五年的技术走向', '讨论AI对就业的影响'], expires_in: '1天' }
            ]
        });
    }
}
