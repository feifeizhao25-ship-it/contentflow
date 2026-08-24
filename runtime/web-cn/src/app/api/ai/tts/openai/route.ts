import { NextRequest, NextResponse } from 'next/server';
import {
  assertUpstreamOk,
  requireAuth,
  requireKey,
  toErrorResponse,
} from '../../../_lib/provider';

/**
 * OpenAI TTS 代理。
 *
 * 前端 `src/lib/tts-service.ts` 调用后直接 `response.blob()`，
 * 所以这里必须原样透传音频字节 —— 任何 JSON 包装都会让 blob 变成一段文本。
 */

export const runtime = 'nodejs';

const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';
const MAX_INPUT_CHARS = 4096; // OpenAI 的硬上限，提前拦下比等它 400 更清楚

export async function POST(request: NextRequest) {
  try {
    requireAuth(request);
    const key = requireKey('OpenAI TTS', 'OPENAI_API_KEY');

    const body = await request.json();
    const input = String(body?.input ?? '');
    if (!input.trim()) {
      return NextResponse.json({ error: 'input 不能为空' }, { status: 400 });
    }
    if (input.length > MAX_INPUT_CHARS) {
      return NextResponse.json(
        { error: `文本超出上限：${input.length} > ${MAX_INPUT_CHARS} 字符` },
        { status: 400 },
      );
    }

    const upstream = await fetch(OPENAI_TTS_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: body?.model ?? 'tts-1',
        voice: body?.voice ?? 'alloy',
        input,
        // speed 合法区间 0.25–4.0，越界会被上游拒绝
        speed: Math.min(Math.max(Number(body?.speed ?? 1), 0.25), 4),
        response_format: 'mp3',
      }),
      cache: 'no-store',
    });

    await assertUpstreamOk(upstream, 'OpenAI TTS');

    // 直接透传字节流
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'audio/mpeg',
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
