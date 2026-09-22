/**
 * Only the explicitly configured self-hosted SENTRY_URL origin may receive events.
 * Deployment owners must verify that origin is hosted domestically; a domain suffix
 * cannot establish data residency. Missing configuration disables reporting.
 */
const OFFSHORE_SENTRY = /(^|\.)sentry\.io\.?$/i;

export function domesticSentryDsn(
  raw: string | undefined | null,
  trustedOrigin: string | undefined = process.env.SENTRY_URL,
): string | undefined {
  if (!raw || !trustedOrigin) return undefined;
  try {
    const url = new URL(raw);
    const trusted = new URL(trustedOrigin);
    if (url.protocol !== 'https:' || trusted.protocol !== 'https:') return undefined;
    if (OFFSHORE_SENTRY.test(url.hostname) || OFFSHORE_SENTRY.test(trusted.hostname)) return undefined;
    if (trusted.username || trusted.password || trusted.search || trusted.hash) return undefined;
    if (url.origin !== trusted.origin || url.password || url.search || url.hash) return undefined;
    return raw;
  } catch {
    return undefined;
  }
}
