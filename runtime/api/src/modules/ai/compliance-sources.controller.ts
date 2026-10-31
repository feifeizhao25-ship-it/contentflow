import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RagPolicyService } from './rag-policy.service';
import { ComplianceService } from './compliance.service';
import { INTERNATIONAL_RULESET_VERSION } from '../../common/international-content-compliance';

/**
 * 合规规则资料的时效状态。资料超过时效（默认 30 天）未经人工复核时，
 * 进入保守模式：生成仍然可用，但不再引用过期资料，发布前须人工确认。
 * 管理员看复核说明，普通成员看短提示。
 */
@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai/compliance-sources')
export class ComplianceSourcesController {
  constructor(private readonly rag: RagPolicyService, private readonly compliance: ComplianceService) {}

  @Get('status')
  @ApiOperation({ summary: '合规规则资料时效状态（是否需要人工复核）' })
  async status() {
    if (this.compliance.isGlobal()) {
      // 国际版不使用中国平台规则资料；返回国际规则集自身的状态，且全部为英文。
      return {
        needsReview: true,
        mode: 'conservative',
        generationAvailable: true,
        notice: `International rule set ${INTERNATIONAL_RULESET_VERSION} (US FTC/FDA and UK CAP Code) is built in. It is a keyword screen, not legal advice; review content yourself before publishing.`,
        userNotice: 'Checks are a screen only. Review your content before you publish. This is not legal advice.',
        maxAgeDays: 90,
        sources: [
          { name: 'FTC Health Products Compliance Guidance', lastCheckedAt: '2026-10-31T00:00:00.000Z', checkedBy: 'engineering', state: 'fresh' },
          { name: 'FTC Endorsement Guides (16 CFR Part 255)', lastCheckedAt: '2026-10-31T00:00:00.000Z', checkedBy: 'engineering', state: 'fresh' },
          { name: 'FDA 21 CFR 101.93 (supplement claims)', lastCheckedAt: '2026-10-31T00:00:00.000Z', checkedBy: 'engineering', state: 'fresh' },
          { name: 'UK CAP Code', lastCheckedAt: '2026-10-31T00:00:00.000Z', checkedBy: 'engineering', state: 'fresh' },
        ],
      };
    }
    const report = await this.rag.freshnessReport();
    return {
      needsReview: report.needsReview,
      mode: report.mode,
      generationAvailable: report.generationAvailable,
      notice: report.notice,
      userNotice: report.userNotice,
      maxAgeDays: report.maxAgeDays,
      sources: report.sources.map((s) => ({ name: s.name, lastCheckedAt: s.lastCheckedAt, checkedBy: s.checkedBy, state: s.state })),
    };
  }
}
