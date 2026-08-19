import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class HotService {
  constructor(private readonly prisma: PrismaService) {}

  async getHotList(platform: string, category?: string) {
    // 热点榜单数据（可对接第三方API）
    return [
      { id: '1', topic: 'AI人工智能', heat: 999999, platform },
      { id: '2', topic: '短视频运营', heat: 888888, platform },
    ];
  }
}
