/**
 * 爆款分析的结果整理（2026-11-21 真实 DeepSeek 测试后补）。
 *
 * 测试里看到两个问题：
 * 1. 国内 4/4 次分析被 1500 token 上限截断，JSON 解析失败，用户拿到一段半截的 JSON 字符串。
 * 2. 「糖尿病人也能放心吃」「医院同款」「cure fatigue」这类违规宣称拿到 8.5/10，还被做成「可复制模板」。
 *
 * 命中合规规则的文案不调模型，只返回确定性筛查结果（不给分、不给模板、写明命中规则）；
 * 没命中时解析模型输出（容忍 ```json 包裹和截断）。
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

/**
 * Model output has no enforced schema: a score/template can hide under arbitrary keys,
 * inside prose or in truncated JSON. Never try to remove it by key/regex alone.
 * For flagged copy, expose only the deterministic screen, not model-authored text.
 */
export function applyViralCompliance(analysis: Record<string, any>, screen: ViralComplianceScreen | null | undefined, english: boolean): Record<string, any> {
  const hits = (screen?.hits ?? []).map((hit) => ({ ruleId: hit.ruleId, severity: hit.severity, reason: hit.reason, matchedTerms: [...hit.matchedTerms] }));
  if (!hits.length) {
    return { ...analysis, compliance: { level: screen?.level ?? 'clear', hits: [], scoreAdjusted: false, templateWithheld: false } };
  }
  const rules = hits.map((hit) => `${hit.ruleId}${english ? ` (${hit.matchedTerms.slice(0, 3).join(', ')})` : `（${hit.matchedTerms.slice(0, 3).join('、')}）`}`).join(english ? '; ' : '；');
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
