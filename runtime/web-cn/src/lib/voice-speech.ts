/**
 * 国内网页的朗读顺序：先走已经存在的 /api/ai/tts/{openai,azure,elevenlabs}。
 * 这些路由目前返回 501 NOT_AVAILABLE_IN_CN，不向境外发请求。
 * 三条都不可用时，改用浏览器自带的语音合成。麦克风只用浏览器语音识别。
 * 不新增密钥，也不做功能开关，不接入新的付费语音服务。
 *
 * 送入语音合成的文字会去掉法定 AI 显式标识和常见 Markdown。
 * 界面展示、复制和导出仍使用原文，不在这里改存储内容。
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
  noChineseVoice: '这台设备或浏览器没有可用的中文语音，暂时不能朗读。',
  micUnsupported: '当前浏览器不支持语音识别，麦克风已停用。',
  micNetwork: '当前网络无法使用浏览器语音识别，麦克风已停用。没有改用其他付费语音服务。',
  micServiceBlocked: '浏览器不允许使用语音识别服务，麦克风已停用。',
  micNotAllowed: '浏览器没有获得麦克风权限，语音输入已停用。',
  nothingToRead: '去掉标识和格式符号后没有可朗读的文字。',
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

/** 只去掉开头和结尾的法定显式标识，正文里引用这句时保留。 */
export function stripExplicitAiLabel(text: string): string {
  let out = text.trim();
  let previous = '';
  while (out !== previous) {
    previous = out;
    out = out.replace(/^【\s*本内容由\s*AI\s*生成\s*】\s*/, '').replace(/\s*【\s*本内容由\s*AI\s*生成\s*】\s*$/, '').trim();
  }
  return out;
}

/**
 * 朗读前清理。不修改调用方持有的原文。
 * Markdown 链接保留可见文字；#、*、反引号不再读出来。
 */
export function prepareSpeechText(text: string): string {
  let out = stripExplicitAiLabel(text);
  out = out.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  out = out.replace(/```[\w-]*\n?([\s\S]*?)```/g, '$1');
  out = out.replace(/`([^`]*)`/g, '$1');
  out = out.replace(/\*\*([^*]+)\*\*/g, '$1');
  out = out.replace(/__([^_]+)__/g, '$1');
  out = out.replace(/(^|[\s])\*([^*\n]+)\*(?=[\s]|$)/g, '$1$2');
  out = out.replace(/^#{1,6}\s*/gm, '');
  out = out.replace(/[*#`]/g, '');
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
}

export function hasChineseVoice(voices: Array<{ lang?: string; name?: string }>): boolean {
  return voices.some((voice) => {
    const lang = (voice.lang || '').toLowerCase().replace(/_/g, '-');
    if (lang === 'zh' || lang.startsWith('zh-') || lang.startsWith('cmn')) return true;
    const name = voice.name || '';
    return /中文|普通话|粤语/.test(name) || /chinese/i.test(name);
  });
}

/** 浏览器不支持，或国内网络/权限类错误：调用方应停用麦克风。其他错误返回 null，不因此关掉按钮。 */
export function micRestrictionMessage(error: string | null | undefined): string | null {
  switch ((error || '').trim()) {
    case 'unsupported':
      return voiceLabelsZh.micUnsupported;
    case 'network':
      return voiceLabelsZh.micNetwork;
    case 'service-not-allowed':
      return voiceLabelsZh.micServiceBlocked;
    case 'not-allowed':
      return voiceLabelsZh.micNotAllowed;
    default:
      return null;
  }
}

export async function resolveSpeechSource(options: {
  text: string;
  language: string;
  routes: readonly string[];
  fetchImpl: FetchLike;
  browserAvailable: boolean;
}): Promise<SpeechPlan> {
  const text = prepareSpeechText(options.text);
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
