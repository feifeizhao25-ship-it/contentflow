import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CompetitorService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompetitorAnalysis(tenantId: string, competitorId: string) {
    return {
      id: competitorId,
      name: '竞品账号',
      followers: 100000,
      engagementRate: 0.05,
      contentCount: 500,
    };
  }
}
