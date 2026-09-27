import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import path from 'path';

export interface RagPolicySource {
  id: string;
  source_url: string;
  source_name: string;
  published_at: string;
  retrieved_at: string;
  jurisdiction: string;
  source_tier: string;
  review_status: string;
  platforms: string[];
  topics: string[];
  content: string;
}

@Injectable()
export class RagPolicyService {
  private readonly logger = new Logger(RagPolicyService.name);
  constructor(private readonly config: ConfigService) {}

  async select(platforms: string[] = [], topic = ''): Promise<RagPolicySource[]> {
    const directory = this.config.get<string>('RAG_POLICY_DIR') || path.join(process.cwd(), 'data', 'rag_cache');
    const maxAgeDays = Number(this.config.get('RAG_MAX_AGE_DAYS') ?? 30);
    if (!Number.isInteger(maxAgeDays) || maxAgeDays < 1 || maxAgeDays > 365) throw new Error('RAG_MAX_AGE_DAYS 必须为 1 到 365 的整数');
    let names: string[];
    try { names = (await fs.readdir(directory)).filter(name => name.endsWith('.json')); }
    catch { this.logger.warn(`RAG policy directory unavailable: ${directory}`); return []; }
    const now = Date.now();
    const normalizedPlatforms = new Set(platforms.map(value => value.toLowerCase()));
    const selected: RagPolicySource[] = [];
    for (const name of names.sort()) {
      try {
        const record = JSON.parse(await fs.readFile(path.join(directory, name), 'utf8')) as RagPolicySource;
        const retrieved = Date.parse(record.retrieved_at);
        const published = Date.parse(record.published_at);
        const source = new URL(record.source_url);
        const valid = record.review_status === 'verified' && record.jurisdiction === 'CN'
          && ['S', 'A'].includes(record.source_tier)
          && ['https://www.cac.gov.cn', 'https://www.douyin.com', 'https://www.bilibili.com'].includes(source.origin)
          && !source.username && !source.password && !source.hash
          && Number.isFinite(retrieved) && retrieved <= now && now - retrieved <= maxAgeDays * 86_400_000
          && Number.isFinite(published) && published <= retrieved
          && typeof record.id === 'string' && !!record.id.trim()
          && typeof record.source_name === 'string' && !!record.source_name.trim()
          && typeof record.content === 'string' && !!record.content.trim()
          && Array.isArray(record.platforms) && record.platforms.length > 0
          && record.platforms.every(value => typeof value === 'string' && !!value.trim())
          && Array.isArray(record.topics) && record.topics.length > 0
          && record.topics.every(value => typeof value === 'string' && !!value.trim());
        if (!valid) { this.logger.warn(`Ignored stale or invalid RAG source: ${name}`); continue; }
        const platformMatch = record.platforms.includes('all') || record.platforms.some(value => normalizedPlatforms.has(value.toLowerCase()));
        const topicMatch = record.topics.includes('all') || record.topics.some(value => topic.includes(value));
        if (platformMatch && topicMatch) selected.push(record);
      } catch { this.logger.warn(`Ignored unreadable RAG source: ${name}`); }
    }
    return selected.slice(0, 5);
  }

  buildContext(sources: RagPolicySource[]) {
    if (!sources.length) return '\n\n当前没有通过来源、时效和适用范围校验的合规资料。不要编造平台规则、引用或宣称已通过合规审核；仅生成待人工核对的草稿。';
    return `\n\n以下为已核验的合规资料，只能据此形成合规提醒，不得编造资料中没有的事实：\n${sources.map((source, index) => `[${index + 1}] ${source.source_name}（发布：${source.published_at}；检索：${source.retrieved_at}）\n${source.content}`).join('\n\n')}`;
  }
}
