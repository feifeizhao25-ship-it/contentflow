/**
 * 首页选题：只用这个用户注册时填的行业、岗位、成长阶段、省份，
 * 以及规则库里已经有的主题名（feed.ts 的 TOPICS）。对不上主题就只复述用户自己的字，不编热点。
 */
import { ProfileAnswers, TOPICS, Topic } from '../library/feed';

export interface ContentSuggestion {
  id: string;
  title: string;
  href: string;
  reason: string;
  library: 'rule-topics' | 'signup-profile';
}

export interface PendingReviewItem {
  id: string;
  title: string;
  href: string;
}

function filled(profile: ProfileAnswers): Array<[string, string]> {
  const text = (value: string | null | undefined) => (value ?? '').trim();
  return ([
    ['行业', text(profile.industry)],
    ['岗位', text(profile.jobRole)],
    ['成长阶段', text(profile.growthStage)],
    ['省份', text(profile.province)],
  ] as Array<[string, string]>).filter((pair) => pair[1].length >= 2);
}

function matchTopic(value: string): Topic | undefined {
  return TOPICS.find((topic) => topic.keywords.some((keyword) => keyword.length >= 2 && (value.includes(keyword) || keyword === value)) || value.includes(topic.name));
}

export function suggestionsForProfile(profile: ProfileAnswers): ContentSuggestion[] {
  const answers = filled(profile);
  if (!answers.length) return [];
  const own = answers.map(([, value]) => value).join(' · ');
  const out: ContentSuggestion[] = [{
    id: 'profile',
    title: `按你填的资料写：${own}`,
    href: `/studio?topic=${encodeURIComponent(answers.map(([, value]) => value).join(' ').slice(0, 80))}`,
    reason: `只用你注册时填写的${answers.map(([label, value]) => `${label}「${value}」`).join('、')}`,
    library: 'signup-profile',
  }];
  const used = new Set<string>();
  for (const [label, value] of answers) {
    const topic = matchTopic(value);
    if (!topic || used.has(topic.id)) continue;
    used.add(topic.id);
    out.push({
      id: `topic:${topic.id}`,
      title: `规则库里和你有关的主题：${topic.name}`,
      href: `/studio?topic=${encodeURIComponent(value.slice(0, 80))}`,
      reason: `你填写的${label}「${value}」出现在规则库主题「${topic.name}」的词里`,
      library: 'rule-topics',
    });
  }
  return out.slice(0, 4);
}

export function pendingItems(rows: Array<{ id?: unknown; title?: unknown }>): PendingReviewItem[] {
  const out: PendingReviewItem[] = [];
  for (const row of rows ?? []) {
    const id = typeof row?.id === 'string' ? row.id.trim() : '';
    if (!id) continue;
    const title = typeof row.title === 'string' && row.title.trim() ? row.title.trim() : '（无标题）';
    out.push({ id, title, href: '/contents?status=pending_review' });
  }
  return out.slice(0, 5);
}
