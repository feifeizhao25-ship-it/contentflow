import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ComplianceService } from './compliance.service';
import { RagPolicyService } from './rag-policy.service';

/**
 * 发布前检查的只读预览。明确违规与风险提示都返回给界面，不在这里放行发布。
 */
@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai/compliance')
export class ComplianceCheckController {
  constructor(
    private readonly compliance: ComplianceService,
    private readonly rag: RagPolicyService,
  ) {}

  @Post('check')
  @ApiOperation({ summary: '检查正文的合规级别（不发布）' })
  async check(@Body() body: { text?: string }) {
    const text = String(body?.text ?? '').trim().slice(0, 20000);
    const isGlobal = this.compliance.isGlobal();
    if (!text) throw new BadRequestException(isGlobal ? 'Please enter the text to check' : '请输入要检查的正文');
    let conservative = !isGlobal;
    if (!isGlobal) try {
      conservative = !!(await this.rag.freshnessReport()).needsReview;
    } catch {
      conservative = true;
    }
    const result = await this.compliance.checkContent(text, { conservative });
    // 规则命中数与未检查项一并返回：「clear」只代表这批规则没发现，不代表可以发布。
    const rulesChecked = 'rulesChecked' in result ? result.rulesChecked : undefined;
    const notChecked = 'notChecked' in result ? result.notChecked : undefined;
    return {
      passed: result.passed,
      level: result.level,
      disclaimer: result.disclaimer,
      mode: result.mode,
      ruleSetVersion: result.ruleSetVersion,
      ...(rulesChecked !== undefined ? { rulesChecked } : {}),
      ...(notChecked !== undefined ? { notChecked } : {}),
      hits: result.hits.map((hit) => ({
        ruleId: hit.ruleId,
        severity: hit.severity,
        reason: hit.reason,
        matchedTerms: hit.matchedTerms,
      })),
    };
  }
}
