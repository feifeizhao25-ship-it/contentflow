/**
 * 国内版只允许把错误上报到境内自建的 Sentry。
 *
 * 原来 instrumentation.ts 只要配了 SENTRY_DSN 就上报；运维照着 Sentry 文档填一个
 * `https://…@o123.ingest.sentry.io/…`，服务端报错里的请求路径、参数、用户输入就会出境
 * （sendDefaultPii=false 不影响异常消息与堆栈里的内容）。
 * 这里把 sentry.io 及其子域名一律拒绝，DSN 必须是 https。
 */
const OFFSHORE_SENTRY = /(^|\.)sentry\.io$/i;

export function domesticSentryDsn(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:') return undefined;
  if (OFFSHORE_SENTRY.test(url.hostname)) return undefined;
  return raw;
}
