/**
 * 国内版权限与网页健壮性：
 * 邀请留言会提交、成功后可复制链接、席位满有「查看套餐」；
 * 账号名为空不崩溃；公开页访客不打需要登录的接口；内容库能回到创作页。
 *   node --import ./scripts/ts-extensionless.mjs --experimental-strip-types scripts/test-cn-robustness.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NextRequest } from 'next/server.js';
import { accountConnectionLabel, accountDisplayName, accountInitial, accountRunLabel } from '../src/lib/account-label.ts';
import { batchDeleteSummary, continueCreatingHref } from '../src/lib/content-continue.ts';
import { authedChromeAllowed, isPublicAppPath, readSignedIn, shouldRequestAuthedChrome } from '../src/lib/public-session.ts';
import { inviteRequestBody, inviteSeatFull } from '../src/lib/team-invite-form.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { failures++; console.error(`  FAIL ${name}: ${e.message}`); }
}
async function checkAsync(name, fn) {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { failures++; console.error(`  FAIL ${name}: ${e.message}`); }
}

console.log('CN robustness tests');

check('占位授权显示未接通，超额才标暂停', () => {
  assert.equal(accountConnectionLabel('oauth_placeholder_not_live'), '未接通');
  assert.equal(accountRunLabel('active', 'oauth_placeholder_not_live', true), '未接通');
  assert.equal(accountRunLabel('active', 'oauth', false), '已暂停（超出套餐名额）');
  assert.equal(accountRunLabel('active', 'oauth', undefined), '运行中');
  assert.equal(read('src/app/(main)/accounts/page.tsx').includes('官方授权'), false);
});

check('邀请表单把留言交给后端，空白留言不传', () => {
  assert.deepEqual(
    inviteRequestBody({ email: ' A@Example.com ', role: 'editor', message: '  欢迎加入  ' }),
    { email: 'A@Example.com', role: 'editor', message: '欢迎加入' },
  );
  assert.deepEqual(inviteRequestBody({ email: 'a@b.cn', role: 'viewer', message: '   ' }), {
    email: 'a@b.cn',
    role: 'viewer',
  });
  assert.equal(Object.prototype.hasOwnProperty.call(inviteRequestBody({ message: '' }), 'message'), false);
});

check('席位已满：错误码或中文原因都识别，其它失败不算', () => {
  assert.equal(inviteSeatFull({ error: { code: 'INVITE_SEAT_FULL', message: '席位已满（上限 1）' } }), true);
  assert.equal(inviteSeatFull({ error: { message: '席位已满（上限 5）' } }), true);
  assert.equal(inviteSeatFull({ error: { code: 'INVITE_CLOSED', message: '邀请已结束' } }), false);
  assert.equal(inviteSeatFull(null), false);
});

check('团队页：留言随请求提交，成功后关弹窗并给出可复制链接，席位满在弹窗里去看套餐', () => {
  const page = read('src/app/(main)/team/page.tsx');
  const modal = page.slice(page.indexOf('<Modal'), page.indexOf('</Modal>') + '</Modal>'.length);
  assert.match(page, /inviteRequestBody\(values\)/);
  assert.match(page, /name="message"/);
  assert.match(page, /setInviteModalVisible\(false\)/);
  assert.match(page, /复制邀请链接/);
  assert.match(page, /aria-label="邀请链接"/);
  assert.match(modal, /查看套餐/);
  assert.match(modal, /href="\/pricing"/);
  assert.match(modal, /inviteSeatFull|seatFull/);
  assert.doesNotMatch(page, /JSON\.stringify\(\{ email: values\.email, role: values\.role \}\)/);
});

check('账号名为空、空白或缺失时不取首字，页面不再直接下标', () => {
  assert.equal(accountDisplayName(null), '未命名账号');
  assert.equal(accountDisplayName(undefined), '未命名账号');
  assert.equal(accountDisplayName(''), '未命名账号');
  assert.equal(accountDisplayName('   '), '未命名账号');
  assert.equal(accountDisplayName('小红书观察'), '小红书观察');
  assert.equal(accountInitial(null), '未');
  assert.equal(accountInitial(''), '未');
  assert.equal(accountInitial('微博'), '微');
  const page = read('src/app/(main)/accounts/page.tsx');
  assert.match(page, /accountDisplayName\(acc\.account_name\)/);
  assert.match(page, /accountInitial\(account\.accountName\)/);
  assert.doesNotMatch(page, /accountName\[0\]/);
  assert.doesNotMatch(page, /account\.accountName\[0\]/);
});

check('公开页路径包含定价页；已登录的工作台页面仍请求身份', () => {
  assert.equal(isPublicAppPath('/pricing'), true);
  assert.equal(isPublicAppPath('/pricing/'), true);
  assert.equal(isPublicAppPath('/privacy'), true);
  assert.equal(isPublicAppPath('/studio'), false);
  assert.equal(shouldRequestAuthedChrome('/pricing', false), false);
  assert.equal(shouldRequestAuthedChrome('/pricing', true), true);
  assert.equal(shouldRequestAuthedChrome('/accounts', false), true);
});

await checkAsync('访客打开定价页只问会话探针，不请求需要登录的接口', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).includes('/auth/profile') || String(url).includes('/billing/subscription')) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
    }
    return new Response(JSON.stringify({ signedIn: false }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  assert.equal(await readSignedIn(fetchImpl), false);
  assert.equal(await authedChromeAllowed('/pricing', fetchImpl), false);
  assert.equal(await authedChromeAllowed('/studio', fetchImpl), true);
  assert.deepEqual(calls, ['/api/auth/session', '/api/auth/session']);
  assert.ok(calls.every((url) => !url.includes('/auth/profile') && !url.includes('/billing/subscription')));
});

await checkAsync('已登录访问定价页可以继续请求工作台接口', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ signedIn: true }), { status: 200 });
  assert.equal(await authedChromeAllowed('/pricing', fetchImpl), true);
});

await checkAsync('会话探针：没有 cookie 不访问后端；有 cookie 只回答已登录，不回传令牌', async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response('{}', { status: 200 });
  };
  const { GET } = await import('../src/app/api/auth/session/route.ts');
  const guest = await GET(new NextRequest('http://localhost/api/auth/session'));
  assert.equal(guest.status, 200);
  assert.deepEqual(await guest.json(), { signedIn: false });
  const signed = await GET(new NextRequest('http://localhost/api/auth/session', { headers: { cookie: 'ff_token=secret-token' } }));
  const body = await signed.json();
  assert.deepEqual(body, { signedIn: true });
  assert.equal(JSON.stringify(body).includes('secret-token'), false);
  assert.deepEqual(calls, []);
});

check('布局和定价页在公开页用会话探针挡住需要登录的请求', () => {
  const layout = read('src/components/layout/MainLayout.tsx');
  const pricing = read('src/app/(main)/pricing/page.tsx');
  assert.match(layout, /authedChromeAllowed\(pathname\)/);
  assert.match(layout, /if \(!allowed\)/);
  const gated = layout.slice(layout.indexOf('authedChromeAllowed'), layout.indexOf('apiClient.get(\'/billing/subscription\''));
  assert.match(gated, /if \(!allowed\)/);
  assert.match(pricing, /readSignedIn\(\)/);
  const purchase = pricing.slice(pricing.indexOf('const handlePurchase'), pricing.indexOf('const confirmPayment'));
  assert.ok(purchase.indexOf('readSignedIn') < purchase.indexOf('fetchCurrentUser'));
  const resumed = pricing.slice(pricing.indexOf('const resumed'), pricing.indexOf('return ('));
  assert.match(resumed, /readSignedIn/);
  assert.match(resumed, /if \(!signedIn\)/);
});

check('内容库列表和详情都有回到创作页的入口，批量删除走汇总接口', () => {
  assert.equal(continueCreatingHref('c 1'), '/studio?contentId=c%201');
  assert.equal(batchDeleteSummary({ succeeded: 2, failed: 1, failures: [{ message: '只能删除自己创建的内容' }] }), '已删除 2 条，另有 1 条没有删除');
  assert.match(batchDeleteSummary({ succeeded: 0, failed: 1, failures: [{ message: '只能删除自己创建的内容' }] }), /只能删除自己创建的内容/);
  assert.equal(batchDeleteSummary({ succeeded: 3, failed: 0 }), '已删除 3 条内容');
  const page = read('src/app/(main)/contents/page.tsx');
  const preview = page.slice(page.lastIndexOf('<Modal'), page.lastIndexOf('</Modal>'));
  assert.match(page, /在创作页继续/);
  assert.match(page, /continueCreatingHref/);
  assert.match(preview, /continueCreating\(previewFor\)/);
  const list = page.slice(page.indexOf('title: \'操作\''), page.indexOf('const rowSelection'));
  assert.match(list, /continueCreating\(record\)/);
  const cardStart = page.indexOf('const renderCard');
  const card = page.slice(cardStart, page.indexOf('return (', cardStart));
  assert.match(card, /continueCreating\(record\)/);
  assert.match(page, /apiClient\.post\('\/contents\/batch-delete'/);
  assert.match(page, /batchDeleteSummary/);
  assert.doesNotMatch(page, /for \(const key of selectedRowKeys\)/);
});

check('后端：删除权限、批量汇总、密钥开关默认关闭、邀请留言落库', () => {
  const content = read('../api/src/modules/content/content.service.ts');
  const keys = read('../api/src/modules/developer/api-key.service.ts');
  const team = read('../api/src/modules/team/team.service.ts');
  const schema = read('../api/src/database/prisma/schema.prisma');
  assert.match(content, /CONTENT_DELETE_ANY_ROLES = \["owner", "admin"\]/);
  assert.match(content, /只能删除自己创建的内容/);
  assert.match(content, /async deleteMany/);
  assert.match(content, /summary\.failed \+= 1/);
  assert.match(keys, /DEVELOPER_API_KEYS_ENABLED === 'true'/);
  assert.match(keys, /暂未开放/);
  assert.match(team, /normalizeMessage/);
  assert.match(team, /message,/);
  assert.match(schema, /message\s+String\?/);
});

if (failures) {
  console.error(`${failures} failed`);
  process.exit(1);
}
console.log('All CN robustness tests passed');
