/**
 * 国内版界面上的日期、热度和平台名。
 * 日期一律按北京时间写成 2026-10-28 或 2026-10-28 08:30，避免浏览器语言把同一天显示成 10/28/2026。
 */

const PLATFORM_TABLE: Array<{ ids: string[]; name: string; icon: string }> = [
  { ids: ['douyin', 'tiktok'], name: '抖音', icon: '🎵' },
  { ids: ['xiaohongshu', 'xhs', 'redbook'], name: '小红书', icon: '📕' },
  { ids: ['weixin', 'wechat_channels', 'channels', 'shipinhao'], name: '视频号', icon: '📹' },
  { ids: ['wechat', 'wechat_mp', 'wechat_oa', 'gongzhonghao'], name: '公众号', icon: '📰' },
  { ids: ['bilibili', 'bili'], name: 'B站', icon: '📺' },
  { ids: ['weibo'], name: '微博', icon: '微' },
  { ids: ['kuaishou'], name: '快手', icon: '🎬' },
  { ids: ['zhihu'], name: '知乎', icon: '💡' },
  { ids: ['toutiao'], name: '今日头条', icon: '📰' },
  { ids: ['baijiahao'], name: '百家号', icon: '🗞️' },
];

export function platformDisplay(raw: unknown): { name: string; icon: string } {
  const key = String(raw ?? '').trim().toLowerCase();
  const found = PLATFORM_TABLE.find((item) => item.ids.includes(key));
  return found ?? { name: '其他平台', icon: '📱' };
}

/** 热度不用英文 k。一万及以上写成「万」。 */
export function formatHeat(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '暂无';
  if (n >= 10000) {
    const wan = Math.round((n / 10000) * 10) / 10;
    return `${Number.isInteger(wan) ? String(wan) : wan.toFixed(1)}万`;
  }
  return Math.round(n).toLocaleString('zh-CN');
}

function parts(date: Date, withTime: boolean) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: withTime ? '2-digit' : undefined,
    minute: withTime ? '2-digit' : undefined,
    hourCycle: 'h23',
  }).formatToParts(date);
}

/** 北京时间。无效日期返回空串，调用方自己决定占位文案。 */
export function formatCnDate(value: unknown, withTime = false): string {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  const list = parts(date, withTime);
  const get = (type: Intl.DateTimeFormatPartTypes) => list.find((part) => part.type === type)?.value ?? '';
  const day = `${get('year')}-${get('month')}-${get('day')}`;
  if (!withTime) return day;
  return `${day} ${get('hour')}:${get('minute')}`;
}
