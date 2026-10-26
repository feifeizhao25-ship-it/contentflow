import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RagPolicyService } from './rag-policy.service';

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
  constructor(private readonly rag: RagPolicyService) {}

  @Get('status')
  @ApiOperation({ summary: '合规规则资料时效状态（是否需要人工复核）' })
  async status() {
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
