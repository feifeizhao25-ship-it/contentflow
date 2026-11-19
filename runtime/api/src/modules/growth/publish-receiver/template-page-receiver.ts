import { createHash, timingSafeEqual } from 'crypto';

/**
 * 分发侠自有渠道「模板页」的发布接收口：运营中枢 ops/airui_ops/publish.py 的
 * fenfaxia_template_pages 渠道会 POST 到 {fenfaxia.api_base}/growth/publish/template-page。
 *
 * 这里只做判断，不碰数据库，也没有任何外呼。收到的内容只存进库，不上线、不转发到任何平台。
 */
export const RECEIVER_PATH = '/api/v1/growth/publish/template-page';
/** 总开关。没设、为空或不是 1/true/yes/on 都算关。默认关。 */
export const ENABLE_ENV = 'FENFAXIA_PUBLISH_RECEIVER_ENABLED';
/** 中枢调用时带的 Bearer 令牌。只读环境变量名，代码和文档里都不出现值。 */
export const TOKEN_ENV = 'OPENCLAW_FENFAXIA_API_TOKEN';
/** 和这些变量的值相同就当没配置：接收令牌不能复用登录、回调、只读漏斗或顺时的令牌。 */
export const FORBIDDEN_REUSE_ENVS: readonly string[] = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'FENFAXIA_FUNNEL_READONLY_TOKEN',
  'PUBLISH_DISPATCH_WEBHOOK_SECRET',
  'PAYMENT_CALLBACK_SECRET',
  'SMS_CODE_HMAC_SECRET',
  'WEBHOOK_ENCRYPTION_KEY',
  'OPENCLAW_SHUNSHI_ADMIN_TOKEN',
  'OPENCLAW_SHUNSHI_PUBLISH_TOKEN',
];
export const PRODUCT = 'fenfaxia';
export const CHANNEL = 'fenfaxia_template_pages';
/** 与中枢 content.py 的 AIGC_TEXT["fenfaxia"]、本仓库 AI_TEXT_LABEL 一致。 */
export const AIGC_LABEL = '【本内容由 AI 生成】';
/** 上海时间（UTC+8，无夏令时），按整分钟算，两端都含，与中枢 clock.in_window 一致。 */
export const WINDOW = { start: 8 * 60, end: 21 * 60 + 30, label: '08:00-21:30' } as const;
/** 中枢 content.py BANNED["fenfaxia"]；比较前去掉空格。 */
export const BANNED_WORDS: readonly string[] = ['全平台全自动发布', '过AI检测', '过 AI 检测', '去AI味', '去 AI 味', '洗稿', '降重'];

export type ReasonCode =
  | 'disabled'
  | 'token_not_configured'
  | 'unauthorized'
  | 'bad_request'
  | 'outside_window'
  | 'aigc_missing'
  | 'approval_missing'
  | 'approval_not_approved'
  | 'sha_mismatch'
  | 'approval_detail_not_checked'
  | 'compliance_failed'
  | 'audit_unavailable';

export const REASONS: Readonly<Record<ReasonCode, { status: number; message: string }>> = {
  disabled: { status: 503, message: '接收接口未开启（FENFAXIA_PUBLISH_RECEIVER_ENABLED 默认关闭）' },
  token_not_configured: { status: 503, message: '接收令牌未配置，或与其他密钥相同' },
  unauthorized: { status: 401, message: '令牌缺失或不正确' },
  bad_request: { status: 422, message: '请求格式不正确' },
  outside_window: { status: 403, message: '不在上海时间 08:00 到 21:30 之间' },
  aigc_missing: { status: 422, message: '正文没有人工智能生成标识「【本内容由 AI 生成】」' },
  approval_missing: { status: 409, message: '没有批准单' },
  approval_not_approved: { status: 409, message: '批准单不是已批准状态' },
  sha_mismatch: { status: 409, message: '批准单哈希与内容不一致' },
  approval_detail_not_checked: { status: 409, message: '公众号批准单未确认看过详情' },
  compliance_failed: { status: 422, message: '命中禁用词' },
  audit_unavailable: { status: 503, message: '审计记录写入失败，未接收' },
};

const truthy = (value: string | undefined): boolean => ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());

export function receiverEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return truthy(env[ENABLE_ENV]);
}

const digest = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();

/** 返回可用的接收令牌；没设、为空或与禁止复用的密钥相同时返回空串。 */
export function configuredToken(env: Record<string, string | undefined> = process.env): string {
  const token = String(env[TOKEN_ENV] ?? '').trim();
  if (!token) return '';
  for (const name of FORBIDDEN_REUSE_ENVS) {
    const other = String(env[name] ?? '').trim();
    if (other && timingSafeEqual(digest(other), digest(token))) return '';
  }
  return token;
}

/** 比较 SHA-256 摘要：常量时间，不受长度影响。 */
export function tokenMatches(supplied: string, expected: string): boolean {
  if (!supplied || !expected) return false;
  return timingSafeEqual(digest(supplied), digest(expected));
}

export function bearer(header: unknown): string {
  if (typeof header !== 'string') return '';
  const [scheme, ...rest] = header.trim().split(/\s+/);
  return scheme?.toLowerCase() === 'bearer' ? rest.join(' ').trim() : '';
}

/** Python 按码点比较字符串；JS 默认按 UTF-16 码元。这里按码点排，和 sort_keys=True 一致。 */
function compareCodePoints(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  for (let i = 0; i < Math.min(x.length, y.length); i += 1) {
    const d = (x[i].codePointAt(0) as number) - (y[i].codePointAt(0) as number);
    if (d !== 0) return d;
  }
  return x.length - y.length;
}

export class CanonicalJsonError extends Error {}

/**
 * 与中枢 json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")) 逐字节一致。
 * 字符串、整数、布尔、null、数组、对象都一致；小数和超出安全范围的整数两边写法不同，直接拒收。
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new CanonicalJsonError('只支持安全范围内的整数');
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort(compareCodePoints);
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(obj[key])}`).join(',')}}`;
  }
  throw new CanonicalJsonError('不支持的值类型');
}

export function contentSha256(content: unknown): string {
  return createHash('sha256').update(canonicalJson(content), 'utf8').digest('hex');
}

/** 上海时间的整分钟数（0–1439）。 */
export function shanghaiMinutes(now: Date): number {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

export function inWindow(now: Date): boolean {
  const minutes = shanghaiMinutes(now);
  return WINDOW.start <= minutes && minutes <= WINDOW.end;
}

export function bannedHit(text: string): string | null {
  const folded = text.replace(/ /g, '');
  for (const word of BANNED_WORDS) {
    if (folded.includes(word.replace(/ /g, ''))) return word;
  }
  return null;
}

export interface Approval {
  id?: unknown;
  status?: unknown;
  content_sha256?: unknown;
  channel?: unknown;
  detail_checked?: unknown;
}

export interface CheckedContent {
  failed: ReasonCode[];
  content: Record<string, unknown>;
  sha: string;
  approval: Approval | null;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 四件事里的前三件（批准单哈希、时间窗、AIGC 标识）加禁用词；第四件（审计）在写库时检查。返回全部不满足的原因。 */
export function checkContent(payload: unknown, now: Date): CheckedContent {
  const bad: CheckedContent = { failed: ['bad_request'], content: {}, sha: '', approval: null };
  if (!isPlainObject(payload)) return bad;
  const content = payload.content;
  if (!isPlainObject(content) || typeof content.title !== 'string' || typeof content.body !== 'string') return bad;
  if ((content.product ?? PRODUCT) !== PRODUCT || (content.channel ?? CHANNEL) !== CHANNEL || payload.stub === true) return bad;
  let sha: string;
  try {
    sha = contentSha256(content);
  } catch {
    return bad;
  }
  const failed: ReasonCode[] = [];
  if (!inWindow(now)) failed.push('outside_window');
  if (!content.body.includes(AIGC_LABEL)) failed.push('aigc_missing');
  const approval = isPlainObject(payload.approval) && Object.keys(payload.approval).length > 0 ? (payload.approval as Approval) : null;
  if (!approval) failed.push('approval_missing');
  else if (approval.status !== 'approved') failed.push('approval_not_approved');
  else if (String(approval.content_sha256 ?? '').toLowerCase() !== sha) failed.push('sha_mismatch');
  else if (approval.channel === 'oa' && !approval.detail_checked) failed.push('approval_detail_not_checked');
  if (bannedHit(`${content.title}\n${content.body}`)) failed.push('compliance_failed');
  return { failed, content, sha, approval };
}
