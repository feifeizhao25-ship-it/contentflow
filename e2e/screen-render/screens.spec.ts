/**
 * Renders public pages of both web apps at desktop and mobile widths.
 * No account cookie, and any request that leaves this machine is aborted.
 */
import { expect, test, type Page } from '@playwright/test';

const CN = process.env.CN_BASE || 'http://127.0.0.1:3101';
const INT = process.env.INT_BASE || 'http://127.0.0.1:3102';

const CN_PAGES = ['/', '/login', '/privacy', '/terms', '/pricing'];
const INT_PAGES = ['/', '/login', '/legal/privacy', '/legal/terms', '/pricing', '/skills'];

const BROKEN = /Application error|Internal Server Error|Unhandled Runtime Error|页面出错了|This page could not be found|Something went wrong/i;

async function stayLocal(page: Page) {
  await page.route('**/*', (route) => {
    let host = '';
    try {
      host = new URL(route.request().url()).hostname;
    } catch {
      return route.abort();
    }
    if (host === '127.0.0.1' || host === 'localhost') return route.continue();
    return route.abort();
  });
}

async function assertPainted(page: Page, label: string, timeout = 15_000) {
  await expect.poll(async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim().length, { timeout }).toBeGreaterThan(40);
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
  expect(text, label).not.toMatch(BROKEN);
  const box = await page.locator('body').boundingBox();
  expect(box && box.height > 0, label).toBeTruthy();
}

async function assertScreen(page: Page, url: string) {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  expect(response, url).not.toBeNull();
  expect(response!.status(), url).toBeLessThan(400);
  await assertPainted(page, url);
  expect(pageErrors, `${url}\n${pageErrors.join('\n')}`).toEqual([]);
}

test.describe('the check itself', () => {
  test('a blank document fails', async ({ page }) => {
    await page.setContent('<!doctype html><html><body> </body></html>');
    await expect(assertPainted(page, 'blank', 500)).rejects.toThrow();
  });

  test('an error document fails', async ({ page }) => {
    await page.setContent('<!doctype html><html><body>Application error: a client-side exception has occurred</body></html>');
    await expect(assertPainted(page, 'error', 500)).rejects.toThrow();
  });
});

test.beforeEach(async ({ page }) => {
  await stayLocal(page);
});

for (const path of CN_PAGES) {
  test(`domestic ${path} is not a blank or error screen`, async ({ page }) => {
    await assertScreen(page, `${CN}${path}`);
  });
}

for (const path of INT_PAGES) {
  test(`international ${path} is not a blank or error screen`, async ({ page }) => {
    await assertScreen(page, `${INT}${path}`);
  });
}
