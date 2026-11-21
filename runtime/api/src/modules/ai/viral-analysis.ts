/**
 * 爆款分析的结果整理（2026-11-21 真实 DeepSeek 测试后补）。
 *
 * 测试里看到两个问题：
 * 1. 国内 4/4 次分析被 1500 token 上限截断，JSON 解析失败，用户拿到一段半截的 JSON 字符串。
 * 2. 「糖尿病人也能放心吃」「医院同款」「cure fatigue」这类违规宣称拿到 8.5/10，还被做成「可复制模板」。
 *
 * 命中拦截级规则的文案不调模型，只返回确定性筛查结果（不给分、不给模板、写明命中规则）；
 * 只命中复核级规则时照常分析，但评分压到 6/10 以下，并标「需人工复核」；
 * 解析模型输出时容忍 ```json 包裹和截断。
 * 合规检查是关键词筛查，不是法律意见。
 */

export const VIRAL_MAX_TOKENS = 2500;

export interface ViralComplianceHit {
  ruleId: string;
  severity: 'block' | 'review';
  reason: string;
  matchedTerms: string[];
}

export interface ViralComplianceScreen {
  level: 'violation' | 'risk' | 'clear';
  hits: ReadonlyArray<ViralComplianceHit>;
}

/** 提示词末尾统一加的长度要求，减少被截断。 */
export function viralLengthHint(english: boolean): string {
  return english
    ? '\n\nReply with one JSON object only, no code fences. Keep each field under 80 words.'
    : '\n\n只输出一个 JSON 对象，不要用代码块包裹。每一项不超过 120 字。';
}

function stripFences(text: string): string {
  const trimmed = String(text ?? '').trim();
  const fenced = trimmed.match(/^```(?:json|JSON)?\s*([\s\S]*?)\s*(?:```\s*)?$/);
  return fenced ? fenced[1].trim() : trimmed;
}

/** 截断的 JSON 解析不了时，只保留到最后一个完整的行，避免把半个词、半个字段丢给用户。 */
function trimToLastFullLine(text: string): string {
  const cut = text.lastIndexOf('\n');
  return (cut > 0 ? text.slice(0, cut) : text).trimEnd();
}

export interface ParsedViral {
  analysis: Record<string, any>;
  truncated: boolean;
}

/**
 * completionTokens 达到上限（或解析失败）就当作被截断。
 * 能解析就返回对象；不能解析就返回 raw_analysis（截到最后完整一行）和一句说明。
 */
export function parseViralAnalysis(raw: string, opts: { completionTokens?: number; maxTokens: number; english: boolean }): ParsedViral {
  const body = stripFences(raw);
  if (!body) {
    return {
      analysis: { incomplete: true, notice: opts.english
        ? 'No complete analysis was returned this time. Please try a shorter piece of copy or try again later.'
        : '这次没有生成完整的分析。请换一段更短的文案，或稍后重试。' },
      truncated: true,
    };
  }
  const hitCap = Number(opts.completionTokens) >= opts.maxTokens * 0.98;
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return { analysis: parsed, truncated: false };
    return { analysis: { result: parsed }, truncated: false };
  } catch {
    const truncated = hitCap || !/[}\]]\s*$/.test(body);
    return {
      analysis: {
        raw_analysis: truncated ? trimToLastFullLine(body) : body,
        truncated,
        notice: truncated
          ? (opts.english
            ? 'The analysis ran long and was cut off, so only the complete part is shown. Try a shorter piece of copy for a full breakdown.'
            : '分析内容较长被截断了，这里只显示完整的部分。可以换一段更短的文案再试，获得完整拆解。')
          : (opts.english
            ? 'The analysis was not returned in the expected format, so it is shown as plain text.'
            : '分析结果不是预期的格式，这里按原文显示。'),
      },
      truncated,
    };
  }
}

/** 只命中复核级规则时，评分上限（10 分制）。 */
export const VIRAL_REVIEW_SCORE_CAP = 6;

const SCORE_KEY = /score|rating|评分|分数|打分|得分/i;

function capNumber(value: number): number {
  if (!Number.isFinite(value)) return value;
  // 模型有时用 100 分制
  if (value > 10 && value <= 100) return Math.min(value, VIRAL_REVIEW_SCORE_CAP * 10);
  return Math.min(value, VIRAL_REVIEW_SCORE_CAP);
}

/** 文本里的「8.5/10」「9 / 10」「92/100」也一并压到上限。 */
function capScoresInText(text: string): string {
  return text
    .replace(/(\d+(?:\.\d+)?)(\s*[/／]\s*100)(?!\d)/g, (m, n, tail) => `${Math.min(Number(n), VIRAL_REVIEW_SCORE_CAP * 10)}${tail}`)
    .replace(/(\d+(?:\.\d+)?)(\s*[/／]\s*10)(?!\d)/g, (m, n, tail) => `${Math.min(Number(n), VIRAL_REVIEW_SCORE_CAP)}${tail}`);
}

function capScores(value: any, underScoreKey: boolean, seen: { max: number | null }): any {
  if (typeof value === 'number') {
    if (!underScoreKey) return value;
    const capped = capNumber(value);
    const ten = capped > 10 ? capped / 10 : capped;
    seen.max = seen.max === null ? ten : Math.max(seen.max, ten);
    return capped;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (underScoreKey && /^\d+(?:\.\d+)?$/.test(trimmed)) return String(capScores(Number(trimmed), true, seen));
    return capScoresInText(value);
  }
  if (Array.isArray(value)) return value.map((item) => capScores(item, underScoreKey, seen));
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [key, item] of Object.entries(value)) out[key] = capScores(item, underScoreKey || SCORE_KEY.test(key), seen);
    return out;
  }
  return value;
}

function describeRules(hits: ReadonlyArray<ViralComplianceHit>, english: boolean): string {
  return hits.map((hit) => `${hit.ruleId}${english ? ` (${hit.matchedTerms.slice(0, 3).join(', ')})` : `（${hit.matchedTerms.slice(0, 3).join('、')}）`}`).join(english ? '; ' : '；');
}

/** 只命中复核级规则时，加到提示词末尾：评分不超过上限，模板不要照搬命中的表达。 */
export function viralReviewHint(screen: ViralComplianceScreen | null | undefined, english: boolean): string {
  const hits = (screen?.hits ?? []).filter((hit) => hit.severity === 'review');
  if (!hits.length) return '';
  const rules = describeRules(hits, english);
  return english
    ? `\n\nThis copy contains claims that need human review: ${rules}. Any score must be at most ${VIRAL_REVIEW_SCORE_CAP}/10, and the reusable template must not repeat these claims.`
    : `\n\n这段文案里有需要人工复核的表达：${rules}。评分不超过 ${VIRAL_REVIEW_SCORE_CAP}/10，可复制模板里不要照搬这些表达。`;
}

/**
 * 拦截级（block）：模型输出没有固定结构，评分或模板可能藏在任意字段、正文或截断文本里，
 * 所以不调模型、不给分、不给模板，只返回确定性的筛查结果。
 * 只有复核级（review）：保留分析，但所有评分压到 VIRAL_REVIEW_SCORE_CAP/10 以下，并标明「需人工复核」的规则。
 */
export function applyViralCompliance(analysis: Record<string, any>, screen: ViralComplianceScreen | null | undefined, english: boolean): Record<string, any> {
  const hits = (screen?.hits ?? []).map((hit) => ({ ruleId: hit.ruleId, severity: hit.severity, reason: hit.reason, matchedTerms: [...hit.matchedTerms] }));
  if (!hits.length) {
    return { ...analysis, compliance: { level: screen?.level ?? 'clear', hits: [], scoreAdjusted: false, templateWithheld: false } };
  }
  const blocking = hits.filter((hit) => hit.severity === 'block');
  if (!blocking.length) {
    const seen = { max: null as number | null };
    const capped = capScores(analysis ?? {}, false, seen);
    const reviewRuleIds = hits.map((hit) => hit.ruleId);
    const rules = describeRules(hits, english);
    return {
      ...capped,
      compliance: {
        level: screen?.level ?? 'risk',
        hits,
        needsHumanReview: true,
        reviewRuleIds,
        scoreAdjusted: true,
        scorePolicy: 'capped',
        scoreCap: VIRAL_REVIEW_SCORE_CAP,
        scoreScale: 10,
        templateWithheld: false,
        notice: english
          ? `Needs human review: this copy matched review rules ${rules}. Scores are capped at ${VIRAL_REVIEW_SCORE_CAP}/10. Check these claims before reusing the template. This is not legal advice.`
          : `需人工复核：这段文案命中复核规则 ${rules}。评分最高按 ${VIRAL_REVIEW_SCORE_CAP}/10 计。套用模板前请先核实这些表达。这不是法律意见。`,
      },
    };
  }
  const rules = describeRules(hits, english);
  return {
    appeal_score: null,
    reusable_template: null,
    compliance: {
      level: screen?.level ?? 'risk',
      hits,
      scoreAdjusted: true,
      scorePolicy: 'withheld',
      templateWithheld: true,
      notice: english
        ? `This copy matched compliance rules: ${rules}. No appeal score or reusable template is provided. Edit the flagged claims and run the analysis again. This is not legal advice.`
        : `这段文案命中合规规则：${rules}。不提供吸引力评分或可复制模板。请修改命中的宣称后重新分析。这不是法律意见。`,
    },
  };
}
