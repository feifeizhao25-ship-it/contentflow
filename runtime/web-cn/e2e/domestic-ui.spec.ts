/**
 * 国内版界面走查。需要本机 API（AI_LOCAL_STUB=1）和 web-cn 已启动。
 * 截图目录：/opt/cursor/artifacts/ui-test
 *
 *   E2E_HOT_MODE=empty  热点显示「尚未接入」（不要配置 HOT_PROVIDER_URL）
 *   E2E_HOT_MODE=data   热点显示本地样例（HOT_PROVIDER_URL 指向 e2e/hot-mock.mjs）
 *   CF_UI_PG_DSN        本机测试库，用于把套餐改到即将到期、以及把额度改到用尽
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

const OUT = '/opt/cursor/artifacts/ui-test';
const PASSWORD = 'UiTest-2026';

type StepResult = { name: string; ok: boolean; detail?: string };

function shotDir() {
  fs.mkdirSync(OUT, { recursive: true });
}

async function shot(page: Page, info: TestInfo, name: string) {
  shotDir();
  const file = `${info.project.name}-${name}.png`;
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
  return file;
}

function psql(sql: string) {
  const dsn = process.env.CF_UI_PG_DSN;
  if (!dsn) throw new Error('缺少 CF_UI_PG_DSN');
  execFileSync('psql', [dsn, '-v', 'ON_ERROR_STOP=1', '-c', sql], { stdio: 'pipe' });
}

async function tenantId(page: Page): Promise<string> {
  const response = await page.request.get('/api/v1/auth/profile');
  const body = await response.json();
  const id = body?.data?.user?.tenant?.id || body?.user?.tenant?.id;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('没有读到工作区编号');
  return id;
}

async function openNav(page: Page) {
  const toggle = page.getByRole('button', { name: '打开导航菜单' });
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
}

async function gotoApp(page: Page, path: string, linkName: string) {
  await page.goto(path);
  if (page.url().includes(path)) return;
  await openNav(page);
  const more = page.getByText('更多', { exact: true });
  if (await more.first().isVisible().catch(() => false)) await more.first().click();
  await page.getByRole('link', { name: linkName }).click();
}

async function activePane(page: Page) {
  return page.locator('.ant-tabs-tabpane-active');
}

async function createApproved(page: Page, title: string, body: string) {
  await page.goto('/contents');
  await page.getByRole('button', { name: '新建内容' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('标题').fill(title);
  await dialog.getByLabel('正文').fill(body);
  await dialog.getByRole('button', { name: /^保\s*存$/ }).click();
  await expect(dialog).toBeHidden();
  await page.getByPlaceholder('搜索标题或正文').fill(title);
  await page.getByPlaceholder('搜索标题或正文').press('Enter');
  await expect(page.getByText(title).first()).toBeVisible();
  await page.getByRole('button', { name: '提交审核' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '提交审核' }).click();
  await expect(page.getByRole('button', { name: '确认可发布' })).toBeVisible();
  await page.getByRole('button', { name: '确认可发布' }).click();
  const confirm = page.getByRole('dialog');
  await confirm.getByText('我已自行检查').click();
  await confirm.getByRole('button', { name: '确认可以发布' }).click();
  await expect(page.getByRole('button', { name: /^发\s*布$/ })).toBeVisible();
}

test('国内版主要流程', async ({ page }, info) => {
  test.setTimeout(360_000);
  const results: StepResult[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
  });

  const run = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push({ name, ok: true });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      results.push({ name, ok: false, detail });
      await shot(page, info, `fail-${name}`).catch(() => undefined);
    }
  };

  const email = `ui-${info.project.name}-${Date.now()}@example.com`;

  await run('home-pricing', async () => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Solo' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Business' })).toBeVisible();
    await expect(page.getByText('待确认').first()).toBeVisible();
    const businessCard = page.locator('#plans article').filter({ hasText: 'Business' });
    const businessText = await businessCard.innerText();
    expect(businessText.indexOf('待确认')).toBeGreaterThan(-1);
    expect(businessText.indexOf('待确认')).toBeLessThan(businessText.indexOf('路线图（即将上线）'));
    await shot(page, info, 'home-plans');
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { name: 'Solo' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Business' })).toBeVisible();
    await expect(page.getByText('待确认').first()).toBeVisible();
    await expect(page.getByText('路线图（即将上线）').first()).toBeVisible();
    await shot(page, info, 'pricing');
  });

  await run('login-error', async () => {
    await page.goto('/login');
    await page.getByRole('tab', { name: '邮箱密码登录' }).click();
    const pane = await activePane(page);
    await pane.getByPlaceholder('邮箱地址').fill('nobody@example.com');
    await pane.getByPlaceholder('密码').fill('wrong-pass');
    await pane.getByRole('button', { name: /^登\s*录$/ }).click();
    await expect(page.getByText('邮箱或密码错误')).toBeVisible();
    await shot(page, info, 'login-error');
  });

  await run('register', async () => {
    await page.goto('/register');
    await page.getByRole('tab', { name: '邮箱注册' }).click();
    const pane = await activePane(page);
    await pane.getByPlaceholder('姓名').fill('界面测试');
    await pane.getByPlaceholder('邮箱地址').fill(email);
    await pane.getByPlaceholder('团队/公司名称').fill('界面测试工作室');
    await pane.getByPlaceholder('密码（至少6位）').fill(PASSWORD);
    await pane.getByPlaceholder('确认密码').fill(PASSWORD);
    await pane.getByRole('checkbox').check();
    await pane.getByRole('button', { name: /^注\s*册$/ }).click();
    await page.waitForURL('**/studio**');
    await shot(page, info, 'register-studio');
  });

  await run('generate', async () => {
    await expect(page.getByText('合规规则资料需要人工复核')).toBeVisible();
    await shot(page, info, 'admin-compliance-banner');
    await page.getByRole('button', { name: '一键生成文案包' }).click();
    await expect(page.getByText('请输入主题或一句话灵感')).toBeVisible();
    await shot(page, info, 'generate-empty');
    await page.getByPlaceholder('一句话描述你想做的内容').fill('秋天的读书笔记');
    await page.getByRole('button', { name: '一键生成文案包' }).click();
    await expect(page.getByText('本地联调正文：秋天的读书笔记')).toBeVisible();
    await expect(page.getByTestId('compliance-disclaimer')).toContainText('这不是法律意见');
    await expect(page.getByTestId('ai-allowance')).toContainText('预占');
    await expect(page.getByTestId('ai-allowance')).toContainText('已用');
    await shot(page, info, 'generate-success');
  });

  await run('compliance-and-publish', async () => {
    await createApproved(page, '秋天读书', '秋天读完一本书，记下三件还想再看的事。');
    await page.getByRole('button', { name: /^发\s*布$/ }).click();
    let dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('compliance-result')).toHaveAttribute('data-level', 'clear');
    await expect(dialog.getByTestId('compliance-disclaimer')).toContainText('这不是法律意见');
    await shot(page, info, 'compliance-clear');
    for (const name of ['视频号', '公众号', '抖音（手动发布）', 'B站（手动发布）']) {
      await dialog.getByRole('checkbox', { name: new RegExp(name) }).check();
    }
    await dialog.getByRole('button', { name: '创建人工发布任务' }).click();
    await page.waitForURL('**/publish**');
    await expect(page.getByText('小红书').first()).toBeVisible();
    await expect(page.getByText('抖音（手动发布）').first()).toBeVisible();
    await expect(page.getByText('B站（手动发布）').first()).toBeVisible();
    await expect(page.getByText('视频号').first()).toBeVisible();
    await expect(page.getByText('公众号').first()).toBeVisible();
    await shot(page, info, 'manual-publish-five');
    await page.getByRole('button', { name: '复制文案' }).first().click();
    await page.getByRole('button', { name: '我已手动发布' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: '确认已发布' }).click();
    await expect(page.getByText('已人工发布').first()).toBeVisible();
    await shot(page, info, 'manual-publish-confirmed');

    await createApproved(page, '绝对化用语', '这款产品是国家级最佳选择。');
    await page.getByRole('button', { name: /^发\s*布$/ }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('compliance-result')).toHaveAttribute('data-level', 'violation');
    await expect(dialog.getByTestId('compliance-disclaimer')).toContainText('这不是法律意见');
    await expect(dialog.getByRole('button', { name: '创建人工发布任务' })).toBeDisabled();
    await shot(page, info, 'compliance-blocked');
    await dialog.getByRole('button', { name: /^取\s*消$/ }).click();

    await createApproved(page, '站外引导', '想要资料请加微信领资料。');
    await page.getByRole('button', { name: /^发\s*布$/ }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('compliance-result')).toHaveAttribute('data-level', 'risk');
    await expect(dialog.getByTestId('compliance-disclaimer')).toContainText('这不是法律意见');
    await expect(dialog.getByRole('button', { name: '创建人工发布任务' })).toBeDisabled();
    await shot(page, info, 'compliance-risk');
    await dialog.getByText('我已自行核对以上风险').click();
    await expect(dialog.getByRole('button', { name: '创建人工发布任务' })).toBeEnabled();
    await dialog.getByRole('button', { name: '创建人工发布任务' }).click();
    await page.waitForURL('**/publish**');
    await shot(page, info, 'compliance-risk-acked');
  });

  await run('hot-list', async () => {
    await page.goto('/hot');
    if (process.env.E2E_HOT_MODE === 'empty') {
      await expect(page.getByText('尚未接入')).toBeVisible();
      await shot(page, info, 'hot-empty');
      return;
    }
    await expect(page.getByText('秋天的读书笔记怎么写')).toBeVisible();
    await expect(page.getByText(/来源 本地热点样例/)).toBeVisible();
    await expect(page.getByText(/截至 2026-10-23/)).toBeVisible();
    await shot(page, info, 'hot-list');
  });

  await run('team-invite', async () => {
    await gotoApp(page, '/team', '团队协作');
    await expect(page.getByRole('button', { name: '邀请成员' })).toBeDisabled();
    await expect(page.getByText('即将上线').first()).toBeVisible();
    await expect(page.getByText('目前还不能添加成员')).toBeVisible();
    await shot(page, info, 'team-invite-disabled');
  });

  await run('webhook-and-renewal', async () => {
    await gotoApp(page, '/settings/developer', '对外通知');
    await expect(page.getByTestId('webhook-gate')).toBeVisible();
    await expect(page.getByText('Business').first()).toBeVisible();
    await shot(page, info, 'webhook-not-business');

    const id = await tenantId(page);
    psql(`UPDATE "Tenant" SET plan = 'enterprise', plan_expires_at = NOW() + INTERVAL '3 days' WHERE id = '${id}'`);
    await page.goto('/studio');
    await openNav(page);
    await expect(page.getByText('不会自动扣款')).toBeVisible();
    await shot(page, info, 'renewal-notice');

    await gotoApp(page, '/settings/developer', '对外通知');
    await expect(page.getByTestId('webhook-form')).toBeVisible();
    await page.locator('#webhook-url').fill('http://example.com/hooks');
    await page.getByRole('button', { name: '保存通知地址' }).click();
    await expect(page.getByText('https://')).toBeVisible();
    await shot(page, info, 'webhook-bad-url');
    await page.locator('#webhook-url').fill('https://example.com/hooks');
    await page.getByRole('button', { name: '保存通知地址' }).click();
    await expect(page.getByText('签名密钥只显示这一次')).toBeVisible();
    await expect(page.getByTestId('webhook-secret')).toContainText('whsec_');
    await shot(page, info, 'webhook-created');
  });

  await run('quota-exhausted', async () => {
    const id = await tenantId(page);
    psql(`UPDATE "Tenant" SET limits = jsonb_set(COALESCE(limits::jsonb, '{}'::jsonb), '{max_ai_tokens_monthly}', '1') WHERE id = '${id}'`);
    await page.goto('/studio');
    await expect(page.getByTestId('ai-allowance')).toContainText('已用完');
    await shot(page, info, 'quota-exhausted');
  });

  await run('payment-not-configured', async () => {
    await page.goto('/pricing');
    await page.locator('h3', { hasText: 'Business' }).locator('xpath=ancestor::div[contains(@class,"flex-col")][1]').getByRole('button', { name: '立即开通' }).click();
    await page.getByRole('button', { name: '确认并支付' }).click();
    await expect(page.getByText(/尚未配置|未能下单/)).toBeVisible();
    await shot(page, info, 'payment-unavailable');
  });

  shotDir();
  fs.writeFileSync(`${OUT}/results-${info.project.name}.json`, JSON.stringify({ results, consoleErrors, failedRequests }, null, 2));
  const failed = results.filter((item) => !item.ok);
  expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
});
