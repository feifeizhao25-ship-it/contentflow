export interface RerankResult {
  scores: number[];
  reranker: 'local-overlap' | 'bge-reranker-v2-m3';
  fallback: boolean;
}

export interface RerankEnv {
  GROWTH_RERANKER_PROVIDER?: string;
  GROWTH_RERANKER_URL?: string;
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
  const wantRemote = env.GROWTH_RERANKER_PROVIDER === 'bge-reranker-v2-m3';
  const local = documents.map((doc) => localOverlapScore(query, doc));
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
