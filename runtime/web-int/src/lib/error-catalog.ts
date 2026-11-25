/**
 * English copy for the create page. The sentences must match
 * runtime/api/src/common/error-catalog.ts. Next production builds cannot
 * import files outside this app, so the English lines live here and a test
 * checks them against the API catalog.
 */
export const ERROR_CATALOG = {
  NOT_CONFIGURED: {
    en: 'This service is not set up yet, so it cannot be used.',
  },
  AUTHENTICATION_REQUIRED: {
    en: 'Authentication is required. Please sign in to continue.',
  },
  NOT_PERMITTED: {
    en: 'You do not have permission to do this.',
  },
  QUOTA_EXHAUSTED: {
    en: "This month's allowance is used up. Upgrade your plan, or wait until it resets.",
  },
  REQUEST_NOT_ALLOWED: {
    en: 'This request cannot be processed. Change it before you submit it again.',
  },
  CONTENT_COMPLIANCE_BLOCKED: {
    en: 'The compliance check blocked this content. Nothing was saved or published.',
  },
  SERVICE_UNAVAILABLE: {
    en: 'The service is temporarily unavailable. Please try again later.',
  },
  VALIDATION_FAILED: {
    en: 'Some of the information is not valid. Check it and submit again.',
  },
  NOT_FOUND: {
    en: 'The requested item does not exist.',
  },
  CONFLICT: {
    en: 'The request conflicts with existing data.',
  },
  RATE_LIMITED: {
    en: 'Too many attempts. Please wait and try again.',
  },
} as const;

const CODE_ALIAS: Record<string, keyof typeof ERROR_CATALOG> = {
  AI_MONTHLY_QUOTA: 'QUOTA_EXHAUSTED',
  QUOTA_EXCEEDED: 'QUOTA_EXHAUSTED',
};

export function fallbackMessage(code: string, _english: boolean): string {
  const key = (code in ERROR_CATALOG ? code : CODE_ALIAS[code]) as keyof typeof ERROR_CATALOG | undefined;
  const row = (key && ERROR_CATALOG[key]) || ERROR_CATALOG.VALIDATION_FAILED;
  return row.en;
}
