import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { evaluateDomesticContent } from '../../common/domestic-content-compliance';
import { evaluateInternationalContent } from '../../common/international-content-compliance';

@Injectable()
export class ComplianceService {
  constructor(@Optional() private readonly config?: ConfigService) {}

  /** MARKET_REGION=global 走国际规则集，其余（含未设置）走国内规则集。 */
  isGlobal(): boolean {
    const region = this.config?.get<string>('MARKET_REGION') ?? process.env.MARKET_REGION;
    return String(region ?? '').trim().toLowerCase() === 'global';
  }

  async checkContent(content: string, options?: { conservative?: boolean }) {
    if (this.isGlobal()) return evaluateInternationalContent(content, options);
    return evaluateDomesticContent(content, options);
  }

  /**
   * 明确违规（block）才拦住生成。可能有风险（review）仍返回原文，由发布前确认处理。
   * 不再用星号掩盖风险后继续交付。
   */
  async scrubOutput(content: string, options?: { conservative?: boolean }): Promise<string> {
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
