import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RagPolicyService } from './rag-policy.service';

/**
 * 合规规则资料的时效状态。资料超过时效（默认 30 天）未经人工复核时，
 * 界面据此显示「合规规则资料需要人工复核」，生成结果不再引用这些资料。
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
      notice: report.notice,
      maxAgeDays: report.maxAgeDays,
      sources: report.sources.map((s) => ({ name: s.name, lastCheckedAt: s.lastCheckedAt, checkedBy: s.checkedBy, state: s.state })),
    };
  }
}
