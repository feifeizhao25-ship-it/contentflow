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
