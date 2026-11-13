/**
 * 把金标准 / 留出集扩到国内六平台。
 * 每条答案的 must_include 都是 sources.registry.json 里的原文片段，不改写法律条文。
 * 写出的题全部 review_status=待审核，复核人留空，不发布。
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { CorpusPassage, loadPassages, uniqueAnchor } from './corpus';

export const DOMESTIC_PLATFORMS = ['小红书', '抖音', '视频号', '公众号', '哔哩哔哩', '知乎'] as const;

const SKILLS = [
  'topic-selection',
  'platform-copy',
  'title-cover',
  'schedule',
  'seo-aso-keywords',
  'geo-cn-search',
  'cn-fenfaxia-template-seo',
  'cn-fenfaxia-geo-monitor',
  'cn-fenfaxia-newterm-radar',
  'cn-fenfaxia-mp-article-draft',
  'cn-fenfaxia-video-script',
  'cn-fenfaxia-aso',
  'cn-growth-compliance-gate',
] as const;

const GOLDEN_TEMPLATES = [
  (platform: string, anchor: string) => `在${platform}发布前核对原文，这一句怎么写：「${anchor}」`,
  (platform: string, anchor: string) => `${platform}草稿要引用资料原句，请核对「${anchor}」是否在原文里`,
  (platform: string, anchor: string) => `给${platform}写说明时，只能照资料写，关键词「${anchor}」的原句是什么`,
];

const FROZEN_TEMPLATE = (platform: string, anchor: string) => `${platform}留出核对：资料里「${anchor}」那一句原文是什么`;

export interface AnchoredPassage {
  passage: CorpusPassage;
  anchor: string;
}

export function selectAnchoredPassages(passages = loadPassages(), limit = 10): AnchoredPassage[] {
  const corpus = passages.map((item) => item.text).join('\n');
  const picked: AnchoredPassage[] = [];
  const ranked = [...passages].sort((a, b) => b.text.length - a.text.length || a.id.localeCompare(b.id));
  for (const passage of ranked) {
    const anchor = uniqueAnchor(passage.text, corpus);
    if (!anchor || !passage.text.includes(anchor)) continue;
    picked.push({ passage, anchor });
    if (picked.length >= limit) break;
  }
  return picked;
}

export interface CorpusGoldenCase {
  id: string;
  skill: (typeof SKILLS)[number];
  area: 'rag';
  channel: 'corpus';
  platform: (typeof DOMESTIC_PLATFORMS)[number];
  corpus_id: string;
  question: string;
  expect: 'answer';
  must_include: string[];
  sources: { title: string; issuer: string; url: string; retrieved_at: string }[];
  lang: 'zh';
  review_status: '待审核';
  added_at: '2026-11-13';
}

export interface CorpusFrozenCase {
  id: string;
  query: string;
  expectCitations: 1;
  expectRefusal: false;
  platform: (typeof DOMESTIC_PLATFORMS)[number];
  corpus_id: string;
  must_include: string[];
  answer: string;
}

function pad(n: number): string {
  return String(n).padStart(4, '0');
}

export function buildCorpusGoldenCases(anchored = selectAnchoredPassages()): CorpusGoldenCase[] {
  const cases: CorpusGoldenCase[] = [];
  let n = 1;
  for (const platform of DOMESTIC_PLATFORMS) {
    for (const template of GOLDEN_TEMPLATES) {
      for (const item of anchored) {
        const skill = SKILLS[(n - 1) % SKILLS.length];
        cases.push({
          id: `cf-g-c-${pad(n)}`,
          skill,
          area: 'rag',
          channel: 'corpus',
          platform,
          corpus_id: item.passage.id,
          question: template(platform, item.anchor),
          expect: 'answer',
          must_include: [item.anchor],
          sources: [
            {
              title: item.passage.title,
              issuer: item.passage.issuer,
              url: item.passage.url,
              retrieved_at: item.passage.retrieved_at,
            },
          ],
          lang: 'zh',
          review_status: '待审核',
          added_at: '2026-11-13',
        });
        n += 1;
      }
    }
  }
  return cases;
}

export function buildCorpusFrozenCases(anchored = selectAnchoredPassages()): CorpusFrozenCase[] {
  const cases: CorpusFrozenCase[] = [];
  let n = 1;
  for (const platform of DOMESTIC_PLATFORMS) {
    for (const item of anchored) {
      cases.push({
        id: `cf-f-${pad(n)}`,
        query: FROZEN_TEMPLATE(platform, item.anchor),
        expectCitations: 1,
        expectRefusal: false,
        platform,
        corpus_id: item.passage.id,
        must_include: [item.anchor],
        answer: item.passage.text,
      });
      n += 1;
    }
  }
  return cases;
}

const GOLDEN_FILE = join(__dirname, '../../../../data/eval/golden_contentflow_zh.jsonl');
const FROZEN_FILE = join(__dirname, 'evals/frozen.jsonl');

export function writeCorpusSets(): { golden: number; frozen: number; anchored: number } {
  const anchored = selectAnchoredPassages();
  if (anchored.length < 10) throw new Error(`need 10 unique corpus anchors, got ${anchored.length}`);
  const goldenCases = buildCorpusGoldenCases(anchored);
  const frozenCases = buildCorpusFrozenCases(anchored);
  const goldenLines = readFileSync(GOLDEN_FILE, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.includes('"cf-g-c-'));
  const header = goldenLines[0].startsWith('#') ? goldenLines[0] : '# 分发侠 金标准问答集（待审核，无人签字）。每条带出处；拒答题不要求出处。';
  const body = goldenLines.filter((line) => !line.startsWith('#'));
  writeFileSync(GOLDEN_FILE, `${header}\n${body.join('\n')}\n${goldenCases.map((item) => JSON.stringify(item)).join('\n')}\n`, 'utf8');
  const frozenKept = readFileSync(FROZEN_FILE, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.includes('"cf-f-'));
  writeFileSync(FROZEN_FILE, `${frozenKept.join('\n')}\n${frozenCases.map((item) => JSON.stringify(item)).join('\n')}\n`, 'utf8');
  return { golden: body.length + goldenCases.length, frozen: frozenKept.length + frozenCases.length, anchored: anchored.length };
}
