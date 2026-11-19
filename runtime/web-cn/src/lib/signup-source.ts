/**
 * 注册来源题「从哪知道我们」（国内版，可跳过的单选）。
 * 后端开关 SIGNUP_SOURCE_ENABLED 默认关闭；关着或接口失败时注册页不显示这道题。
 * 只提交选项代码，不收自由文本；身份信息与来源不会一起出现在任何响应里。
 */
export interface SignupSourceOption {
  code: string;
  label: string;
}

/** 解析 GET /api/v1/growth/signup-source。未开启或格式不对时返回空数组（不显示题目）。 */
export function parseSignupSourceOptions(payload: unknown): SignupSourceOption[] {
  const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  if (!root) return [];
  const data = root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : root;
  if (data.enabled !== true || !Array.isArray(data.options)) return [];
  return data.options
    .filter((item): item is SignupSourceOption =>
      !!item && typeof item === 'object' && typeof (item as any).code === 'string' && typeof (item as any).label === 'string')
    .map((item) => ({ code: item.code, label: item.label }));
}

/** 只把题目里真有的代码交给注册接口；没选（跳过）就不带这个字段。 */
export function signupSourceField(value: unknown, options: SignupSourceOption[]): { signupSource?: string } {
  if (typeof value !== 'string' || !options.some((option) => option.code === value)) return {};
  return { signupSource: value };
}
