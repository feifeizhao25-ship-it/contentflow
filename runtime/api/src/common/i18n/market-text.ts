/**
 * Market-aware text for server-generated user-visible strings.
 *
 * MARKET_REGION=global is the international edition: every response, label and prompt is English.
 * Anything else (including unset) is the domestic edition, in Chinese.
 */
export function isGlobalMarket(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MARKET_REGION === 'global';
}

/** Pick the string for the current market. */
export function mt(zh: string, en: string, env: NodeJS.ProcessEnv = process.env): string {
  return isGlobalMarket(env) ? en : zh;
}

const CJK = /[\u3400-\u9fff]/;
export const hasCjk = (text: string): boolean => CJK.test(text);

/** Name of the workspace created at sign-up: the international edition must not store Chinese text the app later reads back. */
export function defaultWorkspaceName(name?: string | null, env: NodeJS.ProcessEnv = process.env): string {
  const n = (name || '').trim();
  if (isGlobalMarket(env)) return n ? `${n}'s workspace` : 'My workspace';
  return n ? `${n}的工作室` : '我的工作室';
}

/** Workspace settings written at sign-up; null keeps the column default (domestic edition, unchanged). */
export function defaultTenantSettings(env: NodeJS.ProcessEnv = process.env): Record<string, unknown> | null {
  return isGlobalMarket(env) ? { language: 'en-US', timezone: 'UTC', notification_email: true } : null;
}
