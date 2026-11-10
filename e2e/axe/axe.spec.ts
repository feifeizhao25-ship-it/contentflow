/**
 * Smoke gate for serious and critical axe-core violations on the key routes.
 * Moderate and minor findings are reported by axe but do not fail this check.
 * This is not a WCAG certification, and it does not sign in with a real account.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const CN = process.env.CN_BASE || 'http://127.0.0.1:3101';
const INT = process.env.INT_BASE || 'http://127.0.0.1:3102';

type Route = { app: 'cn' | 'int'; path: string; name: string; signedInShell?: boolean };

const ROUTES: Route[] = [
  { app: 'cn', path: '/login', name: 'login' },
  { app: 'cn', path: '/register', name: 'signup' },
  { app: 'cn', path: '/studio', name: 'workspace home', signedInShell: true },
  { app: 'cn', path: '/pricing', name: 'plans' },
  { app: 'cn', path: '/settings', name: 'settings', signedInShell: true },
  { app: 'int', path: '/login', name: 'login' },
  { app: 'int', path: '/', name: 'workspace home' },
  { app: 'int', path: '/pricing', name: 'plans' },
  { app: 'int', path: '/settings', name: 'settings', signedInShell: true },
];

function baseFor(app: Route['app']) {
  return app === 'cn' ? CN : INT;
}

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

function blocking(violations: { id: string; impact?: string | null; help: string; nodes: { html: string }[] }[]) {
  return violations
    .filter((item) => item.impact === 'serious' || item.impact === 'critical')
    .map((item) => `${item.impact} ${item.id}: ${item.help} :: ${item.nodes.slice(0, 3).map((node) => node.html).join(' | ')}`);
}

async function openRoute(page: Page, route: Route) {
  const base = baseFor(route.app);
  if (route.signedInShell) {
    await page.context().addCookies([{ name: 'ff_token', value: 'axe-smoke-not-a-session', url: base }]);
  }
  const response = await page.goto(`${base}${route.path}`, { waitUntil: 'domcontentloaded' });
  expect(response, route.path).not.toBeNull();
  expect(response!.status(), `${route.app} ${route.path}`).toBeLessThan(400);
  const heading = page.locator('h1').first();
  await expect(heading).toBeVisible();
  // Entrance fades start near opacity 0. Scan the settled page, not a mid-animation frame.
  await expect.poll(async () => heading.evaluate((el) => {
    let opacity = 1;
    let node: HTMLElement | null = el;
    while (node) {
      opacity *= Number(getComputedStyle(node).opacity);
      node = node.parentElement;
    }
    return opacity;
  })).toBeGreaterThan(0.99);
}

test.beforeEach(async ({ page }) => {
  await stayLocal(page);
});

test('a control with no accessible name fails this gate', async ({ page }) => {
  await page.setContent('<!doctype html><html lang="en"><head><title>Gate</title></head><body><main><h1>Gate</h1><button></button></main></body></html>');
  const results = await new AxeBuilder({ page }).analyze();
  expect(blocking(results.violations).length).toBeGreaterThan(0);
});

test('the international site has no signup page', async ({ page }) => {
  const response = await page.request.get(`${INT}/signup`, { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location ?? '').toContain('/login');
});

for (const route of ROUTES) {
  test(`${route.app} ${route.name} (${route.path}) has no serious or critical axe violation`, async ({ page }) => {
    await openRoute(page, route);
    const results = await new AxeBuilder({ page }).analyze();
    expect(blocking(results.violations), blocking(results.violations).join('\n')).toEqual([]);
  });
}
