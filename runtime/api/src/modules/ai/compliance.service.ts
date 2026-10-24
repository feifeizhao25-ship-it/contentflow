import { BadRequestException, Injectable } from '@nestjs/common';
import { evaluateDomesticContent } from '../../common/domestic-content-compliance';

@Injectable()
export class ComplianceService {
  async checkContent(content: string, options?: { conservative?: boolean }) {
    return evaluateDomesticContent(content, options);
  }

  /**
   * 明确违规（block）才拦住生成。可能有风险（review）仍返回原文，由发布前确认处理。
   * 不再用星号掩盖风险后继续交付。
   */
  async scrubOutput(content: string, options?: { conservative?: boolean }): Promise<string> {
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
