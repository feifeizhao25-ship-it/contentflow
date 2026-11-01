/**
 * 复测 B28：合规拦截后「按建议改写重试」。
 * 界面把被拦下的用语（matchedTerms）作为 avoidTerms 回传，本次生成的提示词里要求不得再出现这些词。
 * 这只是让模型避开；生成结果仍然要过同一道发布前合规检查，过不了照样被拦，不会因为带了 avoidTerms 就放行。
 */
export const AVOID_TERMS_MAX = 12;
export const AVOID_TERM_MAX_CHARS = 20;

export function sanitizeAvoidTerms(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    // eslint-disable-next-line no-control-regex
    const term = item.replace(/[\u0000-\u001f\u007f"“”「」]/g, '').trim();
    if (!term || term.length > AVOID_TERM_MAX_CHARS || out.includes(term)) continue;
    out.push(term);
    if (out.length >= AVOID_TERMS_MAX) break;
  }
  return out;
}

export function avoidTermsPromptBlock(terms: string[], global: boolean): string {
  if (!terms.length) return '';
  return global
    ? ` The previous draft was blocked by the pre-publication compliance check because of these words or phrases: ${terms.map((t) => `"${t}"`).join(', ')}. Do not use them or close variants; say it with plain, non-absolute, non-promissory wording instead.`
    : ` 上一版内容因以下用语被发布前合规检查拦下：${terms.map((t) => `「${t}」`).join('、')}。本次不得出现这些词及其变体，请改用不带绝对化、不夸大承诺的平实表达。`;
}
