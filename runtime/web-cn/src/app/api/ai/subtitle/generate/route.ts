import { NextRequest, NextResponse } from 'next/server';
import {
  assertUpstreamOk,
  requireAuth,
  requireKey,
  toErrorResponse,
} from '../../../_lib/provider';

/**
 * 音频转字幕（Whisper）。
 *
 * 前端 `src/lib/subtitle-service.ts` 读的是 `result.segments`，
 * 每段要有 `start` / `end` / `text` —— 对应 Whisper 的 `verbose_json`。
 *
 * 前端传的是 `audio_url`（音频已在别处上传），而 Whisper 只收 multipart
 * 文件上传，所以这里要先把音频取回来再转发。
 */

export const runtime = 'nodejs';
// 转写耗时随音频长度增长，默认 10s 的函数超时不够用
export const maxDuration = 300;

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';
const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // Whisper 的硬上限

/** 只允许 http(s)，且拒绝内网地址 —— 这个 URL 由客户端提供，等于一个 SSRF 入口 */
function assertSafeAudioUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('audio_url 不是合法的 URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('audio_url 只支持 http/https');
  }
  const host = url.hostname.toLowerCase();
  const isPrivate =
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||           // 云厂商元数据地址
    host === '[::1]';
  if (isPrivate) {
    throw new Error('audio_url 不能指向内网地址');
  }
  return url;
}

export async function POST(request: NextRequest) {
  try {
    requireAuth(request);
    const key = requireKey('OpenAI Whisper', 'OPENAI_API_KEY');

    const body = await request.json();
    const audioUrl = String(body?.audio_url ?? '');
    if (!audioUrl) {
      return NextResponse.json({ error: 'audio_url 不能为空' }, { status: 400 });
    }
    const safeUrl = assertSafeAudioUrl(audioUrl);

    const audioRes = await fetch(safeUrl, { cache: 'no-store', redirect: 'error' });
    await assertUpstreamOk(audioRes, '音频源');

    const declared = Number(audioRes.headers.get('content-length') ?? 0);
    if (declared > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: `音频超过 ${MAX_AUDIO_BYTES / 1024 / 1024}MB 上限` },
        { status: 400 },
      );
    }

    const audioBuffer = await audioRes.arrayBuffer();
    // content-length 可能缺失或撒谎，实际读到之后再校一次
    if (audioBuffer.byteLength > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: `音频超过 ${MAX_AUDIO_BYTES / 1024 / 1024}MB 上限` },
        { status: 400 },
      );
    }

    const filename = safeUrl.pathname.split('/').pop() || 'audio.mp3';
    const form = new FormData();
    form.append(
      'file',
      new Blob([audioBuffer], {
        type: audioRes.headers.get('content-type') ?? 'audio/mpeg',
      }),
      filename,
    );
    form.append('model', 'whisper-1');
    // 必须是 verbose_json，否则拿不到 segments 的时间戳
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'segment');
    if (body?.language) form.append('language', String(body.language));

    const upstream = await fetch(WHISPER_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
      body: form,
      cache: 'no-store',
    });
    await assertUpstreamOk(upstream, 'OpenAI Whisper');

    const result = await upstream.json();
    const segments = Array.isArray(result?.segments) ? result.segments : [];

    if (segments.length === 0) {
      // 明确区分「识别不出内容」与「接口坏了」，不要返回空数组让前端以为成功
      return NextResponse.json(
        {
          error: '未能从音频中识别出任何语音片段',
          code: 'NO_SPEECH_DETECTED',
          duration: result?.duration ?? null,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      segments: segments.map((s: any) => ({
        start: s.start,
        end: s.end,
        text: s.text,
      })),
      language: result?.language ?? null,
      duration: result?.duration ?? null,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
