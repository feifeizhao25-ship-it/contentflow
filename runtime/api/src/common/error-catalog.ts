/**
 * 对外错误码的唯一文案。
 * 国内用 zh，国际用 en。文档 docs/error-codes.md 必须和这里逐句一致。
 * 缺配置、未登录、无权限、额度用完、请求不能处理、合规拦截、服务故障各自一句，不能互相顶替。
 */
export const ERROR_CATALOG = {
  NOT_CONFIGURED: {
    zh: '这项服务还没开通，所以现在不能用。',
    en: 'This service is not set up yet, so it cannot be used.',
  },
  AUTHENTICATION_REQUIRED: {
    zh: '请先登录后再继续。',
    en: 'Authentication is required. Please sign in to continue.',
  },
  NOT_PERMITTED: {
    zh: '你没有权限做这件事。',
    en: 'You do not have permission to do this.',
  },
  QUOTA_EXHAUSTED: {
    zh: '这个月的额度已经用完。可以升级套餐，或等下个月恢复。',
    en: "This month's allowance is used up. Upgrade your plan, or wait until it resets.",
  },
  REQUEST_NOT_ALLOWED: {
    zh: '这个请求不能处理。请修改内容后再试。',
    en: 'This request cannot be processed. Change it before you submit it again.',
  },
  CONTENT_COMPLIANCE_BLOCKED: {
    zh: '内容没有通过合规检查，没有保存，也没有发布。',
    en: 'The compliance check blocked this content. Nothing was saved or published.',
  },
  SERVICE_UNAVAILABLE: {
    zh: '服务暂时出了故障，请稍后再试。',
    en: 'The service is temporarily unavailable. Please try again later.',
  },
  VALIDATION_FAILED: {
    zh: '请求里的内容不符合要求，请检查后再提交。',
    en: 'Some of the information is not valid. Check it and submit again.',
  },
  NOT_FOUND: {
    zh: '请求的内容不存在。',
    en: 'The requested item does not exist.',
  },
  CONFLICT: {
    zh: '操作与已有数据冲突，请刷新后再试。',
    en: 'The request conflicts with existing data.',
  },
  RATE_LIMITED: {
    zh: '操作太频繁，请稍后再试。',
    en: 'Too many attempts. Please wait and try again.',
  },
} as const;

export type PublicErrorCode = keyof typeof ERROR_CATALOG;

const CODE_ALIAS: Record<string, PublicErrorCode> = {
  AI_MONTHLY_QUOTA: 'QUOTA_EXHAUSTED',
  QUOTA_EXCEEDED: 'QUOTA_EXHAUSTED',
};

export function classifyPublicError(status: number, code: string | undefined, raw: string): PublicErrorCode {
  if (code && code in ERROR_CATALOG) return code as PublicErrorCode;
  if (code && CODE_ALIAS[code]) return CODE_ALIAS[code];
  if (/未配置|not configured|NOT_CONFIGURED/i.test(`${code || ''} ${raw}`)) return 'NOT_CONFIGURED';
  if (/额度|quota|allowance/i.test(raw) && /用完|上限|exhausted|used up/i.test(raw)) return 'QUOTA_EXHAUSTED';
  if (status === 401) return 'AUTHENTICATION_REQUIRED';
  if (status === 403) return 'NOT_PERMITTED';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'SERVICE_UNAVAILABLE';
  return 'VALIDATION_FAILED';
}

const VALIDATOR_ZH: Array<[RegExp, string]> = [
  [/must be an email/i, '请输入有效的邮箱地址'],
  [/should not be empty/i, '这一项不能为空'],
  [/must be longer than or equal to/i, '这一项的长度不够'],
  [/must be shorter than or equal to/i, '这一项太长了'],
  [/must be a boolean/i, '这一项的格式不正确'],
  [/should not exist/i, '有多余的字段'],
  [/must be a string/i, '这一项必须是文字'],
  [/must be a number/i, '这一项必须是数字'],
];

/** 校验器的英文句子逐条译成中文。有一条译不出就整段放弃，避免英文漏出去。 */
export function translateValidatorLines(lines: string[]): string[] | null {
  if (!lines.length) return null;
  const translated: string[] = [];
  for (const line of lines) {
    const hit = VALIDATOR_ZH.find(([pattern]) => pattern.test(line));
    if (!hit) return null;
    translated.push(hit[1]);
  }
  return [...new Set(translated)];
}

export function fallbackMessage(code: string, english: boolean): string {
  const resolved = (code in ERROR_CATALOG ? code : CODE_ALIAS[code]) as PublicErrorCode | undefined;
  const row = (resolved && ERROR_CATALOG[resolved]) || ERROR_CATALOG.VALIDATION_FAILED;
  return english ? row.en : row.zh;
}
