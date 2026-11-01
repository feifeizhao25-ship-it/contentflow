/**
 * 离线 BM25（标题字段加权 3 倍）：给“变好才上线”闸门做 with/without 对照检索，不依赖模型或网络。
 * 中文用字二元组（不引入分词库），英文用小写词；与 Python 三个产品里的同名模块同一口径。
 */
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]+/g;
const EN = /[a-z0-9]+/g;
const CN_STOP = new Set('的了是在有我你他她它们这那个一不也都很而会把被让给跟比等还对才能吗呢吧啊么怎要想该应什么哪些怎样如何可以'.split(''));
const EN_STOP = new Set('a an the and or of to in on for with is are be can i my me how what which do does should when why it its at as by from this that these those about into your you we our'.split(' '));

export function tokenize(text: string, lang: 'cn' | 'en' = 'cn'): string[] {
  const t = (text ?? '').toLowerCase();
  const out: string[] = [];
  if (lang === 'cn') {
    for (const run of t.match(CJK) ?? []) {
      const clean = [...run].filter((c) => !CN_STOP.has(c)).join('');
      for (let i = 0; i < clean.length - 1; i++) out.push(clean.slice(i, i + 2));
    }
  }
  for (const w of t.match(EN) ?? []) if (w.length > 1 && !EN_STOP.has(w)) out.push(w);
  return out;
}

export class BM25Index {
  private tf: Map<string, number>[] = [];
  private dl: number[] = [];
  private idf = new Map<string, number>();
  private avgdl = 0;
  constructor(docs: { heading: string; content: string }[], private lang: 'cn' | 'en' = 'cn', private k1 = 1.4, private b = 0.75, headingWeight = 3) {
    const df = new Map<string, number>();
    for (const d of docs) {
      const toks: string[] = [];
      for (let i = 0; i < headingWeight; i++) toks.push(...tokenize(d.heading, lang));
      toks.push(...tokenize(d.content, lang));
      const c = new Map<string, number>();
      for (const t of toks) c.set(t, (c.get(t) ?? 0) + 1);
      this.tf.push(c);
      this.dl.push(toks.length);
      for (const t of c.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    }
    const n = docs.length;
    this.avgdl = n ? this.dl.reduce((a, b) => a + b, 0) / n : 0;
    for (const [t, d] of df) this.idf.set(t, Math.log(1 + (n - d + 0.5) / (d + 0.5)));
  }
  query(q: string, topK = 10): { index: number; score: number }[] {
    const qc = new Map<string, number>();
    for (const t of tokenize(q, this.lang)) if (this.idf.has(t)) qc.set(t, (qc.get(t) ?? 0) + 1);
    if (!qc.size) return [];
    const res: { index: number; score: number }[] = [];
    this.tf.forEach((c, i) => {
      const norm = this.k1 * (1 - this.b + (this.b * this.dl[i]) / (this.avgdl || 1));
      let s = 0;
      for (const [t, qn] of qc) {
        const f = c.get(t);
        if (f) s += (this.idf.get(t)! * f * (this.k1 + 1)) / (f + norm) * (1 + 0.1 * (qn - 1));
      }
      if (s > 0) res.push({ index: i, score: s });
    });
    return res.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}
