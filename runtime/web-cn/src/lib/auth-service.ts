/**
 * 登录 / 注册：浏览器 → 本站 /api/auth/*（服务端写入 httpOnly 登录 cookie）。
 *
 * 这里刻意不用 apiClient：它对任何 401 都跳登录页，而「密码错误」也是 401。
 * 失败原因一律取后端给的中文（信封在 error.message），没有中文就用兜底文案——
 * 不把 `Failed to fetch`、校验管道的英文数组渲染上屏。
 */
import { apiErrorText } from './api-error';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
const defaultFetch: FetchLike = (input, init) => fetch(input, init);

export class AuthError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
  }
}

export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  name?: string;
  role?: string;
}

async function post(path: string, body: unknown, fallback: string, fetchImpl: FetchLike): Promise<any> {
  let response: Response;
  try {
    response = await fetchImpl(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthError('网络连接失败，请检查网络后重试', 0);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = typeof payload?.error?.code === 'string' ? payload.error.code : undefined;
    if (response.status === 429) throw new AuthError(apiErrorText(payload) ?? '操作太频繁，请稍后再试', 429, code);
    throw new AuthError(apiErrorText(payload) ?? fallback, response.status, code);
  }
  return payload?.data ?? payload;
}

export async function loginWithPassword(
  input: { email: string; password: string },
  fetchImpl: FetchLike = defaultFetch,
): Promise<AuthUser> {
  const data = await post('/api/auth/login', { email: input.email, password: input.password }, '登录失败，请检查邮箱和密码', fetchImpl);
  if (!data?.user) throw new AuthError('登录响应无效，请稍后重试', 502);
  return data.user as AuthUser;
}

export async function registerWithEmail(
  input: { email: string; password: string; name?: string; tenantName?: string },
  fetchImpl: FetchLike = defaultFetch,
): Promise<AuthUser> {
  const data = await post(
    '/api/auth/register',
    { email: input.email, password: input.password, name: input.name, tenantName: input.tenantName },
    '注册失败，请稍后重试',
    fetchImpl,
  );
  if (!data?.user) throw new AuthError('注册响应无效，请稍后重试', 502);
  return data.user as AuthUser;
}
