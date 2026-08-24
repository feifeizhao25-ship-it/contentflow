import { NextRequest, NextResponse } from 'next/server';
import {
  assertUpstreamOk,
  requireAuth,
  requireKey,
  toErrorResponse,
} from '../../_lib/provider';

/**
 * 短视频分镜脚本生成。
 *
 * 前端 `video-studio/page.tsx` 期待 `{ title, scenes[] }`，
 * 每个 scene 至少有 `visual`（画面描述，后续拿去生成视频）、
 * `subtitle`（字幕）、`time`（秒）。
 *
 * 用 OpenRouter —— 与 `src/lib/ai-service.ts` 里已有的文本生成同一家，
 * 不额外引入供应商。
 */

export const runtime = 'nodejs';
export const maxDuration = 120;

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_SCENES = 12;

function buildPrompt(topic: string, type: string, platform: string): string {
  return [
    `为「${platform}」平台创作一条「${type}」类短视频的分镜脚本，主题：${topic}`,
    '',
    '要求：',
    `1. 分镜 4–${MAX_SCENES} 个，总时长 30–90 秒`,
    '2. visual 用于驱动 AI 视频生成，必须是具体可视化的画面描述（场景、主体、镜头、光线），不要写抽象概念',
    '3. subtitle 是该分镜的口播/字幕文案，口语化',
    '4. time 是该分镜时长（秒，整数）',
    '',
    '只输出 JSON，不要 markdown 代码块，格式：',
    '{"title":"标题","scenes":[{"visual":"画面描述","subtitle":"字幕","time":6}]}',
  ].join('\n');
}

/** 模型有时会裹上 ```json 代码块或加前后缀，这里做一次容错提取 */
function extractJson(raw: string): any {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('模型未返回可解析的 JSON');
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAuth(request);
    const key = requireKey('OpenRouter', 'OPENROUTER_API_KEY');

    const body = await request.json();
    const topic = String(body?.topic ?? '').trim();
    if (!topic) {
      return NextResponse.json({ error: 'topic 不能为空' }, { status: 400 });
    }

    const upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        models: [
          process.env.OPENROUTER_MODEL || 'qwen/qwen3-30b-a3b-instruct-2507',
          ...(process.env.OPENROUTER_FALLBACK_MODELS || 'deepseek/deepseek-v3.2,google/gemini-2.5-flash-lite').split(',').map((item) => item.trim()).filter(Boolean),
        ],
        messages: [
          { role: 'system', content: '你是资深短视频编导，只输出 JSON。' },
          {
            role: 'user',
            content: buildPrompt(
              topic,
              String(body?.type ?? '爆款解说'),
              String(body?.platform ?? '抖音'),
            ),
          },
        ],
        temperature: 0.8,
        max_tokens: 2000,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'video_storyboard', strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'scenes'],
              properties: {
                title: { type: 'string' },
                scenes: {
                  type: 'array', minItems: 1, maxItems: MAX_SCENES,
                  items: {
                    type: 'object', additionalProperties: false,
                    required: ['visual', 'subtitle', 'time'],
                    properties: {
                      visual: { type: 'string' }, subtitle: { type: 'string' },
                      time: { type: 'integer', minimum: 1, maximum: 30 },
                    },
                  },
                },
              },
            },
          },
        },
        provider: { data_collection: 'deny', zdr: true, require_parameters: true },
      }),
      cache: 'no-store',
    });
    await assertUpstreamOk(upstream, 'OpenRouter');

    const payload = await upstream.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenRouter 未返回内容');
    }

    const parsed = extractJson(content);
    const scenes = Array.isArray(parsed?.scenes) ? parsed.scenes : [];
    if (scenes.length === 0) {
      // 宁可报错也不返回空脚本 —— 前端会拿它继续跑生成流程
      return NextResponse.json(
        { error: '模型未生成任何分镜', code: 'EMPTY_SCRIPT' },
        { status: 422 },
      );
    }

    return NextResponse.json({
      title: String(parsed?.title ?? topic),
      scenes: scenes.slice(0, MAX_SCENES).map((s: any) => ({
        visual: String(s?.visual ?? ''),
        subtitle: String(s?.subtitle ?? ''),
        time: Number.isFinite(Number(s?.time)) ? Number(s.time) : 6,
      })),
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
