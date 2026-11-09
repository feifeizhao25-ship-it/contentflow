import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  ComplianceRuleDraft,
  complianceRuleCreateData,
  complianceRulePublishPatch,
  complianceRuleSignPatch,
} from './compliance-rule.record';

/** 唯一写入口：创建时不代填签署人；签署和发布都先过真人校验。 */
@Injectable()
export class ComplianceRuleService {
  constructor(private readonly prisma: PrismaService) {}

  create(draft: ComplianceRuleDraft) {
    return this.prisma.complianceRule.create({ data: complianceRuleCreateData(draft) });
  }

  async sign(id: string, reviewer: string) {
    const data = complianceRuleSignPatch(reviewer);
    return this.prisma.complianceRule.update({ where: { id }, data });
  }

  async publish(id: string) {
    const row = await this.prisma.complianceRule.findUnique({ where: { id }, select: { reviewer: true } });
    return this.prisma.complianceRule.update({
      where: { id },
      data: complianceRulePublishPatch(row ?? { reviewer: null }),
    });
  }
}
