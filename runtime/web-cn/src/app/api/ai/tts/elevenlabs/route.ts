import { NextRequest, NextResponse } from 'next/server';
import {
  assertUpstreamOk,
  requireAuth,
  requireKey,
  toErrorResponse,
} from '../../../_lib/provider';

/**
 * ElevenLabs 语音合成代理。
 *
 * 与另外两家不同，ElevenLabs 把 voice id 放在**路径**里，
 * 而前端统一在 body 里传 `voice`，所以这里要做一次搬运。
 */

export const runtime = 'nodejs';

const MAX_INPUT_CHARS = 5000;
/** voice id 会拼进 URL，必须限制字符集，避免路径注入 */
const VOICE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export async function POST(request: NextRequest) {
  try {
    requireAuth(request);
    const key = requireKey('ElevenLabs', 'ELEVENLABS_API_KEY');

    const body = await request.json();
    const text = String(body?.text ?? body?.input ?? '');
    if (!text.trim()) {
      return NextResponse.json({ error: 'text 不能为空' }, { status: 400 });
    }
    if (text.length > MAX_INPUT_CHARS) {
      return NextResponse.json(
        { error: `文本超出上限：${text.length} > ${MAX_INPUT_CHARS} 字符` },
        { status: 400 },
      );
    }

    const voiceId = String(body?.voice ?? body?.voice_id ?? '');
    if (!VOICE_ID_RE.test(voiceId)) {
      return NextResponse.json(
        { error: 'voice 不是合法的 ElevenLabs voice id' },
        { status: 400 },
      );
    }

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': key,
          'content-type': 'application/json',
          accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: body?.model_id ?? 'eleven_multilingual_v2',
          voice_settings: {
            stability: Math.min(Math.max(Number(body?.stability ?? 0.5), 0), 1),
            similarity_boost: Math.min(
              Math.max(Number(body?.similarity_boost ?? 0.75), 0),
              1,
            ),
          },
        }),
        cache: 'no-store',
      },
    );

    await assertUpstreamOk(upstream, 'ElevenLabs');

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
