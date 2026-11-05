import { joinVoiceText, resolveSpeechSource, INTL_TTS_ROUTES } from './voice-speech';

/**
 * Test note: international web has no TTS routes, so speech falls through to the browser.
 * The domestic app (web-cn) tries /api/ai/tts/{openai,azure,elevenlabs} first.
 * Empty text never calls fetch. The create page keeps the draft text separate from the speaker button.
 */

const audio = {
  ok: true,
  status: 200,
  headers: { get: (name: string) => (name === 'content-type' ? 'audio/mpeg' : null) },
  arrayBuffer: async () => new Uint8Array([9]).buffer,
};

it('does not invent a TTS route for the international app', () => {
  expect(INTL_TTS_ROUTES).toEqual([]);
});

it('appends speech after the brief', () => {
  expect(joinVoiceText('Launch', 'for designers')).toBe('Launch for designers');
  expect(joinVoiceText('  ', 'Hello')).toBe('Hello');
});

it('uses a TTS route when one returns audio, otherwise the browser', async () => {
  const calls: string[] = [];
  const fetchImpl = async (url: string) => {
    calls.push(url);
    if (url.endsWith('/azure')) return { ok: false, status: 501, headers: { get: () => 'application/json' }, arrayBuffer: async () => new ArrayBuffer(0) };
    return audio;
  };
  const plan = await resolveSpeechSource({
    text: 'Draft',
    language: 'en-US',
    routes: ['/api/ai/tts/azure', '/api/ai/tts/openai'],
    fetchImpl,
    browserAvailable: true,
  });
  expect(plan.source).toBe('tts-route');
  if (plan.source === 'tts-route') expect(plan.route).toBe('/api/ai/tts/openai');
  expect(calls).toEqual(['/api/ai/tts/azure', '/api/ai/tts/openai']);

  const browser = await resolveSpeechSource({
    text: 'Draft',
    language: 'en-US',
    routes: INTL_TTS_ROUTES,
    fetchImpl: async () => { throw new Error('should not fetch'); },
    browserAvailable: true,
  });
  expect(browser.source).toBe('browser');

  const blocked = await resolveSpeechSource({
    text: '   ',
    language: 'en-US',
    routes: ['/api/ai/tts/openai'],
    fetchImpl: async () => { throw new Error('should not fetch'); },
    browserAvailable: true,
  });
  expect(blocked.source).toBe('unavailable');
});
