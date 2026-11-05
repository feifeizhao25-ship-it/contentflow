/**
 * 国内网页的朗读顺序：先走已经存在的 /api/ai/tts/{openai,azure,elevenlabs}。
 * 这些路由目前返回 501 NOT_AVAILABLE_IN_CN，不向境外发请求。
 * 三条都不可用时，改用浏览器自带的语音合成。麦克风只用浏览器语音识别。
 * 不新增密钥，也不做功能开关。
 */

export const CN_TTS_ROUTES = [
  '/api/ai/tts/openai',
  '/api/ai/tts/azure',
  '/api/ai/tts/elevenlabs',
] as const;

export const voiceLabelsZh = {
  mic: '语音输入',
  listening: '正在听，再点停止',
  speak: '朗读',
  stop: '停止朗读',
  unsupported: '当前浏览器不能使用语音',
  denied: '需要允许麦克风后才能语音输入',
};

export type SpeechPlan =
  | { source: 'tts-route'; route: string; audio: ArrayBuffer; contentType: string }
  | { source: 'browser' }
  | { source: 'unavailable' };

type FetchLike = (url: string, init: RequestInit) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

/** 把识别结果接在已有文字后面，不覆盖已经写好的内容。 */
export function joinVoiceText(base: string, spoken: string): string {
  const extra = spoken.trim();
  if (!extra) return base;
  if (!base.trim()) return extra;
  return `${base.trimEnd()} ${extra}`;
}

export async function resolveSpeechSource(options: {
  text: string;
  language: string;
  routes: readonly string[];
  fetchImpl: FetchLike;
  browserAvailable: boolean;
}): Promise<SpeechPlan> {
  const text = options.text.trim();
  if (!text) return { source: 'unavailable' };
  for (const route of options.routes) {
    try {
      const response = await options.fetchImpl(route, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, language: options.language }),
      });
      const type = response.headers.get('content-type') || '';
      if (response.ok && type.startsWith('audio/')) {
        return { source: 'tts-route', route, audio: await response.arrayBuffer(), contentType: type };
      }
    } catch {
      // 下一条路由，最后才落到浏览器。
    }
  }
  return options.browserAvailable ? { source: 'browser' } : { source: 'unavailable' };
}
