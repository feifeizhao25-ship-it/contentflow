/**
 * 国内版显示回归。不依赖真实账号和模型，接口用本地夹具。
 * 断言：无页面崩溃、无横向溢出、不是空白页、关键文案可见。
 */
import { expect, test, type Page } from '@playwright/test';

const ok = (data: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ success: true, data }),
});

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'linxiao@example.com',
  phone: '138****5678',
  phone_verified: true,
  name: '林晓',
  role: 'owner',
  tenant: { id: '22222222-2222-4222-8222-222222222222', name: '林晓工作室', plan: 'pro', plan_expires_at: '2026-11-02T00:00:00.000Z', limits: { max_accounts: 10, max_publishes_monthly: 100, max_storage_gb: 20 }, usage_stats: { accounts_count: 1, publishes_this_month: 1, storage_used_mb: 1 } },
};

function payload(url: string) {
  const path = new URL(url).pathname.replace(/^\/api\/v1/, '');
  if (path.startsWith('/auth/profile') || path.startsWith('/users/me')) return ok({ user });
  if (path.startsWith('/billing/subscription')) return ok({ plan: 'pro', renewalDate: '2026-11-02T00:00:00.000Z', usedQuota: 1, monthlyQuota: 10, aiTokens: { limit: 50000, used: 1000, remaining: 49000 }, limits: user.tenant.limits });
  if (path.startsWith('/contents/review-policy')) return ok({ userId: user.id, role: 'owner', canReview: true, canSelfConfirm: false, otherReviewers: 1 });
  if (path.startsWith('/contents')) return ok({ contents: [{ id: 'c2', content_type: 'article', title: '企业微信待审批：新品发布文案', body: '等待审核', status: 'pending_review', created_at: '2026-10-27T02:15:00.000Z', created_by: '33333333-3333-4333-8333-333333333333' }], pagination: { total: 1, page: 1, pageSize: 100, totalPages: 1 } });
  if (path.startsWith('/publish/tasks')) return ok({ tasks: [], pagination: { total: 0, page: 1, pageSize: 20, totalPages: 0 } });
  if (path.startsWith('/accounts')) return ok([{ id: 'a2', platform: 'weibo', account_name: '分发侠观察', follower_count: 2400, status: 'expired', auth_type: 'oauth' }]);
  if (path.startsWith('/analytics/overview')) return ok({ week: { publish: { total: 0, published: 0, failed: 0, inProgress: 0, manualPending: 0, manualDone: 0, cancelled: 0 }, ai: { generations: 0, byType: [], savedAsContent: 0, approvedOrPublished: 0 } }, month: { publish: { total: 0, published: 0, failed: 0, inProgress: 0, manualPending: 0, manualDone: 0, cancelled: 0 }, ai: { generations: 0, byType: [], savedAsContent: 0, approvedOrPublished: 0 } }, failureReasons: [], engagement: { available: false, message: '接通平台授权后显示', detail: '互动数据需要平台授权后才能看到。' } });
  if (path.startsWith('/hot/list')) return ok({ available: true, source: '本地热点样例', topics: [{ id: 'h1', topic: '秋天的读书笔记怎么写', heat: 128000, platform: 'xiaohongshu', prediction: 'rising', fetchedAt: '2026-10-23T08:00:00.000Z', source: '本地热点样例' }] });
  if (path.startsWith('/materials')) return ok([]);
  if (path.startsWith('/team/members')) return ok([{ id: 'u1', name: '林晓', email: 'linxiao@example.com', role: 'owner', status: 'active', created_at: '2026-08-01T00:00:00.000Z' }]);
  if (path.startsWith('/team/activity')) return ok([{ id: 'l1', action: 'team.member_removed', resource_type: 'user', user_id: 'actor', created_at: '2026-10-27T02:15:00.000Z' }]);
  if (path.startsWith('/ai/compliance-sources/status')) return ok({ needsReview: false });
  if (path.startsWith('/developer/webhooks')) return { status: 403, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message: '对外通知仅 Business 套餐可用' } }) };
  return ok({});
}

async function assertFrame(page: Page) {
  // 侧栏第一次按桌面宽度画，量完窗口才收成抽屉。等布局稳定后再量，避免把这一帧当成横向溢出。
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), { timeout: 8_000 }).toBeLessThanOrEqual(1);
  const text = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').trim());
  expect(text.length, page.url()).toBeGreaterThan(20);
  expect(text, page.url()).not.toContain('页面出错了');
  expect(text).not.toContain('k 指数');
  expect(text).not.toContain('TikTok');
  expect(text).not.toContain('RedBook');
  return text;
}

const widths = [1440, 1280, 390, 360];

test('四个宽度下主要页面可显示', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', '宽度在这条用例里切换，避免重复跑');
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.context().addCookies([{ name: 'ff_token', value: 'display-guard', url: 'http://127.0.0.1:3000' }]);
  await page.route('**/api/v1/**', (route) => route.fulfill(payload(route.request().url())));

  const cases: Array<{ path: string; expect: RegExp }> = [
    { path: '/login', expect: /欢迎回来/ },
    { path: '/hot', expect: /12\.8万 热度/ },
    { path: '/team?tab=approvals', expect: /移除了成员/ },
    { path: '/accounts', expect: /微博/ },
    { path: '/accounts', expect: /授权已过期/ },
    { path: '/contents', expect: /待审核/ },
    { path: '/analytics', expect: /接通平台授权后显示/ },
    { path: '/traffic-sandwich', expect: /策略工作台/ },
    { path: '/experience-week', expect: /第 7 天/ },
    { path: '/schedule', expect: /排期日历/ },
    { path: '/settings', expect: /个人资料/ },
  ];

  for (const width of widths) {
    await page.setViewportSize({ width, height: width >= 1000 ? 900 : 844 });
    for (const item of cases) {
      await page.goto(item.path, { waitUntil: 'domcontentloaded' });
      await expect(page.getByText(item.expect).locator('visible=true').first()).toBeVisible({ timeout: 20_000 });
      const text = await assertFrame(page);
      expect(text, `${item.path} @ ${width}`).toMatch(item.expect);
    }
  }

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});
