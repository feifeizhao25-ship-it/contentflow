/**
 * International web has no /api/ai/tts routes. Speech uses the browser.
 * The domestic app tries runtime/web-cn's existing TTS routes first, then the browser.
 * No provider keys and no feature gate.
 */

export const INTL_TTS_ROUTES: readonly string[] = [];

export const voiceLabelsEn = {
  mic: 'Voice input',
  listening: 'Listening. Tap to stop',
  speak: 'Read aloud',
  stop: 'Stop reading',
  unsupported: 'Voice is not available in this browser.',
  denied: 'Allow the microphone, then try again.',
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
      // Try the next route, then the browser.
    }
  }
  return options.browserAvailable ? { source: 'browser' } : { source: 'unavailable' };
}
