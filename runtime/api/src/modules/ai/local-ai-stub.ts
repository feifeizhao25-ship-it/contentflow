/**
 * 本地界面联调用的文本桩。
 * 只在非生产环境、且显式打开 AI_LOCAL_STUB=1 时生效。
 * 不访问任何模型供应商。生产环境一律关闭。
 */
export function localAiStubEnabled(env: { NODE_ENV?: string | null; AI_LOCAL_STUB?: string | null }): boolean {
  if (String(env.NODE_ENV ?? '') === 'production') return false;
  return String(env.AI_LOCAL_STUB ?? '') === '1';
}

export interface LocalStubCompletion {
  content: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

function topicFromPrompt(prompt: string): string {
  const titled = /主题：([^，\n]{1,80})/.exec(prompt);
  if (titled?.[1]?.trim()) return titled[1].trim();
  const quoted = /为"([^"]{1,80})"/.exec(prompt);
  if (quoted?.[1]?.trim()) return quoted[1].trim();
  return '本地联调选题';
}

/** 按提示词形态返回标题解析器和正文展示都能直接用的文本。 */
export function localStubCompletion(prompt: string): LocalStubCompletion {
  const topic = topicFromPrompt(prompt);
  if (/吸引人的标题/.test(prompt)) {
    const short = topic.replace(/\s+/g, '').slice(0, 12) || '本地选题';
    return {
      content: [1, 2, 3, 4, 5, 6].map((n) => `${short}手记${n}`).join('\n'),
      usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 },
    };
  }
  if (/爆款要素/.test(prompt)) {
    return {
      content: JSON.stringify({ 标题吸引力: '本地联调，不代表平台推荐', 开头钩子: topic.slice(0, 40) }),
      usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 },
    };
  }
  return {
    content: [
      `本地联调正文：${topic}`,
      '这段文字由本地文本桩生成，不是模型输出，也不会发到任何平台。',
      '---',
      'a quiet reading desk',
      'a paper notebook',
      'warm afternoon light',
    ].join('\n'),
    usage: { prompt_tokens: 40, completion_tokens: 80, total_tokens: 120 },
  };
}
