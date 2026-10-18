import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * 热点榜单（批2）：可替换的真实数据源接口。
 * 配置（只读环境变量名，不硬编码地址/密钥）：
 *   HOT_PROVIDER_URL  数据服务基础地址（需持有平台数据授权的境内服务商签约后填写）
 *   HOT_PROVIDER_KEY  可选，Bearer 凭证（由部署环境注入，本代码不落库不回显）
 *   HOT_PROVIDER_NAME 可选，对外展示的数据来源名
 * 未配置时如实返回 available=false 与原因，绝不编造热点与热度。
 * 服务商返回约定：GET {URL}/hot?platform=&category= -> { topics: [{id,topic,heat,platform}] }
 */
@Injectable()
export class HotService {
  private readonly logger = new Logger(HotService.name);
  constructor(private readonly prisma?: PrismaService, private readonly fetchFn: typeof fetch = fetch) {}

  private provider() {
    const url = (process.env.HOT_PROVIDER_URL || '').replace(/\/$/, '');
    return url ? { url, key: process.env.HOT_PROVIDER_KEY || '', name: process.env.HOT_PROVIDER_NAME || '已签约热点数据服务' } : null;
  }

  async getHotList(platform = 'xhs', category?: string) {
    const p = this.provider();
    if (!p) {
      return {
        available: false,
        topics: [] as Array<{ id: string; topic: string; heat: number; platform: string }>,
        message: '热点数据源尚未接入：需要接入合规授权的数据服务后才能提供真实热点',
      };
    }
    try {
      const u = new URL(`${p.url}/hot`);
      u.searchParams.set('platform', platform || 'xhs');
      if (category) u.searchParams.set('category', category);
      const res = await this.fetchFn(u.toString(), { headers: p.key ? { Authorization: `Bearer ${p.key}` } : {}, signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`hot provider ${res.status}`);
      const data: any = await res.json();
      const topics = (Array.isArray(data?.topics) ? data.topics : [])
        .filter((t: any) => t && typeof t.topic === 'string' && t.topic.trim())
        .map((t: any, i: number) => ({ id: String(t.id ?? i), topic: String(t.topic).slice(0, 100), heat: Number.isFinite(Number(t.heat)) ? Number(t.heat) : 0, platform: String(t.platform ?? platform) }));
      return { available: true, source: p.name, topics, message: '' };
    } catch (e: any) {
      this.logger.warn(`hot provider failed: ${e?.message ?? e}`);
      return { available: false, topics: [], message: '热点数据源暂时不可用，本次没有展示热点（不会用编造数据代替）' };
    }
  }
}
