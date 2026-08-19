import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const { topic, platform, type, length = '30s' } = await request.json();

        if (!topic) {
            return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
        }

        const apiKey = process.env.OPENROUTER_API_KEY || process.env.SILICONFLOW_API_KEY;
        const providerUrl = process.env.OPENROUTER_API_KEY
            ? 'https://openrouter.ai/api/v1/chat/completions'
            : 'https://api.siliconflow.cn/v1/chat/completions';

        const systemPrompt = `你是一位顶尖的短视频编剧，擅长在${platform || '抖音/小红书'}创作爆款视频。
你的任务是将用户提供的主题拆解为结构化的分镜脚本。
脚本必须包含：
1. 黄金3秒Hook：极致吸引力，留住用户。
2. 核心价值Body：干货或情绪价值。
3. 行动号召CTA：引导关注/点赞/评论。

请以 JSON 格式返回，包含 scenes 数组，每个 scene 包含：
- time: 建议秒数
- visual: 给 AI 视频生成模型的提示词 (英文，详细描述画面、灯光、镜头)
- subtitle: 视频字幕 (中文)
- audio: 配音引导 (语气词、情绪)

时长要求：${length}。
格式示例：
{
  "title": "标题",
  "scenes": [
    { "time": 3, "visual": "Cinematic shot of...", "subtitle": "别再这样做了！", "audio": "震惊语气" }
  ]
}`;

        const response = await fetch(providerUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: process.env.OPENROUTER_API_KEY ? 'deepseek/deepseek-chat' : 'deepseek-ai/DeepSeek-V3',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `我的主题是：${topic}。视频类型是：${type || '知识分享'}。` }
                ],
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`AI API failed: ${err}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;

        return NextResponse.json(JSON.parse(content));

    } catch (error: any) {
        console.error('Script generation error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
