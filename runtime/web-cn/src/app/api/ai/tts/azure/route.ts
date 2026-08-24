import { NextRequest, NextResponse } from 'next/server';
import {
  assertUpstreamOk,
  requireAuth,
  requireKey,
  toErrorResponse,
} from '../../../_lib/provider';

/**
 * Azure 语音合成代理。
 *
 * Azure 收的是 SSML 而非 JSON，所以这里要把前端传来的
 * `{ voice, text, rate, pitch }` 组装成 SSML。
 * 返回音频二进制，前端 `response.blob()` 直接消费。
 */

export const runtime = 'nodejs';

const MAX_INPUT_CHARS = 5000;

/** SSML 是 XML，用户文本必须转义，否则一个 `&` 或 `<` 就会让整个请求失败 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** rate/pitch 只允许 `+10%` / `-5%` / `0%` 这类形式，避免把任意串拼进 SSML */
function sanitizeProsody(value: unknown, fallback: string): string {
  const s = String(value ?? '').trim();
  return /^[+-]?\d+(\.\d+)?%$/.test(s) ? s : fallback;
}

export async function POST(request: NextRequest) {
  try {
    requireAuth(request);
    const key = requireKey('Azure Speech', 'AZURE_SPEECH_KEY');
    const region = process.env.AZURE_SPEECH_REGION;
    if (!region) {
      return NextResponse.json(
        {
          error: 'Azure Speech 未配置：缺少 AZURE_SPEECH_REGION',
          code: 'PROVIDER_NOT_CONFIGURED',
          provider: 'Azure Speech',
          required_env: 'AZURE_SPEECH_REGION',
        },
        { status: 501 },
      );
    }

    const body = await request.json();
    const text = String(body?.text ?? '');
    if (!text.trim()) {
      return NextResponse.json({ error: 'text 不能为空' }, { status: 400 });
    }
    if (text.length > MAX_INPUT_CHARS) {
      return NextResponse.json(
        { error: `文本超出上限：${text.length} > ${MAX_INPUT_CHARS} 字符` },
        { status: 400 },
      );
    }

    const voice = String(body?.voice ?? 'zh-CN-XiaoxiaoNeural');
    const rate = sanitizeProsody(body?.rate, '0%');
    const pitch = sanitizeProsody(body?.pitch, '0%');
    const lang = voice.split('-').slice(0, 2).join('-') || 'zh-CN';

    const ssml =
      `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">` +
      `<voice name="${escapeXml(voice)}">` +
      `<prosody rate="${rate}" pitch="${pitch}">${escapeXml(text)}</prosody>` +
      `</voice></speak>`;

    const upstream = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'content-type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'fenfa-web-cn',
        },
        body: ssml,
        cache: 'no-store',
      },
    );

    await assertUpstreamOk(upstream, 'Azure Speech');

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
