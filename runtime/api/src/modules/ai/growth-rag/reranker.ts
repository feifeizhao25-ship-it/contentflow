import { FENFAXIA_DASHSCOPE_RERANK, FENFAXIA_MODELS } from '../domestic-model-router';

export interface RerankResult {
  scores: number[];
  reranker: 'local-overlap' | 'bge-reranker-v2-m3' | 'qwen3-rerank';
  fallback: boolean;
}

export interface RerankEnv {
  GROWTH_RERANKER_PROVIDER?: string;
  GROWTH_RERANKER_URL?: string;
  FENFAXIA_DASHSCOPE_API_KEY?: string;
  DASHSCOPE_API_KEY?: string;
  QWEN_API_KEY?: string;
}

export function localOverlapScore(query: string, text: string): number {
  const chars = new Set(query.replace(/\s+/g, ''));
  if (!chars.size) return 0;
  let hit = 0;
  const body = text.replace(/\s+/g, '');
  for (const ch of chars) if (body.includes(ch)) hit += 1;
  return hit / chars.size;
}

/** bge-reranker-v2-m3 只在地址已配置时请求，否则用字面重叠。 */
export async function rerankWithFallback(
  query: string,
  documents: string[],
  env: RerankEnv = process.env,
  fetchImpl?: typeof fetch,
): Promise<RerankResult> {
  const local = documents.map((doc) => localOverlapScore(query, doc));
  if (env.GROWTH_RERANKER_PROVIDER === 'qwen3-rerank') {
    const key = [env.FENFAXIA_DASHSCOPE_API_KEY, env.DASHSCOPE_API_KEY, env.QWEN_API_KEY].map((item) => String(item ?? '').trim()).find(Boolean);
    if (!key || !fetchImpl) return { scores: local, reranker: 'local-overlap', fallback: true };
    try {
      const response = await fetchImpl(FENFAXIA_DASHSCOPE_RERANK, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: FENFAXIA_MODELS.rerank,
          input: { query, documents },
          parameters: { top_n: documents.length },
        }),
      });
      if (!response.ok) throw new Error('reranker http');
      const payload = (await response.json()) as { output?: { results?: Array<{ index?: number; relevance_score?: number }> }; scores?: number[] };
      const scores = payload.scores
        ?? payload.output?.results?.slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map((item) => Number(item.relevance_score));
      if (!scores || scores.length !== documents.length || scores.some((score) => !Number.isFinite(score))) throw new Error('reranker shape');
      return { scores, reranker: 'qwen3-rerank', fallback: false };
    } catch {
      return { scores: local, reranker: 'local-overlap', fallback: true };
    }
  }
  const wantRemote = env.GROWTH_RERANKER_PROVIDER === 'bge-reranker-v2-m3';
  if (!wantRemote || !env.GROWTH_RERANKER_URL || !fetchImpl) {
    return { scores: local, reranker: 'local-overlap', fallback: wantRemote };
  }
  try {
    const response = await fetchImpl(env.GROWTH_RERANKER_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'bge-reranker-v2-m3', query, documents }),
    });
    if (!response.ok) throw new Error('reranker http');
    const payload = (await response.json()) as { scores?: number[] };
    if (!payload.scores || payload.scores.length !== documents.length) throw new Error('reranker shape');
    return { scores: payload.scores, reranker: 'bge-reranker-v2-m3', fallback: false };
  } catch {
    return { scores: local, reranker: 'local-overlap', fallback: true };
  }
}
