/**
 * 界面上的失败原因：全中文，且是后端真正给的那一句。
 *
 * 改之前：
 *  - 后端错误信封是 { success:false, error:{ code, message } }，而 apiClient、登录页、注册页、
 *    账号页、脚本生成路由读的是顶层 message —— 读不到，「邮箱已被注册」「发布次数已达上限」
 *    「内容未通过合规检查」全被换成「服务响应异常」或「登录失败」。
 *  - 十几处直接把 error.message 渲染上屏：断网是 `Failed to fetch`，后端返回 HTML 是
 *    `Unexpected token '<'`。
 *   node --import ./scripts/ts-extensionless.mjs --experimental-strip-types scripts/test-error-text.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NextRequest } from 'next/server.js';
import { apiErrorText, safeErrorText } from '../src/lib/api-error.ts';
import { apiClient } from '../src/lib/api-client.ts';
import { AuthError, loginWithPassword, registerWithEmail } from '../src/lib/auth-service.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`  PASS ${name}`); } catch (e) { failures++; console.error(`  FAIL ${name}: ${e.message}`); }
}
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const envelope = (message, code = 'ERROR') => ({ success: false, error: { code, message, timestamp: 'x', path: '/x' } });

console.log('Error text tests');

await check('apiErrorText：取后端信封 error.message 里的中文；也认顶层 message、数组', () => {
  assert.equal(apiErrorText(envelope('邮箱已被注册')), '邮箱已被注册');
  assert.equal(apiErrorText({ message: '顶层中文' }), '顶层中文');
  assert.equal(apiErrorText(envelope(['email must be an email', '请输入有效的邮箱地址'])), '请输入有效的邮箱地址');
  assert.equal(apiErrorText({ error: '视频生成在国内版暂未开通' }), '视频生成在国内版暂未开通');
});

await check('apiErrorText：英文一律不给（返回 null，由调用方用中文兜底）', () => {
  assert.equal(apiErrorText(envelope('Internal server error')), null);
  assert.equal(apiErrorText(envelope(['password must be longer than or equal to 6 characters'])), null);
  assert.equal(apiErrorText(null), null);
  assert.equal(apiErrorText('Unauthorized'), null);
});

await check('safeErrorText：中文异常原样给，英文原文（Failed to fetch）换成兜底', () => {
  assert.equal(safeErrorText(new Error('网络连接失败，请稍后重试'), '兜底'), '网络连接失败，请稍后重试');
  assert.equal(safeErrorText(new TypeError('Failed to fetch'), '兜底'), '兜底');
  assert.equal(safeErrorText(new SyntaxError("Unexpected token '<'"), '兜底'), '兜底');
  assert.equal(safeErrorText(undefined, '兜底'), '兜底');
});

await check('apiClient：后端的中文业务原因（error.message）能显示出来，不再一律「服务响应异常」', async () => {
  globalThis.fetch = async () => json(400, envelope('发布次数已达上限，请升级套餐'));
  await assert.rejects(() => apiClient.get('/x'), (e) => e.message === '发布次数已达上限，请升级套餐');
});

await check('apiClient：英文原因与非 JSON 响应用中文兜底', async () => {
  globalThis.fetch = async () => json(500, envelope('Internal server error'));
  await assert.rejects(() => apiClient.get('/x'), (e) => e.message === '服务响应异常，请稍后重试');
  globalThis.fetch = async () => new Response('<html>502 Bad Gateway</html>', { status: 502 });
  await assert.rejects(() => apiClient.get('/x'), (e) => e.message === '服务响应异常，请稍后重试');
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(() => apiClient.get('/x'), (e) => e.message === '网络连接失败，请稍后重试');
});

await check('登录：密码错误显示后端的「邮箱或密码错误」，是 AuthError(401)', async () => {
  await assert.rejects(
    () => loginWithPassword({ email: 'a@b.cn', password: 'x' }, async () => json(401, envelope('邮箱或密码错误'))),
    (e) => e instanceof AuthError && e.status === 401 && e.message === '邮箱或密码错误',
  );
});

await check('登录：校验管道的英文数组、断网、限流都是中文', async () => {
  await assert.rejects(() => loginWithPassword({ email: 'a', password: 'x' }, async () => json(400, envelope(['email must be an email']))), (e) => e.message === '登录失败，请检查邮箱和密码');
  await assert.rejects(() => loginWithPassword({ email: 'a', password: 'x' }, async () => { throw new TypeError('Failed to fetch'); }), (e) => /网络/.test(e.message) && !/fetch/i.test(e.message));
  await assert.rejects(() => loginWithPassword({ email: 'a', password: 'x' }, async () => json(429, envelope('ThrottlerException: Too Many Requests'))), (e) => e.status === 429 && /频繁/.test(e.message));
});

await check('注册：邮箱已被注册的原因能显示出来', async () => {
  await assert.rejects(
    () => registerWithEmail({ email: 'a@b.cn', password: '123456', name: '甲', tenantName: '乙' }, async () => json(409, envelope('邮箱已被注册'))),
    (e) => e.message === '邮箱已被注册',
  );
});

await check('登录成功：返回 user', async () => {
  const user = await loginWithPassword({ email: 'a@b.cn', password: 'x' }, async () => json(200, { user: { id: 'u1', email: 'a@b.cn' } }));
  assert.equal(user.id, 'u1');
});

await check('服务端路由：未预期的异常给中文通用提示，不带异常原文、上游响应体与环境变量名', async () => {
  process.env.API_INTERNAL_URL = 'http://api.test:4000';
  const provider = await import('../src/app/api/_lib/provider.ts');
  const res = provider.toErrorResponse(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
  const body = await res.json();
  assert.match(body.error, /[一-鿿]/);
  assert.doesNotMatch(JSON.stringify(body), /ECONNREFUSED|10\.0\.0\.5/);
  const notConfigured = await provider.toErrorResponse(new provider.ProviderNotConfiguredError('某服务', 'SOME_SECRET_KEY')).json();
  assert.doesNotMatch(JSON.stringify(notConfigured), /SOME_SECRET_KEY|required_env/);
  assert.match(notConfigured.error, /[一-鿿]/);
});

await check('生成脚本路由：后端错误信封里的中文原因被带出来', async () => {
  process.env.API_INTERNAL_URL = 'http://api.test:4000';
  globalThis.fetch = async (url) => (String(url).endsWith('/auth/profile') ? json(200, { success: true }) : json(400, envelope('请输入创作主题')));
  const { POST } = await import('../src/app/api/ai/generate-script/route.ts');
  const res = await POST(new NextRequest('http://w/api/ai/generate-script', { method: 'POST', headers: { cookie: 'ff_token=t', 'content-type': 'application/json' }, body: '{}' }));
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, '请输入创作主题');
});

await check('源码：界面里不再直接渲染 error.message（一律走 safeErrorText / apiErrorText）', () => {
  // 这些文件里的 .message 要么是中文异常类（AuthError / AccountError / 支付错误），要么只在开发环境或服务端探针里用
  const ALLOW = [
    'lib/api-client.ts', 'lib/api-error.ts', 'lib/auth-service.ts', 'lib/account-service.ts', 'lib/payment-service.ts',
    'components/error/ErrorBoundary.tsx', 'app/api/health/route.ts', 'app/api/_lib/provider.ts',
    'app/(main)/settings/page.tsx', 'lib/video-merger-service.ts',
  ];
  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!/\.(ts|tsx)$/.test(e.name) || /\.spec\./.test(e.name)) continue;
      const rel = path.relative(path.join(ROOT, 'src'), full).replaceAll('\\', '/');
      if (ALLOW.includes(rel)) continue;
      const code = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      code.split('\n').forEach((line, i) => {
        if (/\b(e|err|error|ex)\??\.message\b/.test(line) && !/console\./.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
  };
  walk(path.join(ROOT, 'src'));
  assert.deepEqual(offenders, []);
});

if (failures) { console.error(`${failures} failed`); process.exit(1); }
console.log('All error text tests passed');
