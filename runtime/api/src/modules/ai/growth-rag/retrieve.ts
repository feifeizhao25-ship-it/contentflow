import { embedWithFallback, EmbedEnv, localHashEmbed } from './embedder';
import { rerankWithFallback, RerankEnv } from './reranker';
import { usableSources } from './policy';
import { Citation, GrowthSource } from './types';

function cosine(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / Math.sqrt(na * nb);
}

export interface RetrieveOptions {
  tenantId?: string | null;
  limit?: number;
  now?: Date;
  env?: EmbedEnv & RerankEnv;
  fetchImpl?: typeof fetch;
}

export interface RetrieveResult {
  citations: Citation[];
  embedder: string;
  reranker: string;
  fallback: boolean;
  refused: boolean;
  note: string;
}

function visible(source: GrowthSource, tenantId?: string | null): boolean {
  if (!source.tenant_id) return true;
  return Boolean(tenantId) && source.tenant_id === tenantId;
}

/** 只返回当前租户可见、且通过校验的来源。没有证据时拒绝，不编造。 */
export async function retrieve(query: string, sources: GrowthSource[], options: RetrieveOptions = {}): Promise<RetrieveResult> {
  const pool = usableSources(sources, options.now).filter((source) => visible(source, options.tenantId));
  if (!pool.length) {
    return {
      citations: [],
      embedder: 'local-hash',
      reranker: 'local-overlap',
      fallback: false,
      refused: true,
      note: '没有可用资料，不能下结论',
    };
  }
  const embedded = await embedWithFallback(query, options.env, options.fetchImpl);
  const queryVector = embedded.embedder === 'bge-m3' ? embedded.vector : localHashEmbed(query);
  const dense = pool.map((source) => ({
    source,
    score: embedded.embedder === 'bge-m3' ? 0 : cosine(queryVector, localHashEmbed(`${source.title}\n${source.text}`)),
  }));
  const reranked = await rerankWithFallback(query, pool.map((source) => source.text), options.env, options.fetchImpl);
  const combined = dense
    .map((item, index) => ({ ...item, score: item.score + (reranked.scores[index] ?? 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 3)
    .map((item) => ({
      source_id: item.source.source_id,
      url: item.source.url,
      title: item.source.title,
      excerpt: item.source.text.slice(0, 80),
      score: Number(item.score.toFixed(4)),
    }));
  return {
    citations: combined,
    embedder: embedded.embedder,
    reranker: reranked.reranker,
    fallback: embedded.fallback || reranked.fallback,
    refused: combined.length === 0,
    note: combined.length ? '引用仅包含本次检索到的来源' : '没有可用资料，不能下结论',
  };
}
