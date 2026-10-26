import { FENFAXIA_DASHSCOPE_EMBED, FENFAXIA_MODELS } from '../domestic-model-router';
import { TextEmbedder } from './types';

export const EMBED_DIM = 32;

/** 测试与离线默认：字符二元组哈希，32 维，不访问网络。 */
export function localHashEmbed(text: string): number[] {
  const vec = new Array<number>(EMBED_DIM).fill(0);
  const value = text.toLowerCase();
  const grams = value.length === 0 ? [''] : value.length === 1 ? [value] : Array.from({ length: value.length - 1 }, (_, i) => value.slice(i, i + 2));
  for (const gram of grams) {
    let hash = 2166136261;
    for (const ch of gram) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
    vec[Math.abs(hash) % EMBED_DIM] += 1;
  }
  const norm = Math.sqrt(vec.reduce((sum, item) => sum + item * item, 0)) || 1;
  return vec.map((item) => item / norm);
}

export class LocalHashEmbedder implements TextEmbedder {
  id = 'local-hash' as const;
  async embed(text: string): Promise<number[]> {
    return localHashEmbed(text);
  }
}

export interface EmbedResult {
  vector: number[];
  embedder: 'local-hash' | 'bge-m3' | 'text-embedding-v4';
  fallback: boolean;
}

export interface EmbedEnv {
  GROWTH_EMBEDDING_PROVIDER?: string;
  GROWTH_EMBEDDING_URL?: string;
  FENFAXIA_DASHSCOPE_API_KEY?: string;
  DASHSCOPE_API_KEY?: string;
  QWEN_API_KEY?: string;
}

/**
 * bge-m3 只在供应商地址已配置时请求。地址缺失或请求失败时退回本地哈希。
 * 测试不要传入会访问外网的 fetch。
 */
export async function embedWithFallback(
  text: string,
  env: EmbedEnv = process.env,
  fetchImpl?: typeof fetch,
): Promise<EmbedResult> {
  if (env.GROWTH_EMBEDDING_PROVIDER === 'text-embedding-v4') {
    const key = [env.FENFAXIA_DASHSCOPE_API_KEY, env.DASHSCOPE_API_KEY, env.QWEN_API_KEY].map((item) => String(item ?? '').trim()).find(Boolean);
    if (!key || !fetchImpl) {
      return { vector: localHashEmbed(text), embedder: 'local-hash', fallback: true };
    }
    try {
      const response = await fetchImpl(FENFAXIA_DASHSCOPE_EMBED, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: FENFAXIA_MODELS.embed, input: text }),
      });
      if (!response.ok) throw new Error('embedder http');
      const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
      const embedding = payload.data?.[0]?.embedding;
      if (!embedding?.length) throw new Error('embedder empty');
      return { vector: embedding, embedder: 'text-embedding-v4', fallback: false };
    } catch {
      return { vector: localHashEmbed(text), embedder: 'local-hash', fallback: true };
    }
  }
  const wantBge = env.GROWTH_EMBEDDING_PROVIDER === 'bge-m3';
  if (!wantBge || !env.GROWTH_EMBEDDING_URL || !fetchImpl) {
    return { vector: localHashEmbed(text), embedder: 'local-hash', fallback: wantBge };
  }
  try {
    const response = await fetchImpl(env.GROWTH_EMBEDDING_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'bge-m3', input: text }),
    });
    if (!response.ok) throw new Error('embedder http');
    const payload = (await response.json()) as { embedding?: number[] };
    if (!payload.embedding?.length) throw new Error('embedder empty');
    return { vector: payload.embedding, embedder: 'bge-m3', fallback: false };
  } catch {
    return { vector: localHashEmbed(text), embedder: 'local-hash', fallback: true };
  }
}
