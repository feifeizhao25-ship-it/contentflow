/**
 * 注册来源题「从哪知道我们」：可跳过的单选，只在国内版、且开关打开时生效。
 *
 * - 开关：环境变量 SIGNUP_SOURCE_ENABLED，只认字符串 'true'，默认关闭。
 *   国际版部署（MARKET_REGION=global）无论开关如何都不生效。
 * - 只存枚举代码：GrowthSignupSource 表以 event_id 挂在这次注册的 GrowthEvent（event='signup'）上，
 *   表里没有用户、手机号、邮箱、姓名，也不收自由文本。
 * - 未知值（含中文显示名、大小写不符、任意文字）直接丢弃，不报错、不落库。
 * - 任何响应和日志都不带来源；注册响应保持原样。
 */
import { randomUUID } from 'crypto';

export const SIGNUP_SOURCES = [
  { code: 'xiaohongshu', label: '小红书' },
  { code: 'douyin', label: '抖音' },
  { code: 'shipinhao', label: '视频号' },
  { code: 'gongzhonghao', label: '公众号' },
  { code: 'zhihu', label: '知乎' },
  { code: 'bilibili', label: '哔哩哔哩' },
  { code: 'search', label: '搜索' },
  { code: 'friend', label: '朋友推荐' },
  { code: 'other', label: '其他' },
] as const;

export type SignupSourceCode = (typeof SIGNUP_SOURCES)[number]['code'];

export const SIGNUP_SOURCE_FLAG = 'SIGNUP_SOURCE_ENABLED';
export const SIGNUP_EVENT = 'signup';

const CODES: ReadonlySet<string> = new Set(SIGNUP_SOURCES.map((item) => item.code));

type Env = Record<string, string | undefined>;

export function signupSourceEnabled(env: Env = process.env): boolean {
  if (env.MARKET_REGION === 'global') return false;
  return env[SIGNUP_SOURCE_FLAG] === 'true';
}

/** 合法代码原样返回；其余一律返回 null。 */
export function normalizeSignupSource(value: unknown): SignupSourceCode | null {
  return typeof value === 'string' && CODES.has(value) ? (value as SignupSourceCode) : null;
}

export function publicSignupSourceOptions(env: Env = process.env) {
  if (!signupSourceEnabled(env)) return { enabled: false, options: [] as { code: string; label: string }[] };
  return {
    enabled: true,
    question: '从哪知道我们',
    skippable: true,
    options: SIGNUP_SOURCES.map((item) => ({ code: item.code, label: item.label })),
  };
}

interface SignupEventDelegate {
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
}

/**
 * 开关打开时，给每次新注册记一条 signup 漏斗事件；答了题就把来源代码挂在这条事件上。
 * 尽力而为：数据库没有这张表或写入失败，都不影响注册本身，也不写日志（避免来源和账号一起出现在日志里）。
 * 返回是否写入了来源。
 */
export async function recordSignupEvent(
  prisma: unknown,
  account: { userId: string; tenantId?: string | null },
  rawSource: unknown,
  env: Env = process.env,
  newId: () => string = defaultId,
): Promise<boolean> {
  if (!signupSourceEnabled(env)) return false;
  const delegate = (prisma as { growthEvent?: SignupEventDelegate } | null)?.growthEvent;
  if (!delegate) return false;
  const source = normalizeSignupSource(rawSource);
  try {
    await delegate.create({
      data: {
        tenant_id: account.tenantId ?? null,
        user_id: account.userId,
        // 访客编号不是账号：服务端注册事件没有浏览器访客编号，用一次性随机值。
        visitor_id: newId(),
        event: SIGNUP_EVENT,
        ...(source ? { signup_source: { create: { source } } } : {}),
      },
    });
    return Boolean(source);
  } catch {
    return false;
  }
}

function defaultId(): string {
  return randomUUID();
}
