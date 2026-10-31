/**
 * HTTP 请求头只能是 Latin-1（ByteString）。把非 ASCII 的值直接放进 fetch 的 headers 会抛
 * "Cannot convert argument to a ByteString"，国际版的全部 AI 生成曾因此 100% 失败
 * （`X-Title: '分发侠'`）。
 */

/** 去掉控制字符与非 ASCII，保证可以安全放进请求头；全被去掉时返回 fallback。 */
export function asciiHeaderValue(value: string, fallback = 'app'): string {
  const cleaned = String(value ?? '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

/**
 * OpenRouter 的 X-Title 允许 RFC 2047 之外的任意字符串，但 fetch 只接受 Latin-1。
 * 统一用 ASCII 值，品牌名用拉丁字母。
 */
export function openRouterHeaderValue(title: string): string {
  return asciiHeaderValue(title, 'Fenfa AI');
}
