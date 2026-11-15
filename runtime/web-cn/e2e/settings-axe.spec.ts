/**
 * 设置页 axe：390 宽和桌面都不得有 critical / serious。
 * 夹具用户手机号已验证，并打开「账号与数据」，这两处才是原先对比度失败的节点。
 * 不登录真实账号。接口在浏览器里用本地夹具应答。
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const axeSource = fs.readFileSync(path.join(process.cwd(), 'node_modules/axe-core/axe.js'), 'utf8');

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'linxiao@example.com',
  phone: '138****5678',
  phone_verified: true,
  real_name_verified: false,
  name: '林晓',
  role: 'owner',
  tenant: {
    id: '22222222-2222-4222-8222-222222222222',
    name: '林晓工作室',
    plan: 'pro',
  },
};

const widths = [
  { name: '390', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

function payload(url: string) {
  const path = new URL(url).pathname.replace(/^\/api\/v1/, '');
  const data = path.startsWith('/auth/profile') || path.startsWith('/users/me')
    ? { user }
    : path.startsWith('/billing/subscription')
      ? { plan: 'pro' }
      : {};
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  };
}

async function axeBlocking(page: Page) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as {
      axe: {
        run: (node: Document) => Promise<{
          violations: { id: string; impact?: string | null; help: string; nodes: { html: string }[] }[];
        }>;
      };
    }).axe;
    const results = await axe.run(document);
    return results.violations
      .filter((item) => item.impact === 'serious' || item.impact === 'critical')
      .map((item) => `${item.impact} ${item.id}: ${item.help} :: ${item.nodes.slice(0, 3).map((node) => node.html).join(' | ')}`);
  });
  expect(violations, violations.join('\n')).toEqual([]);
}

test('设置页在 390 和桌面没有 critical 或 serious 的 axe 问题', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', '两个宽度在这条用例里切换');
  test.setTimeout(120_000);
  await page.context().addCookies([{ name: 'ff_token', value: 'settings-axe-not-a-session', url: 'http://127.0.0.1:3000' }]);
  await page.route('**/api/v1/**', (route) => route.fulfill(payload(route.request().url())));

  for (const viewport of widths) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    const heading = page.getByRole('heading', { name: '管理设置' });
    await expect(heading).toBeVisible();
    await expect.poll(async () => heading.evaluate((el) => {
      let opacity = 1;
      let node: HTMLElement | null = el;
      while (node) {
        opacity *= Number(getComputedStyle(node).opacity);
        node = node.parentElement;
      }
      return opacity;
    })).toBeGreaterThan(0.99);

    await expect(page.getByText('已验证')).toBeVisible();
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(6);
    const tablist = page.getByRole('tablist');
    await expect(tablist.locator('.ant-tabs-nav-more, [aria-haspopup="listbox"]')).toHaveCount(0);
    const boxes = await tabs.evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { name: (node.textContent || '').replace(/\s+/g, ''), right: rect.right, left: rect.left };
    }));
    expect(boxes.map((box) => box.name)).toEqual(['个人资料', '创作计划偏好', '团队设置', '套餐与用量', '通知设置', '账号与数据']);
    for (const box of boxes) {
      expect(box.left, `${box.name} @ ${viewport.name}`).toBeGreaterThanOrEqual(-1);
      expect(box.right, `${box.name} @ ${viewport.name}`).toBeLessThanOrEqual(viewport.width + 1);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, viewport.name).toBeLessThanOrEqual(1);
    await axeBlocking(page);

    await page.getByRole('tab', { name: '账号与数据' }).click();
    await expect(page.getByRole('button', { name: '注销账号' })).toBeVisible();
    await expect(page.getByText('永久删除，无法恢复')).toBeVisible();
    expect(await page.getByRole('tabpanel').getAttribute('aria-label') ?? '').not.toMatch(/safety/i);
    await expect(page.getByRole('tabpanel')).toHaveAccessibleName('账号与数据');
    await axeBlocking(page);
  }
});
