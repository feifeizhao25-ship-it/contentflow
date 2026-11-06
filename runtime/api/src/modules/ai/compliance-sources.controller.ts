import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RagPolicyService } from './rag-policy.service';
import { ComplianceService } from './compliance.service';
import { AI_TRANSPARENCY_NOTE, INTERNATIONAL_RULESET_VERSION } from '../../common/international-content-compliance';

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
        notice: `International rule set ${INTERNATIONAL_RULESET_VERSION} (16 CFR Part 255, FTC Disclosures 101 PDF, UK ASA influencers' guide, EU AI Act Article 50). ${AI_TRANSPARENCY_NOTE} It is a keyword screen, not legal advice; review content yourself before publishing. AI-generated text carries a visible label. Generated images and videos are signed with C2PA on the server. No invisible text watermark is applied. No named reviewer has signed these sources off.`,
        userNotice: 'Checks are a screen only. Review your content before you publish. This is not legal advice.',
        maxAgeDays: 90,
        sources: [
          { name: '16 CFR Part 255 (eCFR)', url: 'https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-255', checkedBy: null, state: 'pending_review' },
          { name: 'FTC Disclosures 101 for Social Media Influencers (PDF)', url: 'https://www.ftc.gov/system/files/ftc_gov/pdf/1001A_Influencer%20Guide_508.pdf', checkedBy: null, state: 'pending_review' },
          { name: 'ASA Influencers\' guide to making clear that ads are ads', url: 'https://www.asa.org.uk/resource/influencers-guide.html', checkedBy: null, state: 'pending_review' },
          { name: 'EU AI Act Article 50 (EUR-Lex)', url: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj', checkedBy: null, state: 'pending_review' },
          { name: 'Commission Code of Practice on marking and labelling AI-generated content (2026-06-10, reference only)', url: 'https://digital-strategy.ec.europa.eu/en/news/commission-publishes-code-practice-marking-and-labelling-ai-generated-content', checkedBy: null, state: 'pending_review' },
          { name: 'Commission guidelines on Article 50, C(2026) 5054 final (2026-07-20)', url: 'https://ai-act-service-desk.ec.europa.eu/sites/default/files/2026-07/guidelines_on_the_implementation_of_the_transparency_obligations_for_certain_ai_systems_under_article_50_of_the_ai_act_bzptwqhk0ikg1dtlddap41psfy_131215.pdf', checkedBy: null, state: 'pending_review' },
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
