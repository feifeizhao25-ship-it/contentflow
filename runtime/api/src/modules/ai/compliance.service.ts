import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { evaluateDomesticContent } from '../../common/domestic-content-compliance';
import { evaluateInternationalContent, evaluateInternationalRequest } from '../../common/international-content-compliance';
import type { TargetMarket } from '../../common/target-market';

export interface ComplianceOptions { conservative?: boolean; targetMarket?: TargetMarket | null; commercial?: boolean }

@Injectable()
export class ComplianceService {
  constructor(@Optional() private readonly config?: ConfigService) {}

  /** MARKET_REGION=global 走国际规则集，其余（含未设置）走国内规则集。 */
  isGlobal(): boolean {
    const region = this.config?.get<string>('MARKET_REGION') ?? process.env.MARKET_REGION;
    return String(region ?? '').trim().toLowerCase() === 'global';
  }

  async checkContent(content: string, options?: ComplianceOptions) {
    if (this.isGlobal()) return evaluateInternationalContent(content, options);
    return evaluateDomesticContent(content, options);
  }

  /**
   * International edition only: screens what the user asked for BEFORE any generation or quota hold. Blocks requests for
   * fake reviews or testimonials, fake followers or likes, removing the AI label, and synthetic endorsements by real people.
   * Does nothing in the China edition (its own rule set runs on the output).
   */
  guardRequest(...parts: Array<string | undefined | null>): void {
    if (!this.isGlobal()) return;
    const r = evaluateInternationalRequest(parts.filter((p): p is string => typeof p === 'string' && p.length > 0));
    if (!r.blocked) return;
    throw new BadRequestException({
      code: 'REQUEST_NOT_ALLOWED',
      message: 'We cannot help with this request. Fake reviews or testimonials, bought followers or likes, hiding the AI label, and synthetic endorsements by real people are unfair or deceptive practices. This is not legal advice.',
      ruleSetVersion: r.ruleSetVersion,
      hits: r.hits.map((h) => ({ ruleId: h.ruleId, reason: h.reason, source: h.source, sourceUrl: h.sourceUrl })),
    });
  }

  /**
   * 明确违规（block）才拦住生成。可能有风险（review）仍返回原文，由发布前确认处理。
   * 不再用星号掩盖风险后继续交付。
   */
  async scrubOutput(content: string, options?: ComplianceOptions): Promise<string> {
    if (this.isGlobal()) {
      const intl = evaluateInternationalContent(content, options);
      if (!intl.passed) {
        throw new BadRequestException({
          code: 'CONTENT_COMPLIANCE_BLOCKED',
          message: 'The generated content did not pass the pre-publish compliance check. Please edit the topic or text and try again. This is not legal advice.',
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
        message: '内容未通过发布前合规检查，请根据命中规则修改后重试。这不是法律意见。',
        ruleSetVersion: result.ruleSetVersion,
        level: result.level,
        disclaimer: result.disclaimer,
        hits: result.hits,
      });
    }
    return content;
  }
}
