import { analyticsAllowed, readCookieChoice } from './cookie-choice';

describe('cookie choice', () => {
  it('treats a first visit as rejected for analytics', () => {
    expect(readCookieChoice({ getItem: () => null })).toBeNull();
    expect(analyticsAllowed(null)).toBe(false);
    expect(analyticsAllowed('rejected')).toBe(false);
    expect(analyticsAllowed('accepted')).toBe(true);
  });
});
