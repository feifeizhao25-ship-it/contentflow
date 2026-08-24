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
    const maxAgeDays = Math.max(1, this.config.get<number>('RAG_MAX_AGE_DAYS', 30));
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
        const valid = record.review_status === 'verified' && record.source_url?.startsWith('https://') && Number.isFinite(retrieved) && now - retrieved <= maxAgeDays * 86_400_000 && record.content?.trim();
        if (!valid) { this.logger.warn(`Ignored stale or invalid RAG source: ${name}`); continue; }
        const platformMatch = record.platforms.includes('all') || record.platforms.some(value => normalizedPlatforms.has(value.toLowerCase()));
        const topicMatch = record.topics.includes('all') || record.topics.some(value => topic.includes(value));
        if (platformMatch || topicMatch) selected.push(record);
      } catch { this.logger.warn(`Ignored unreadable RAG source: ${name}`); }
    }
    return selected.slice(0, 5);
  }

  buildContext(sources: RagPolicySource[]) {
    if (!sources.length) return '';
    return `\n\n以下为已核验的合规资料，只能据此形成合规提醒，不得编造资料中没有的事实：\n${sources.map((source, index) => `[${index + 1}] ${source.source_name}（发布：${source.published_at}；检索：${source.retrieved_at}）\n${source.content}`).join('\n\n')}`;
  }
}
