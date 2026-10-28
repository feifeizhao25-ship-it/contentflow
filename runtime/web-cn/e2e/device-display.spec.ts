/**
 * 安卓用 Chromium 设备配置，苹果用 WebKit。
 * 截图：/opt/cursor/artifacts/screenshots/after/<android|ios>-<设备>-<页面>.png
 */
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const OUT = '/opt/cursor/artifacts/screenshots/after';

const ok = (data: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ success: true, data }),
});

function payload(url: string) {
  const path = new URL(url).pathname.replace(/^\/api\/v1/, '');
  if (path.startsWith('/auth/profile') || path.startsWith('/users/me')) {
    return ok({ user: { id: '11111111-1111-4111-8111-111111111111', email: 'linxiao@example.com', phone: '138****5678', phone_verified: true, name: '林晓', role: 'owner', tenant: { id: '22222222-2222-4222-8222-222222222222', name: '林晓工作室', plan: 'pro' } } });
  }
  if (path.startsWith('/billing/subscription')) return ok({ plan: 'pro', aiTokens: { limit: 50000, used: 1000, remaining: 49000 }, limits: { max_accounts: 10 } });
  if (path.startsWith('/hot/list')) return ok({ available: true, source: '本地热点样例', topics: [{ id: 'h1', topic: '秋天的读书笔记怎么写', heat: 128000, platform: 'xiaohongshu', prediction: 'rising', fetchedAt: '2026-10-23T08:00:00.000Z', source: '本地热点样例' }] });
  if (path.startsWith('/publish/tasks')) return ok({ tasks: [{ id: 't1', status: 'manual_pending', scheduled_at: '2026-10-28T04:05:00.000Z', content: { title: '秋天的读书笔记' }, platform_content: { platform: 'xhs' } }], pagination: { total: 1, page: 1, pageSize: 20, totalPages: 1 } });
  if (path.startsWith('/contents/review-policy')) return ok({ userId: '11111111-1111-4111-8111-111111111111', role: 'owner', canReview: true, canSelfConfirm: false, otherReviewers: 1 });
  if (path.startsWith('/contents')) return ok({ contents: [], pagination: { total: 0, page: 1, pageSize: 100, totalPages: 0 } });
  if (path.startsWith('/accounts')) return ok([]);
  if (path.startsWith('/analytics/overview')) return ok({ week: { publish: { total: 0, published: 0, failed: 0, inProgress: 0, manualPending: 0, manualDone: 0, cancelled: 0 }, ai: { generations: 0, byType: [], savedAsContent: 0, approvedOrPublished: 0 } }, month: { publish: { total: 0, published: 0, failed: 0, inProgress: 0, manualPending: 0, manualDone: 0, cancelled: 0 }, ai: { generations: 0, byType: [], savedAsContent: 0, approvedOrPublished: 0 } }, failureReasons: [], engagement: { available: false, message: '接通平台授权后显示', detail: '互动数据需要平台授权后才能看到。' } });
  if (path.startsWith('/ai/compliance-sources/status')) return ok({ needsReview: false });
  if (path.startsWith('/team/members')) return ok([]);
  if (path.startsWith('/team/activity')) return ok([]);
  if (path.startsWith('/materials')) return ok([]);
  return ok({});
}

function filePrefix(project: string) {
  if (project.startsWith('android-')) return `android-${project.slice('android-'.length)}`;
  if (project.startsWith('ios-')) return `ios-${project.slice('ios-'.length)}`;
  return project;
}

async function shoot(page: Page, project: string, slug: string) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = `${OUT}/${filePrefix(project)}-${slug}.png`;
  await page.screenshot({ path: file, fullPage: false });
  const metrics = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
    const body = getComputedStyle(document.body);
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      text: (document.body.innerText || '').replace(/\s+/g, ' ').trim(),
      viewport: meta,
      font: body.fontFamily,
      paddingTop: body.paddingTop,
      minHeight: body.minHeight,
      dvh: CSS.supports('height', '100dvh'),
      dateInputs: document.querySelectorAll('input[type="date"], input[type="datetime-local"]').length,
    };
  });
  expect(metrics.overflow, slug).toBeLessThanOrEqual(1);
  expect(metrics.text.length, slug).toBeGreaterThan(15);
  expect(metrics.text).not.toContain('页面出错了');
  expect(metrics.viewport).toMatch(/viewport-fit=cover/);
  expect(metrics.font).toMatch(/PingFang SC/);
  expect(metrics.dvh, 'Safari/Chromium 应支持 dvh').toBe(true);
  expect(metrics.dateInputs, '不使用系统日期框，避免 Safari 日期控件错位').toBe(0);
  return metrics;
}

test('设备上的登录、热点和发布日期', async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.context().addCookies([{ name: 'ff_token', value: 'device-audit', url: info.project.use.baseURL || 'http://127.0.0.1:3000' }]);
  await page.route('**/api/v1/**', (route) => route.fulfill(payload(route.request().url())));

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('欢迎回来').first()).toBeVisible();
  const login = await shoot(page, info.project.name, 'login');
  expect(login.text).toContain('分发侠');

  await page.goto('/hot', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/12\.8万/).first()).toBeVisible();
  const hot = await shoot(page, info.project.name, 'hot');
  await expect(page.getByLabel('小红书').first()).toBeVisible();
  expect(hot.text).not.toContain('k 指数');

  await page.goto('/publish', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('发布中心').first()).toBeVisible();
  await page.getByPlaceholder('开始日期').click();
  await expect(page.locator('.ant-picker-dropdown').last()).toBeVisible();
  const panel = await page.locator('.ant-picker-panel-container').last().boundingBox();
  const viewport = page.viewportSize();
  expect(panel && viewport && panel.x >= -1 && panel.x + panel.width <= viewport.width + 2).toBe(true);
  await shoot(page, info.project.name, 'publish-date');
  await page.keyboard.press('Escape');

  expect(errors, errors.join('\n')).toEqual([]);
});
