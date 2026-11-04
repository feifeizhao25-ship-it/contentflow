/**
 * 「今天先做什么」：只用这个账号自己的真实数据（内容、发布任务、已绑定账号、素材、增长目标）算出来。
 * 纯函数，同样的输入得到同样的结果；不编数字，没有数据就如实说没有。
 *
 * 全量 UI 测试 I-10：首页卡片七天零变化（资料库卡片被「全部待审核」的闸门挡住是故意的，没有放开），
 * 国际版没有任何每日内容。这里补的是第三类信号——账号自己的活动，随用户操作而变。
 */
export type Lang = 'zh' | 'en';

export interface TodaySignals {
  accounts: number;
  platforms: string[];
  content_7d: number;
  drafts: number;
  pending_review: number;
  approved_unpublished: number;
  published_7d: number;
  failed_7d: number;
  scheduled_upcoming: number;
  materials: number;
  active_goals: number;
}

export interface NextStep {
  id: 'connect_account' | 'fix_failed' | 'review_content' | 'publish_approved' | 'create_content' | 'set_goal' | 'keep_going';
  title: string;
  description: string;
  href: string;
  reason: string;
}

const HREF: Record<Lang, Record<string, string>> = {
  zh: { accounts: '/accounts', publish: '/publish', contents: '/contents', create: '/create', growth: '/growth' },
  en: { accounts: '/create', publish: '/create', contents: '/create', create: '/create', growth: '/create' },
};

const T = {
  zh: {
    connect_account: ['先绑定一个发布账号', '还没有绑定任何平台账号，内容写好了也无处发布。', '你的账号下还没有已绑定的平台账号'],
    fix_failed: (n: number) => [`有 ${n} 条发布失败，先处理`, '打开发布列表看失败原因，修正后可以重试。', `近 7 天有 ${n} 条发布任务失败`],
    review_content: (n: number) => [`有 ${n} 条内容等待审核`, '审核通过后才能发布。', `你有 ${n} 条内容处于待审核`],
    publish_approved: (n: number) => [`有 ${n} 条已通过审核、还没发布`, '选择平台和时间发布。', `你有 ${n} 条内容已通过审核但还没有发布任务`],
    create_content: ['近 7 天还没有新内容，写一条吧', '从一个话题开始，AI 生成的内容会带“AI 生成”标识。', '近 7 天你没有创建新内容'],
    set_goal: ['设一个增长目标', '有目标才能看到进度。', '你还没有进行中的增长目标'],
    keep_going: (n: number) => ['节奏不错，继续保持', `近 7 天已发布 ${n} 条。`, `近 7 天你已发布 ${n} 条，没有待处理事项`],
  },
  en: {
    connect_account: ['Connect a publishing account first', 'No platform account is connected yet, so finished content has nowhere to go.', 'Your workspace has no connected platform account'],
    fix_failed: (n: number) => [`${n} failed publish${n > 1 ? 'es' : ''} to fix`, 'Open the publish list, read the failure reason, fix it and retry.', `${n} publish task${n > 1 ? 's' : ''} failed in the last 7 days`],
    review_content: (n: number) => [`${n} item${n > 1 ? 's' : ''} waiting for review`, 'Content must be approved before it can be published.', `You have ${n} item${n > 1 ? 's' : ''} in pending review`],
    publish_approved: (n: number) => [`${n} approved item${n > 1 ? 's' : ''} not published yet`, 'Pick a platform and a time to publish.', `You have ${n} approved item${n > 1 ? 's' : ''} with no publish task`],
    create_content: ['No new content in the last 7 days. Write one?', 'Start from a topic; AI-generated drafts carry an AI label.', 'You created no content in the last 7 days'],
    set_goal: ['Set a growth goal', 'A goal lets you see progress.', 'You have no active growth goal'],
    keep_going: (n: number) => ['Nice rhythm. Keep going.', `${n} published in the last 7 days.`, `You published ${n} in the last 7 days and nothing is waiting`],
  },
} as const;

/** 优先级固定：先解决阻塞（没账号 > 发布失败 > 待审核 > 已通过未发布），再创作，最后目标。 */
export function nextStep(s: TodaySignals, lang: Lang, goalsEnabled: boolean): NextStep {
  const t = T[lang];
  const mk = (id: NextStep['id'], v: readonly string[], href: string): NextStep => ({ id, title: v[0], description: v[1], reason: v[2], href });
  const h = HREF[lang];
  if (s.accounts === 0) return mk('connect_account', t.connect_account, h.accounts);
  if (s.failed_7d > 0) return mk('fix_failed', t.fix_failed(s.failed_7d), h.publish);
  if (s.pending_review > 0) return mk('review_content', t.review_content(s.pending_review), h.contents);
  if (s.approved_unpublished > 0) return mk('publish_approved', t.publish_approved(s.approved_unpublished), h.publish);
  if (s.content_7d === 0) return mk('create_content', t.create_content, h.create);
  if (goalsEnabled && s.active_goals === 0) return mk('set_goal', t.set_goal, h.growth);
  return mk('keep_going', t.keep_going(s.published_7d), h.create);
}
