/**
 * 分11：账号页、发布筛选、手动发布共用这一份平台清单。
 * 自动发布目前全部未开通。可绑定和可手动登记分开写，避免三页各写各的。
 */
export const CN_PLATFORM_CATALOG = [
  { id: 'douyin', aliases: ['tiktok'], name: '抖音', icon: '🎵', color: '#000000', bind: true, manual: true },
  { id: 'xhs', aliases: ['xiaohongshu', 'redbook'], name: '小红书', icon: '📕', color: '#ff2442', bind: true, manual: true },
  { id: 'weixin', aliases: ['shipinhao'], name: '视频号', icon: '💬', color: '#07c160', bind: true, manual: true },
  { id: 'wechat_mp', aliases: ['gongzhonghao'], name: '公众号', icon: '📰', color: '#1aad19', bind: true, manual: true },
  { id: 'bilibili', aliases: [], name: 'B站', icon: '📺', color: '#00a1d6', bind: true, manual: true },
  { id: 'zhihu', aliases: [], name: '知乎', icon: '🎓', color: '#0066ff', bind: true, manual: true },
  { id: 'weibo', aliases: [], name: '微博', icon: '📣', color: '#ff8200', bind: true, manual: true },
  { id: 'kuaishou', aliases: [], name: '快手', icon: '⚡', color: '#ff6600', bind: true, manual: true },
] as const;

export type CnPlatform = (typeof CN_PLATFORM_CATALOG)[number];

export function findCnPlatform(id: string): CnPlatform | undefined {
  return CN_PLATFORM_CATALOG.find((item) => item.id === id || (item.aliases as readonly string[]).includes(id));
}

export function platformCapability(item: CnPlatform): string {
  if (item.bind && item.manual) return '可绑定，发布要手动登记';
  if (item.bind) return '可绑定';
  if (item.manual) return '可手动发布登记';
  return '未开通';
}
