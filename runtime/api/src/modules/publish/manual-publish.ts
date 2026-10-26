/**
 * 人工确认发布（审计 P0-1，2026 平台规则）。
 *
 * 小红书、公众号、视频号、知乎只做人确认：不代发、不模拟登录、不用 Cookie 或爬虫。
 * 抖音、B站适配器保持关闭，直到企业资质由人工打开；打开开关也不等于适配器已接线。
 * 闭环：创建任务（manual_pending）→ 用户复制文案、下载带 AI 标识的封面 → 自己到平台发出 →
 * 点「我已手动发布」（manual_done），可回填作品链接。只保存链接，不抓取平台数据。
 */
export const MANUAL_PLATFORMS: Record<string, { name: string; hosts: readonly string[]; guide: string }> = {
  douyin: {
    name: '抖音',
    hosts: ['douyin.com'],
    guide: '抖音开放平台自动发布尚未完成企业认证与授权（适配器未上线），请打开抖音创作服务平台，粘贴文案、上传视频/封面后手动发布，再回填作品链接；不要把这里当作自动发布。',
  },
  bilibili: {
    name: '哔哩哔哩',
    hosts: ['bilibili.com'],
    guide: 'B站自动投稿尚未完成开放平台资质（适配器未上线），请打开B站创作中心，粘贴文案、上传视频/封面后手动投稿，再回填作品链接；不要把这里当作自动发布。',
  },
  xhs: {
    name: '小红书',
    hosts: ['xiaohongshu.com', 'xhslink.com'],
    guide: '打开小红书 App 或创作服务平台，粘贴文案、上传封面后发布；发布时请勾选平台提供的「AI 生成内容」声明（如有）。',
  },
  weixin: {
    name: '视频号',
    hosts: ['weixin.qq.com'],
    guide: '打开视频号助手或微信视频号，粘贴文案、上传封面与视频后发布；请保留内容中的「AI 生成」标识。',
  },
  wechat_mp: {
    name: '公众号',
    hosts: ['mp.weixin.qq.com'],
    guide: '登录微信公众平台，新建图文，粘贴正文、上传封面后群发或发表；请保留正文开头的「AI 生成」标识。',
  },
  zhihu: {
    name: '知乎',
    hosts: ['zhihu.com', 'zhuanlan.zhihu.com'],
    guide: '打开知乎，新建回答或文章，粘贴正文后发布；请保留「AI 生成」标识。知乎不提供本产品可用的自动发布接口，请人工确认后发布。',
  },
};

/** 2026 年平台规则要求人工确认，企业授权也不能改成代发。 */
const HUMAN_CONFIRM_ONLY = new Set(['xhs', 'weixin', 'wechat_mp', 'zhihu']);

/**
 * 是否允许官方自动发布。
 * 小红书、公众号、视频号、知乎永远为 false。
 * 抖音、B站仅当对应企业授权环境变量为 1 时为 true，且发布服务仍不调用适配器。
 */
export function officialAutoPublishAllowed(platform: string): boolean {
  if (HUMAN_CONFIRM_ONLY.has(platform) || !isManualPlatform(platform)) return false;
  if (platform === 'douyin') return process.env.DOUYIN_ENTERPRISE_AUTHORIZED === '1';
  if (platform === 'bilibili') return process.env.BILIBILI_ENTERPRISE_AUTHORIZED === '1';
  return false;
}

export const MANUAL_PENDING = 'manual_pending';
export const MANUAL_DONE = 'manual_done';

export function isManualPlatform(platform: string): boolean {
  return Object.prototype.hasOwnProperty.call(MANUAL_PLATFORMS, platform);
}

/**
 * 回填的作品链接：只接受 https，且域名属于该平台（含子域名）。
 * 不访问这个链接，只保存。返回规范化后的链接，或抛出中文错误。
 */
export function normalizeManualPostUrl(platform: string, raw: unknown): string | null {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return null;
  if (text.length > 500) throw new Error('作品链接太长');
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error('作品链接格式不正确，请粘贴以 https:// 开头的完整链接');
  }
  if (url.protocol !== 'https:') throw new Error('作品链接必须以 https:// 开头');
  if (url.username || url.password) throw new Error('作品链接格式不正确');
  const host = url.hostname.toLowerCase();
  const allowed = MANUAL_PLATFORMS[platform]?.hosts ?? [];
  if (!allowed.some((h) => host === h || host.endsWith(`.${h}`))) {
    throw new Error(`请粘贴${MANUAL_PLATFORMS[platform]?.name ?? '该平台'}的作品链接`);
  }
  url.hash = '';
  return url.toString();
}
