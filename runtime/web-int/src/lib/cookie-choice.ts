/** Non-essential cookies stay off until the person accepts them. */

export const COOKIE_CHOICE_KEY = 'contentflow.cookie-choice';
export type CookieChoice = 'rejected' | 'accepted';

export function readCookieChoice(storage: { getItem: (key: string) => string | null } | null): CookieChoice | null {
  const value = storage?.getItem(COOKIE_CHOICE_KEY);
  return value === 'rejected' || value === 'accepted' ? value : null;
}

export function analyticsAllowed(choice: CookieChoice | null): boolean {
  return choice === 'accepted';
}
