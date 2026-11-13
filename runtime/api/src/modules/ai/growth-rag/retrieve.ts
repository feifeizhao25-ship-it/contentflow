import { embedWithFallback, EmbedEnv, localHashEmbed } from './embedder';
import { rerankWithFallback, RerankEnv } from './reranker';
import { usableSources } from './policy';
import { checkCitationEntities } from './citation-entities';
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

import { mt as marketNote } from '../../../common/i18n/market-text';

export interface RetrieveOptions {
  tenantId?: string | null;
  limit?: number;
  now?: Date;
  env?: EmbedEnv & RerankEnv;
  fetchImpl?: typeof fetch;
  /** 候选回答。只在被引原文能对上时才原样返回；对不上的句子不作为已引用内容。 */
  draft?: string;
}

export interface RetrieveResult {
  citations: Citation[];
  embedder: string;
  reranker: string;
  fallback: boolean;
  refused: boolean;
  note: string;
  /** 经过引用实体校验后的回答。不包含被引原文里没有的文号、标准号或平台名。 */
  answer: string;
}

/** 回答里对不上被引原文的那一句，换成这句，不把缺失的文号或平台名当成已引用。 */
export const CITATION_OMISSION_MARK = '「来源未包含此内容」';

export interface PresentedAnswer {
  text: string;
  missing: string[];
  /** 至少还留有一句被引原文能够支撑的话。 */
  supported: boolean;
}

/**
 * 增长 RAG 的回答出口。
 * 文号、标准号、平台名必须出现在被引原文里；某一句对不上，就整句标成「来源未包含此内容」，不改还对得上的句子。
 * 不调用模型。
 */
export function presentCitedAnswer(answer: string, citedTexts: string[]): PresentedAnswer {
  const raw = answer ?? '';
  const mark = marketNote(CITATION_OMISSION_MARK, 'The cited text does not contain this content');
  const check = checkCitationEntities(raw, citedTexts);
  if (check.ok) return { text: raw, missing: [], supported: raw.trim().length > 0 };
  const marked = raw
    .split(/(?<=[。！？\n])/)
    .map((part) => {
      if (!part) return part;
      if (checkCitationEntities(part, citedTexts).ok) return part;
      return part.endsWith('\n') ? `${mark}\n` : mark;
    })
    .join('')
    .replace(new RegExp(`(?:${mark.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?)+`, 'g'), mark);
  const supported = marked.split(mark).join('').trim().length > 0;
  return { text: marked, missing: check.missing, supported };
}

function visible(source: GrowthSource, tenantId?: string | null): boolean {
  if (!source.tenant_id) return true;
  return Boolean(tenantId) && source.tenant_id === tenantId;
}

/** 只返回当前租户可见、且通过校验的来源。没有证据时拒绝，不编造。 */
export async function retrieve(query: string, sources: GrowthSource[], options: RetrieveOptions = {}): Promise<RetrieveResult> {
  const pool = usableSources(sources, options.now).filter((source) => visible(source, options.tenantId));
  const refusal = marketNote('没有可用资料，不能下结论', 'No source is available, so no conclusion can be drawn');
  if (!pool.length) {
    return {
      citations: [],
      embedder: 'local-hash',
      reranker: 'local-overlap',
      fallback: false,
      refused: true,
      note: refusal,
      answer: refusal,
    };
  }
  const embedded = await embedWithFallback(query, options.env, options.fetchImpl);
  const queryVector = embedded.embedder === 'bge-m3' ? embedded.vector : localHashEmbed(query);
  const dense = pool.map((source) => ({
    source,
    score: embedded.embedder === 'bge-m3' ? 0 : cosine(queryVector, localHashEmbed(`${source.title}\n${source.text}`)),
  }));
  const reranked = await rerankWithFallback(query, pool.map((source) => source.text), options.env, options.fetchImpl);
  const ranked = dense
    .map((item, index) => ({ ...item, score: item.score + (reranked.scores[index] ?? 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 3);
  const combined = ranked.map((item) => ({
    source_id: item.source.source_id,
    url: item.source.url,
    title: item.source.title,
    excerpt: item.source.text.slice(0, 80),
    score: Number(item.score.toFixed(4)),
  }));
  const citedTexts = ranked.map((item) => item.source.text);
  const draft = options.draft === undefined ? citedTexts.join('\n') : options.draft;
  const presented = combined.length ? presentCitedAnswer(draft, citedTexts) : { text: refusal, missing: [], supported: false };
  const citedNote = marketNote('引用仅包含本次检索到的来源', 'Citations include only the sources retrieved for this request');
  const omittedNote = marketNote(CITATION_OMISSION_MARK, 'The cited text does not contain this content');
  return {
    citations: combined,
    embedder: embedded.embedder,
    reranker: reranked.reranker,
    fallback: embedded.fallback || reranked.fallback,
    refused: combined.length === 0,
    note: combined.length ? (presented.supported ? citedNote : omittedNote) : refusal,
    answer: combined.length ? presented.text : refusal,
  };
}
