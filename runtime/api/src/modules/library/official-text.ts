/**
 * 平台规则只有带上官方原文才能进入规则库。
 * 媒体转述、空原文、未标明「官方原文」的，都停在候选。
 * 即使进入规则库，也是待审核、复核人留空、用户不可见，不会自动发布。
 */
export interface PlatformRuleDraft {
  id: string;
  title: string;
  url: string;
  platform?: string;
  /** 从平台自己的页面抄下的原文。新闻稿和摘要不算。 */
  official_text?: string;
  text_kind?: 'official' | 'media' | 'paraphrase';
}

export interface RuleAdmission {
  destination: 'library' | 'candidate';
  reason: string;
  reviewer: '';
  named_reviewer: null;
  review_status: '待审核';
  auto_published: false;
}

export interface AdmittedRule {
  id: string;
  title: string;
  url: string;
  platform?: string;
  points: string[];
  review_status: '待审核';
  reviewer: '';
  visible: false;
  auto_published: false;
}

const MEDIA_HOSTS = ['news.qq.com', 'new.qq.com', 'mp.weixin.qq.com'];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isMediaHost(host: string): boolean {
  return MEDIA_HOSTS.some((item) => host === item || host.endsWith(`.${item}`));
}

export function admitPlatformRule(rule: PlatformRuleDraft): RuleAdmission {
  const text = String(rule.official_text ?? '').trim();
  const host = hostOf(rule.url);
  const https = String(rule.url ?? '').startsWith('https://');
  let reason = '带有官方原文，可以进入规则库待审核，不会自动发布';
  let destination: RuleAdmission['destination'] = 'library';
  if (!text) {
    destination = 'candidate';
    reason = '缺少官方原文，只能作为候选';
  } else if (rule.text_kind !== 'official') {
    destination = 'candidate';
    reason = '未标明为官方原文，只能作为候选';
  } else if (!https || isMediaHost(host)) {
    destination = 'candidate';
    reason = '链接不是平台官方页面，只能作为候选';
  }
  return {
    destination,
    reason,
    reviewer: '',
    named_reviewer: null,
    review_status: '待审核',
    auto_published: false,
  };
}

/** 只在内存里决定去向。不写规则库文件，不填复核人。 */
export function applyPlatformRule<T extends { id: string }>(entries: T[], rule: PlatformRuleDraft): { entries: Array<T | AdmittedRule>; admission: RuleAdmission } {
  const admission = admitPlatformRule(rule);
  if (admission.destination !== 'library') return { entries: [...entries], admission };
  const kept = entries.filter((entry) => entry.id !== rule.id);
  const admitted: AdmittedRule = {
    id: rule.id,
    title: rule.title,
    url: rule.url,
    platform: rule.platform,
    points: [String(rule.official_text).trim()],
    review_status: '待审核',
    reviewer: '',
    visible: false,
    auto_published: false,
  };
  return { entries: [...kept, admitted], admission };
}
