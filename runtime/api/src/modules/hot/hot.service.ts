import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * 热点榜单。
 *
 * 目前没有接入任何真实的热点数据源（需要与持有平台数据授权的境内服务商签约，属于外部条件）。
 * 原来这里直接 return 两条写死的热点（「AI人工智能」热度 999999），前端还有第二份
 * 写死的热点作兜底——用户看到的「全网热点」全是编的。现在如实返回空列表与原因。
 */
@Injectable()
export class HotService {
  constructor(private readonly prisma: PrismaService) {}

  async getHotList(_platform?: string, _category?: string) {
    return {
      available: false,
      topics: [] as Array<{ id: string; topic: string; heat: number; platform: string }>,
      message: '热点数据源尚未接入：需要接入合规授权的数据服务后才能提供真实热点',
    };
  }
}
