/**
 * 账号与数据：导出个人信息、注销账号、保存资料。
 *
 * 这里刻意**不用** apiClient：它对任何 401 都跳登录页，而「注销时密码输错」也是 401——
 * 用户会被踢回登录页，以为账号已经没了。所以用普通 fetch，由调用方自己处理每种失败。
 */

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
const defaultFetch: FetchLike = (input, init) => fetch(input, init);

export class AccountError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'AccountError';
    this.status = status;
    this.code = code;
  }
}

async function readBody(response: Response): Promise<any> {
  let body: any = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return body;
}

/** 后端成功响应包了一层 { success, data }。 */
function unwrap(body: any): any {
  return body && typeof body === 'object' && body.success === true && 'data' in body ? body.data : body;
}

export function explainError(status: number, body: any): AccountError {
  const raw = body?.message ?? body?.error?.message;
  const serverText = Array.isArray(raw) ? raw.join('；') : typeof raw === 'string' ? raw : '';
  const code: string | undefined = typeof body?.code === 'string' ? body.code : body?.error?.code;
  if (status === 401) return new AccountError(serverText || '密码不正确，或登录已过期', 401, code);
  if (status === 409) return new AccountError(serverText || '当前无法注销：工作区里还有其他成员', 409, code);
  if (status === 429) return new AccountError('操作太频繁，请一分钟后再试', 429, code);
  if (status === 400) return new AccountError(serverText || '请求不完整，请检查后重试', 400, code);
  return new AccountError('服务暂时不可用，你的数据没有任何改动，请稍后重试', status, code);
}

async function call(method: string, path: string, body: unknown, fetchImpl: FetchLike): Promise<any> {
  let response: Response;
  try {
    response = await fetchImpl(`/api/v1${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new AccountError('网络连接失败，你的数据没有任何改动，请稍后重试', 0);
  }
  const parsed = await readBody(response);
  if (!response.ok) throw explainError(response.status, parsed);
  return unwrap(parsed);
}

export function exportFilename(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `分发侠-我的数据-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.json`;
}

/** 取服务端生成的导出（只含本人数据、不含任何凭据），返回可直接保存的文本。 */
export async function fetchMyDataExport(fetchImpl: FetchLike = defaultFetch, now?: Date): Promise<{ filename: string; text: string }> {
  const data = await call('GET', '/users/me/export', undefined, fetchImpl);
  return { filename: exportFilename(now), text: JSON.stringify(data, null, 2) };
}

/** 注销账号。有口令的账号必须带口令；confirm 恒为 true（页面上用户已明确勾选）。 */
export async function deleteMyAccount(password: string | undefined, fetchImpl: FetchLike = defaultFetch) {
  const body: { confirm: true; password?: string } = { confirm: true };
  if (password) body.password = password;
  return call('POST', '/users/me/delete-account', body, fetchImpl) as Promise<{
    status: string;
    workspace_deleted: boolean;
    retained: string[];
  }>;
}

export async function saveProfile(name: string, fetchImpl: FetchLike = defaultFetch) {
  return call('PUT', '/users/me', { name }, fetchImpl);
}

export async function savePreferences(patch: Record<string, unknown>, fetchImpl: FetchLike = defaultFetch) {
  return call('PUT', '/users/me', { preferences: patch }, fetchImpl);
}
