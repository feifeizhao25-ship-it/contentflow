/**
 * 把后端 / 网络的失败变成能给用户看的中文。
 *
 * 后端的错误信封是 `{ success: false, error: { code, message, ... } }`，而前端各处读的是顶层
 * `message`：读不到，于是「邮箱已被注册」「发布次数已达上限」「内容未通过合规检查」这些
 * 后端明明写好的中文原因全被替换成「服务响应异常」。反过来，直接把 `error.message`
 * 渲染上屏，又会把 `Failed to fetch`、`Unexpected token <` 这类英文原文露给用户。
 * 统一从这里取：只认含中文的文字，没有就用调用方给的兜底。
 */

const CJK = /[㐀-鿿]/;

export const hasChinese = (value: unknown): value is string => typeof value === 'string' && CJK.test(value);

function candidates(body: any): unknown[] {
  if (!body || typeof body !== 'object') return [];
  const raw = [body.message, body.error?.message, body.data?.message, typeof body.error === 'string' ? body.error : undefined];
  return raw.flatMap((item) => (Array.isArray(item) ? item : [item]));
}

/** 从响应体里取第一条中文原因；没有则返回 null。 */
export function apiErrorText(body: unknown): string | null {
  for (const item of candidates(body)) {
    if (hasChinese(item)) return item;
  }
  return null;
}

/** 从捕获到的异常里取中文原因；英文原文（网络层、解析层）一律换成兜底文案。 */
export function safeErrorText(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : (error as any)?.message;
  return hasChinese(message) ? message : fallback;
}
