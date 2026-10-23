/**
 * 正文逐平台改写（批2）：一稿多适配从标题层做到正文层。
 * 纯规则改写（不额外调模型、不耗额度）：按平台的结构/长度/标签习惯重排正文，
 * 保留 AI 生成标识首行；事实内容不改写、不新增未经来源支持的说法。
 */
export interface PlatformVariant { platform: string; title: string; body: string; hashtags: string[]; char_count: number; notes: string[] }
const AI_LABEL_RE = /AI\s*生成/;
const RULES: Record<string, { name: string; maxChars: number; tags: number; style: string }> = {
  xhs: { name: '小红书', maxChars: 1000, tags: 5, style: '分段短句、先说体验与结论，结尾给出可保存的要点' },
  douyin: { name: '抖音', maxChars: 300, tags: 3, style: '口播脚本：前三秒给结论，句子短，结尾留一个互动问题' },
  bilibili: { name: 'B站', maxChars: 2000, tags: 5, style: '图文/动态：分小节，信息密度高，可保留细节' },
  wechat_mp: { name: '公众号', maxChars: 5000, tags: 0, style: '长文：小标题分节，开头摘要、结尾小结' },
  weixin: { name: '视频号', maxChars: 300, tags: 3, style: '短文案配视频：先结论，口语化' },
  weibo: { name: '微博', maxChars: 2000, tags: 3, style: '一段说清，话题标签放结尾' },
  zhihu: { name: '知乎', maxChars: 5000, tags: 0, style: '先给结论再展开论证，段落完整' },
};
export function platformRule(platform: string) { return RULES[platform] ?? { name: platform, maxChars: 2000, tags: 3, style: '通用图文' }; }

export function adaptBodyForPlatform(rawBody: string, platform: string, topic = ''): PlatformVariant {
  const rule = platformRule(platform);
  const lines = String(rawBody ?? '').split('\n');
  const labelIdx = lines.findIndex((l) => AI_LABEL_RE.test(l));
  const label = labelIdx >= 0 ? lines[labelIdx].trim() : '';
  const bodyLines = lines.filter((_, i) => i !== labelIdx).map((l) => l.trim()).filter(Boolean);
  let body = bodyLines.join('\n');
  const notes: string[] = [rule.style];
  if (platform === 'douyin' || platform === 'weixin') {
    // 口播/短文案：只取前段并压缩空白，保证能直接念
    body = bodyLines.join(' ').replace(/\s+/g, ' ');
    notes.push('已压缩为口播长度，发布前请按视频节奏再核对。');
  } else if (platform === 'wechat_mp' || platform === 'zhihu' || platform === 'bilibili') {
    body = bodyLines.join('\n\n');
  } else {
    body = bodyLines.join('\n');
  }
  if (body.length > rule.maxChars) { body = body.slice(0, rule.maxChars); notes.push(`已按${rule.name}长度上限截断到 ${rule.maxChars} 字，截断处请人工顺一遍。`); }
  const tags = topic && rule.tags ? [`#${topic.replace(/\s+/g, '')}`, '#AI生成内容'].slice(0, rule.tags) : (rule.tags ? ['#AI生成内容'] : []);
  const outBody = [label, body, tags.length ? tags.join(' ') : ''].filter(Boolean).join('\n');
  return { platform, title: '', body: outBody, hashtags: tags, char_count: outBody.length, notes };
}
export function adaptForPlatforms(body: string, platforms: string[] = [], topic = ''): PlatformVariant[] {
  const list = platforms.length ? platforms : ['xhs'];
  return [...new Set(list)].map((p) => adaptBodyForPlatform(body, p, topic));
}
