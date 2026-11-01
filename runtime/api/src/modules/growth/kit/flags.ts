/** Feature flags for the growth kit. All default OFF. Only the owner changes them on the server; OpenClaw has no permission to. */
export interface GrowthFlags {
  growthLoop: boolean; // GROWTH_LOOP_ENABLED
  referral: boolean; // REFERRAL_ENABLED
  sharecard: boolean; // SHARECARD_ENABLED
  seoPages: boolean; // SEO_PAGES_ENABLED
}

export const FLAGS_OFF: GrowthFlags = Object.freeze({ growthLoop: false, referral: false, sharecard: false, seoPages: false });

const on = (env: Record<string, string | undefined>, key: string): boolean =>
  ['1', 'true', 'yes', 'on'].includes(String(env[key] ?? '0').trim().toLowerCase());

/** Pass the environment explicitly (e.g. process.env); an empty or missing environment means everything is OFF. */
export function growthFlagsFromEnv(env: Record<string, string | undefined> = {}): GrowthFlags {
  return {
    growthLoop: on(env, 'GROWTH_LOOP_ENABLED'),
    referral: on(env, 'REFERRAL_ENABLED'),
    sharecard: on(env, 'SHARECARD_ENABLED'),
    seoPages: on(env, 'SEO_PAGES_ENABLED'),
  };
}
