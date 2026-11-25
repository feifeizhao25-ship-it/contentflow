import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { evaluateDomesticContent } from '../../common/domestic-content-compliance';
import { evaluateDomesticRequest } from '../../common/domestic-request-compliance';
import { evaluateInternationalContent, evaluateInternationalRequest } from '../../common/international-content-compliance';
import type { TargetMarket } from '../../common/target-market';

export interface ComplianceOptions { conservative?: boolean; targetMarket?: TargetMarket | null; commercial?: boolean }

type NamedHit = { ruleId: string; severity: 'block' | 'review'; reason: string; matchedTerms: string[] };

/**
 * 被拦时把命中的规则写进提示里。2026-11-21 真实测试：内容包被拦只回「请根据命中规则修改」，用户看不到是哪条规则、哪个词。
 * 只列 block 级（真正拦住的），最多 3 条，每条最多 3 个词。
 */
export function describeBlockingHits(hits: readonly NamedHit[], english: boolean): string {
  const blocking = hits.filter((hit) => hit.severity === 'block').slice(0, 3);
  if (!blocking.length) return '';
  const quote = (terms: string[]) => terms.slice(0, 3).map((t) => (english ? `"${t}"` : `“${t}”`)).join(english ? ', ' : '、');
  return blocking
    .map((hit) => english
      ? `${hit.ruleId} (${hit.reason.replace(/\.$/, '')}; matched ${quote(hit.matchedTerms)})`
      : `${hit.ruleId}（${hit.reason}；命中：${quote(hit.matchedTerms)}）`)
    .join(english ? '; ' : '；');
}

function publicHit(h: { ruleId: string; severity: 'block' | 'review'; reason: string; matchedTerms: string[]; sourceUrl?: string }): NamedHit & { sourceUrl?: string } {
  return { ruleId: h.ruleId, severity: h.severity, reason: h.reason, matchedTerms: h.matchedTerms, ...(h.sourceUrl ? { sourceUrl: h.sourceUrl } : {}) };
}

/** Prompt hint when the brief matched review-level rules: do not repeat or amplify those claims. */
export function globalReviewHint(hits: ReadonlyArray<NamedHit>): string {
  const review = hits.filter((h) => h.severity === 'review');
  if (!review.length) return '';
  const terms = [...new Set(review.flatMap((h) => h.matchedTerms))].slice(0, 6).map((t) => `"${t}"`).join(', ');
  return `\n\nCompliance: the brief contains claims that need substantiation (${terms}). Do not repeat, quote, or amplify these claims, and do not present them as facts or as a standard to demand; write around them in general, verifiable terms.`;
}

@Injectable()
export class ComplianceService {
  constructor(@Optional() private readonly config?: ConfigService) {}

  /** MARKET_REGION=global 走国际规则集，其余（含未设置）走国内规则集。 */
  isGlobal(): boolean {
    const region = this.config?.get<string>('MARKET_REGION') ?? process.env.MARKET_REGION;
    return String(region ?? '').trim().toLowerCase() === 'global';
  }

  async checkContent(content: string, options?: ComplianceOptions) {
    if (!this.isGlobal()) return evaluateDomesticContent(content, options);
    const output = evaluateInternationalContent(content, options);
    const request = evaluateInternationalRequest(content);
    if (!request.blocked) return output;
    const hits = [...request.hits, ...output.hits.filter((hit) => !request.hits.some((item) => item.ruleId === hit.ruleId))];
    const blocked = hits.some((hit) => hit.severity === 'block');
    const review = hits.some((hit) => hit.severity === 'review');
    return {
      ...output,
      passed: !blocked && !review,
      level: blocked ? 'violation' as const : review ? 'risk' as const : 'clear' as const,
      hits,
      hitCounts: {
        block: hits.filter((hit) => hit.severity === 'block').length,
        review: hits.filter((hit) => hit.severity === 'review').length,
        total: hits.length,
      },
    };
  }

  /**
   * Screens what the user asked for BEFORE any generation or quota hold.
   * Global: fake reviews or testimonials, fake followers or likes, removing the AI label, synthetic endorsements.
   * China: 刷单, 虚假好评, 虚构用户证言. Ordinary topics and explanations of why those acts are illegal still pass.
   */
  guardRequest(...parts: Array<string | undefined | null>): void {
    const text = parts.filter((p): p is string => typeof p === 'string' && p.length > 0);
    if (this.isGlobal()) {
      const r = evaluateInternationalRequest(text);
      if (!r.blocked) return;
      throw new BadRequestException({
        code: 'REQUEST_NOT_ALLOWED',
        message: 'We cannot help with this request. Fake reviews or testimonials, bought followers or likes, hiding the AI label, and synthetic endorsements by real people are unfair or deceptive practices. This is not legal advice.',
        ruleSetVersion: r.ruleSetVersion,
        hits: r.hits.map((h) => ({ ruleId: h.ruleId, severity: h.severity, reason: h.reason, source: h.source, sourceUrl: h.sourceUrl })),
      });
    }
    const domestic = evaluateDomesticRequest(text);
    if (!domestic.blocked) return;
    throw new BadRequestException({
      code: 'REQUEST_NOT_ALLOWED',
      message: '无法处理这个请求。虚假好评、刷单和虚构的用户证言不能代为生成。这不是法律意见。',
      ruleSetVersion: domestic.ruleSetVersion,
      hits: domestic.hits.map((h) => ({
        ruleId: h.ruleId,
        severity: h.severity,
        reason: h.reason,
        source: h.source,
        sourceUrl: h.sourceUrl,
        matchedTerms: h.matchedTerms,
      })),
    });
  }

  /**
   * International /create (generate/article): the same two gates the China viral flow uses.
   * Brief precheck: block-level hits stop before any quota hold or model call; review-level hits go on,
   * with a prompt hint not to repeat the flagged claims. Draft post-check: block-level hits withhold the
   * draft; review-level hits return it flagged "needs human review". Keyword screen, not legal advice.
   */
  precheckGlobalBrief(...parts: Array<string | undefined | null>): { level: 'risk' | 'clear'; hits: NamedHit[] } {
    const text = parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join('\n');
    const r = evaluateInternationalContent(text);
    if (r.level === 'violation') {
      throw new BadRequestException({
        code: 'CONTENT_COMPLIANCE_BLOCKED',
        stage: 'brief',
        message: `This brief was not sent for generation. It matched pre-publish compliance rules: ${describeBlockingHits(r.hits, true)}. Edit the brief and try again. This is not legal advice.`,
        ruleSetVersion: r.ruleSetVersion,
        level: r.level,
        disclaimer: r.disclaimer,
        hits: r.hits.map(publicHit),
      });
    }
    return { level: r.level === 'risk' ? 'risk' : 'clear', hits: r.hits.map(publicHit) };
  }

  postcheckGlobalDraft(content: string, brief: { hits: NamedHit[] }) {
    const r = evaluateInternationalContent(content);
    if (r.level === 'violation') {
      throw new BadRequestException({
        code: 'CONTENT_COMPLIANCE_BLOCKED',
        stage: 'draft',
        message: `The generated draft was withheld. It matched pre-publish compliance rules: ${describeBlockingHits(r.hits, true)}. Edit the brief and try again. This is not legal advice.`,
        ruleSetVersion: r.ruleSetVersion,
        level: r.level,
        disclaimer: r.disclaimer,
        hits: r.hits.map(publicHit),
      });
    }
    const reviewHits = [...brief.hits, ...r.hits.map(publicHit)].filter((h) => h.severity === 'review');
    const seen = new Set<string>();
    const hits = reviewHits.filter((h) => (seen.has(h.ruleId) ? false : (seen.add(h.ruleId), true)));
    return {
      level: hits.length ? ('risk' as const) : ('clear' as const),
      needsHumanReview: hits.length > 0,
      ruleSetVersion: r.ruleSetVersion,
      disclaimer: r.disclaimer,
      hits,
      notice: hits.length
        ? `Needs human review: the brief or draft matched review rules ${hits.map((h) => `${h.ruleId} (${h.matchedTerms.slice(0, 3).join(', ')})`).join('; ')}. Check these claims before using the draft. This is not legal advice.`
        : 'No rule in this screen matched. That does not mean the draft is cleared to publish; review it yourself. This is not legal advice.',
    };
  }

  /**
   * 明确违规（block）才拦住生成。可能有风险（review）仍返回原文，由发布前确认处理。
   * 不再用星号掩盖风险后继续交付。
   */
  async scrubOutput(content: string, options?: ComplianceOptions): Promise<string> {
    if (this.isGlobal()) {
      const intl = evaluateInternationalContent(content, options);
      if (intl.level === 'violation') {
        throw new BadRequestException({
          code: 'CONTENT_COMPLIANCE_BLOCKED',
          message: `The generated content did not pass the pre-publish compliance check. Rules matched: ${describeBlockingHits(intl.hits, true)}. Please edit the topic or text and try again. This is not legal advice.`,
          ruleSetVersion: intl.ruleSetVersion,
          level: intl.level,
          disclaimer: intl.disclaimer,
          hits: intl.hits,
        });
      }
      return content;
    }
    const result = evaluateDomesticContent(content, options);
    if (!result.passed) {
      throw new BadRequestException({
        code: 'CONTENT_COMPLIANCE_BLOCKED',
        message: `AI 生成的内容未通过发布前合规检查。命中规则：${describeBlockingHits(result.hits, false)}。请换个说法或调整主题后重试。这不是法律意见。`,
        ruleSetVersion: result.ruleSetVersion,
        level: result.level,
        disclaimer: result.disclaimer,
        hits: result.hits,
      });
    }
    return content;
  }
}
