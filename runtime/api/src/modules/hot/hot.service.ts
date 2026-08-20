import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class HotService {
  constructor(private readonly prisma: PrismaService) {}

  async getHotList(platform: string, category?: string) {
    return this.prisma.hotTopic.findMany({
      where: {
        platform,
        ...(category ? { category } : {}),
        crawled_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: [{ rank_position: 'asc' }, { heat_score: 'desc' }, { crawled_at: 'desc' }],
      take: 50,
    });
  }
}
