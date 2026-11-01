/**
 * Forbidden-claim scanner shared by share cards and SEO pages.
 * Covers: medical efficacy, fate/future prediction, investment promises, absolute superlatives, fake-review wording.
 * Lists are intentionally conservative; a hit means "hold for human review", never "auto-fix".
 */
export type ClaimCategory = 'medical' | 'prediction' | 'investment' | 'absolute' | 'fake_review';

const EN: Record<ClaimCategory, RegExp[]> = {
  medical: [/\bcures?\b/gi, /\btreats?\s+(?:depression|anxiety|insomnia|disease|cancer|diabetes)/gi, /\bheals?\s+(?:disease|illness)/gi, /\breplaces?\s+(?:your\s+)?medication/gi, /\bclinically\s+proven\b/gi, /\bdiagnos(?:e|es|is)\b/gi],
  prediction: [/\bpredicts?\s+your\s+(?:fate|future|destiny)/gi, /\bguaranteed\s+(?:reading|prediction|accuracy)/gi, /\btells?\s+your\s+fortune\b/gi],
  investment: [/\bguaranteed\s+returns?\b/gi, /\brisk[- ]free\b/gi, /\bsure\s+profit/gi, /\b(?:we|our\s+\w+)\s+(?:give|gives|provide|provides|offer|offers)\s+investment\s+advice\b/gi],
  absolute: [/\bthe\s+best\s+in\s+the\s+world\b/gi, /(?<!\w)#1\b/gi, /\bonly\s+solution\b/gi],
  fake_review: [/\b(?:5|five)[- ]star\s+review\s+for\s+(?:a\s+)?free\b/gi, /\bpaid\s+reviews?\b/gi],
};
const ZH: Record<ClaimCategory, RegExp[]> = {
  medical: [/治愈/g, /治疗(?:抑郁|焦虑|失眠|疾病|癌|糖尿病)/g, /根治/g, /替代药物/g, /临床验证/g],
  prediction: [/算出(?:你的)?命运/g, /保证(?:算)?准/g, /预测(?:你的)?(?:财运|命运|前途)/g],
  investment: [/保证收益/g, /稳赚/g, /零风险/g, /包赚/g],
  absolute: [/全网第一/g, /唯一(?:方案|选择)/g, /最(?:好|强|佳)(?=的|产品|工具)/g],
  fake_review: [/好评返现/g, /刷(?:好评|单|量)/g],
};

/** Returns [category, matchedText] pairs over both languages. */
export function scanClaims(text: string): Array<[ClaimCategory, string]> {
  const hits: Array<[ClaimCategory, string]> = [];
  for (const table of [EN, ZH]) {
    for (const cat of Object.keys(table) as ClaimCategory[]) {
      for (const re of table[cat]) {
        for (const m of (text || '').matchAll(new RegExp(re.source, re.flags))) hits.push([cat, m[0]]);
      }
    }
  }
  return hits;
}

const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;
export const hasCjk = (text: string): boolean => CJK.test(text || '');
export const isEnglishOnly = (text: string): boolean => !hasCjk(text);
/** Chinese surface: must contain CJK; Latin is allowed for brand names, URLs, units. */
export const isChineseSurface = (text: string): boolean => hasCjk(text);
