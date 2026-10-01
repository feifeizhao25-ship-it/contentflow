/**
 * 账号与数据：导出、注销、保存资料。
 *
 * 改之前：隐私政策承诺「可在账号设置中申请访问、更正、导出或删除」，设置页里没有任何入口；
 * 「保存修改」只是 await 一个 1 秒的定时器就提示「个人资料已更新」——什么都没保存；
 * 通知开关是没有状态的 defaultChecked。
 *   node --import ./scripts/ts-extensionless.mjs --experimental-strip-types scripts/test-account-data.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AccountError,
  deleteMyAccount,
  exportFilename,
  fetchMyDataExport,
  savePreferences,
  saveProfile,
} from '../src/lib/account-service.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`  PASS ${name}`); } catch (e) { failures++; console.error(`  FAIL ${name}: ${e.message}`); }
}
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

console.log('Account data tests');

await check('导出：走本人的导出接口，返回可保存的 JSON 文本与文件名', async () => {
  const calls = [];
  const { filename, text } = await fetchMyDataExport(async (url, init) => {
    calls.push({ url, init });
    return json(200, { success: true, data: { account: { email: 'a@example.com' }, orders: [] } });
  }, new Date(2026, 8, 29));
  assert.equal(calls[0].url, '/api/v1/users/me/export');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(filename, '分发侠-我的数据-20260929.json');
  assert.equal(JSON.parse(text).account.email, 'a@example.com');
});

await check('注销：confirm 恒为 true，带上密码；请求里没有任何 user_id', async () => {
  const calls = [];
  const result = await deleteMyAccount('my-password', async (url, init) => {
    calls.push({ url, init });
    return json(200, { success: true, data: { status: 'deleted', workspace_deleted: true, retained: ['PaymentOrder（订单）'] } });
  });
  assert.equal(calls[0].url, '/api/v1/users/me/delete-account');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), { confirm: true, password: 'my-password' });
  assert.equal(result.status, 'deleted');
  assert.ok(!('user_id' in JSON.parse(calls[0].init.body)));
});

await check('注销：没有密码的账号不发 password 字段', async () => {
  let body;
  await deleteMyAccount('', async (_u, init) => { body = JSON.parse(init.body); return json(200, { data: { status: 'deleted' } }); });
  assert.deepEqual(body, { confirm: true });
});

await check('注销：密码错误是 AccountError(401)，不会像 apiClient 那样跳登录页', async () => {
  const err = await deleteMyAccount('wrong', async () => json(401, { message: '密码不正确' })).catch((e) => e);
  assert.ok(err instanceof AccountError);
  assert.equal(err.status, 401);
  assert.equal(err.message, '密码不正确');
});

await check('注销：工作区还有成员 → 409，显示服务端给的中文原因', async () => {
  const err = await deleteMyAccount('p', async () =>
    json(409, { message: '工作区里还有 2 位成员，请先转让所有权或移除成员，再注销账号', code: 'OWNER_HAS_MEMBERS' })).catch((e) => e);
  assert.equal(err.status, 409);
  assert.equal(err.code, 'OWNER_HAS_MEMBERS');
  assert.match(err.message, /转让所有权/);
});

await check('注销：服务不可用或断网，明确说「数据没有任何改动」', async () => {
  const e1 = await deleteMyAccount('p', async () => json(503, {})).catch((e) => e);
  assert.match(e1.message, /没有任何改动/);
  const e2 = await deleteMyAccount('p', async () => { throw new TypeError('fetch failed'); }).catch((e) => e);
  assert.match(e2.message, /没有任何改动/);
  assert.equal(e2.status, 0);
});

await check('注销：被限流 429 与非 JSON 响应都有可读提示，不外泄底层异常原文', async () => {
  const e1 = await deleteMyAccount('p', async () => json(429, {})).catch((e) => e);
  assert.match(e1.message, /太频繁/);
  const e2 = await deleteMyAccount('p', async () => new Response('<html>502</html>', { status: 502 })).catch((e) => e);
  assert.doesNotMatch(e2.message, /html|Unexpected/i);
});

await check('保存资料与偏好：真的发请求（原来是 1 秒定时器 + 「已更新」）', async () => {
  const calls = [];
  const fake = async (url, init) => { calls.push({ url, init }); return json(200, { success: true, data: {} }); };
  await saveProfile('小周', fake);
  await savePreferences({ schedule: { xhs_freq: 3 } }, fake);
  assert.equal(calls[0].url, '/api/v1/users/me');
  assert.equal(calls[0].init.method, 'PUT');
  assert.deepEqual(JSON.parse(calls[0].init.body), { name: '小周' });
  assert.deepEqual(JSON.parse(calls[1].init.body), { preferences: { schedule: { xhs_freq: 3 } } });
});

await check('保存失败会抛出，页面据此提示失败，而不是假装成功', async () => {
  const err = await saveProfile('x', async () => json(400, { message: ['姓名太长'] })).catch((e) => e);
  assert.ok(err instanceof AccountError);
  assert.match(err.message, /姓名太长/);
});

await check('文件名按日期生成', () => {
  assert.equal(exportFilename(new Date(2026, 0, 5)), '分发侠-我的数据-20260105.json');
});

await check('设置页：有「账号与数据」页签，注销必须勾选确认，且不再用定时器假装保存', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/app/(main)/settings/page.tsx'), 'utf8');
  assert.match(src, /key: 'data'/);
  assert.match(src, /disabled: !understood/);
  assert.match(src, /Input\.Password/);
  assert.match(src, /await logout\(\)/);
  assert.doesNotMatch(src, /setTimeout\(resolve, 1000\)/);
  assert.doesNotMatch(src, /defaultChecked=\{item\.default\}/);
});

await check('隐私政策：写的与设置页实际提供的一致（自助导出、注销；订单与日志依法保留）', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/app/privacy/page.tsx'), 'utf8');
  assert.match(src, /账号与数据/);
  assert.match(src, /订单/);
  assert.match(src, /六个月/);
});

await check('隐私政策：写明手机号与短信验证码的处理、实名认证属敏感信息并单独同意、注销时一并清除手机号', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/app/privacy/page.tsx'), 'utf8');
  assert.match(src, /手机号/);
  assert.match(src, /短信验证码/);
  assert.match(src, /5 分钟/);
  assert.match(src, /敏感个人信息/);
  assert.match(src, /单独同意/);
  assert.match(src, /尚未开通/); // 实名认证目前没有，政策不能写成已经在收集
  assert.match(src, /手机号及验证码记录/);
});

await check('注册页的同意由后端留痕：两种注册都把 agreedToTerms 提交给后端', () => {
  const lib = fs.readFileSync(path.join(ROOT, 'src/lib/auth-service.ts'), 'utf8');
  assert.equal((lib.match(/agreedToTerms: input\.agreedToTerms/g) || []).length, 2);
  const page = fs.readFileSync(path.join(ROOT, 'src/app/(auth)/register/page.tsx'), 'utf8');
  assert.equal((page.match(/agreedToTerms: values\.agreement === true/g) || []).length, 2);
});

if (failures) { console.error(`\n${failures} failed`); process.exit(1); }
console.log('\nAll account-data tests passed');
