export type Locale = 'en';
export const PRODUCTION_LOCALES: Locale[] = ['en'];
export const BETA_LOCALES: Locale[] = [];
export const SUPPORTED_LOCALES: Locale[] = ['en'];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
};

export function detectLocale(): Locale {
  return 'en';
}
