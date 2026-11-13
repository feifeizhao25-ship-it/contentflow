/**
 * 分发侠国内语料：只读已经登记在 sources.registry.json 里的原文摘录。
 * 不联网、不调用模型、不把候选写成已发布规则。
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export interface CorpusPassage {
  id: string;
  source_id: string;
  title: string;
  issuer: string;
  url: string;
  retrieved_at: string;
  text: string;
}

interface RegistrySource {
  source_id: string;
  url: string;
  title: string;
  text: string;
  publisher?: string;
  fetched_at?: string;
}

export function loadPassages(file = join(__dirname, 'sources.registry.json')): CorpusPassage[] {
  const registry = JSON.parse(readFileSync(file, 'utf8')) as { sources: RegistrySource[] };
  const out: CorpusPassage[] = [];
  for (const source of registry.sources) {
    const chunks = String(source.text)
      .split(/\n+/)
      .flatMap((block) => block.split(/(?<=。)/))
      .map((part) => part.trim())
      .filter((part) => part.length >= 20);
    chunks.forEach((text, index) => {
      out.push({
        id: `${source.source_id}#${index}`,
        source_id: source.source_id,
        title: source.title,
        issuer: source.publisher || source.title,
        url: source.url,
        retrieved_at: String(source.fetched_at ?? '2026-11-06').slice(0, 10),
        text,
      });
    });
  }
  return out;
}

export function passageById(id: string, passages = loadPassages()): CorpusPassage | undefined {
  return passages.find((item) => item.id === id);
}

/** 在问句里找一段只属于某一条原文的窗口，用来做离线检索（不调用模型）。 */
export function uniqueAnchor(text: string, corpus: string): string | null {
  const compact = text.replace(/\s+/g, '');
  for (let len = 12; len <= 18; len += 1) {
    for (let i = 0; i + len <= compact.length; i += 1) {
      const slice = compact.slice(i, i + len);
      if (/[，。；：、？！「」《》\s]/.test(slice)) continue;
      let count = 0;
      let from = 0;
      while (count < 2) {
        const at = corpus.indexOf(slice, from);
        if (at < 0) break;
        count += 1;
        from = at + 1;
      }
      if (count === 1) return slice;
    }
  }
  return null;
}

function grams(text: string): Map<string, number> {
  const compact = text.replace(/\s+/g, '');
  const out = new Map<string, number>();
  for (let i = 0; i + 2 <= compact.length; i += 1) {
    const gram = compact.slice(i, i + 2);
    out.set(gram, (out.get(gram) ?? 0) + 1);
  }
  return out;
}

function longestWindow(query: string, text: string): number {
  const compact = query.replace(/\s+/g, '');
  const limit = Math.min(18, compact.length);
  for (let len = limit; len >= 8; len -= 1) {
    for (let i = 0; i + len <= compact.length; i += 1) {
      if (text.includes(compact.slice(i, i + len))) return len;
    }
  }
  return 0;
}

/** 离线检索：问句里的原文窗口越长，越优先。相同分数按编号稳定排序。 */
export function retrievePassages(query: string, passages: CorpusPassage[], k = 8): CorpusPassage[] {
  const queryGrams = grams(query);
  return passages
    .map((passage) => {
      const passageGrams = grams(passage.text);
      let overlap = 0;
      for (const [gram, count] of queryGrams) overlap += Math.min(count, passageGrams.get(gram) ?? 0);
      const score = longestWindow(query, passage.text) * 100 + overlap;
      return { passage, score };
    })
    .sort((a, b) => b.score - a.score || a.passage.id.localeCompare(b.passage.id))
    .slice(0, k)
    .map((item) => item.passage);
}
