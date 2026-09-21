/**
 * 国内 Web 不连 Supabase：身份、退出、注册、素材都经自己的后端。
 *   node --import ./scripts/ts-extensionless.mjs --experimental-strip-types scripts/test-domestic-session.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`  PASS ${name}`); } catch (e) { failures++; console.error(`  FAIL ${name}: ${e.message}`); }
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : /\.(ts|tsx|mjs)$/.test(e.name) ? [full] : [];
  });
}

const calls = [];
let respond = () => ({ status: 200, body: {} });
globalThis.window = undefined;
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), method: init.method || 'GET', body: init.body });
  const { status, body } = respond(String(url), init);
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
};

console.log('Domestic session tests');

await check('no source file imports Supabase', () => {
  const offenders = walk(path.join(ROOT, 'src')).filter((f) => /@supabase\/|lib\/supabase|from '\.\/supabase'/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(offenders.map((f) => path.relative(ROOT, f)), []);
});

await check('package.json and Dockerfile do not require Supabase', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(!Object.keys(pkg.dependencies || {}).some((d) => d.startsWith('@supabase/')));
  assert.ok(!/SUPABASE/.test(fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8')));
});

await check('register posts only whitelisted fields to /api/auth/register', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/app/(auth)/register/page.tsx'), 'utf8');
  assert.match(src, /fetch\('\/api\/auth\/register'/);
  const body = /JSON\.stringify\(\{([\s\S]*?)\}\)/.exec(src)[1];
  const keys = [...body.matchAll(/(\w+):/g)].map((m) => m[1]).sort();
  assert.deepEqual(keys, ['email', 'name', 'password', 'tenantName']);
});

const session = await import('../src/lib/session.ts');

await check('current user comes from the backend profile', async () => {
  respond = (url) => url.endsWith('/api/v1/auth/profile')
    ? { status: 200, body: { success: true, data: { user: { id: 'u1', email: 'a@x.cn', name: '甲', role: 'owner', tenant: { id: 't1', name: '工作室', plan: 'pro' } } } } }
    : { status: 404, body: {} };
  const current = await session.fetchCurrentUser();
  assert.equal(current.profile.id, 'u1');
  assert.equal(current.profile.tenant_id, 't1');
  assert.equal(current.tenant.plan, 'pro');
});

await check('not logged in yields null instead of throwing', async () => {
  respond = () => ({ status: 401, body: { message: 'Unauthorized' } });
  assert.equal(await session.fetchCurrentUser(), null);
});

await check('logout clears the server cookie', async () => {
  calls.length = 0;
  respond = () => ({ status: 200, body: { success: true } });
  await session.logout();
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), ['POST /api/auth/logout']);
});

const materials = await import('../src/lib/materials-service.ts');

await check('materials are listed from the backend', async () => {
  respond = (url) => url.startsWith('/api/v1/materials')
    ? { status: 200, body: { success: true, data: [{ id: 'm1', material_type: 'video', name: '片头', file_url: 'https://oss.example.cn/a.mp4', file_size: 10, tags: ['片头'] }] } }
    : { status: 404, body: {} };
  const list = await materials.getUserMaterials('u1', { type: 'video' });
  assert.equal(list.length, 1);
  assert.equal(list[0].type, 'video');
  assert.equal(list[0].url, 'https://oss.example.cn/a.mp4');
  assert.ok(calls.some((c) => c.url === '/api/v1/materials?type=video'));
});

await check('upload surfaces the backend reason instead of pretending', async () => {
  respond = () => ({ status: 400, body: { success: false, message: '素材上传通道尚未配置，请先接入对象存储签名上传后再试' } });
  await assert.rejects(() => materials.uploadMaterial('u1', { name: 'a.png', size: 1, type: 'image/png' }), /对象存储/);
});

await check('delete is refused honestly until object storage exists', async () => {
  await assert.rejects(() => materials.deleteMaterial('m1', 'u1'), /对象存储/);
});

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
