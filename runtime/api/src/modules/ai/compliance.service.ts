import { BadRequestException, Injectable } from '@nestjs/common';
import { evaluateDomesticContent } from '../../common/domestic-content-compliance';

@Injectable()
export class ComplianceService {
  async checkContent(content: string) {
    return evaluateDomesticContent(content);
  }

  /**
   * 兼容既有生成管线，但不再用星号掩盖风险后继续交付。
   * 命中任一道闸即失败关闭，由用户修改后重新生成。
   */
  async scrubOutput(content: string): Promise<string> {
    const result = evaluateDomesticContent(content);
    if (!result.passed) {
      throw new BadRequestException({
        code: 'CONTENT_COMPLIANCE_BLOCKED',
        message: '内容未通过发布前合规检查，请根据命中规则修改后重试',
        ruleSetVersion: result.ruleSetVersion,
        hits: result.hits,
      });
    }
    return content;
  }
}
