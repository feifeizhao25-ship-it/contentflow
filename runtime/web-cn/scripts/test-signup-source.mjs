/**
 * 注册来源题「从哪知道我们」：开关关着不显示、只提交选项代码、跳过不带字段。
 *   node --import ./scripts/ts-extensionless.mjs --experimental-transform-types scripts/test-signup-source.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { parseSignupSourceOptions, signupSourceField } = await import('../src/lib/signup-source.ts');
const svc = await import('../src/lib/auth-service.ts');

const LABELS = ['小红书', '抖音', '视频号', '公众号', '知乎', '哔哩哔哩', '搜索', '朋友推荐', '其他'];
const CODES = ['xiaohongshu', 'douyin', 'shipinhao', 'gongzhonghao', 'zhihu', 'bilibili', 'search', 'friend', 'other'];
const enabled = { success: true, data: { enabled: true, question: '从哪知道我们', skippable: true, options: CODES.map((code, i) => ({ code, label: LABELS[i] })) } };

// 开关关着、格式不对、请求失败返回的东西：都不显示题目
assert.deepEqual(parseSignupSourceOptions({ success: true, data: { enabled: false, options: [] } }), []);
assert.deepEqual(parseSignupSourceOptions(null), []);
assert.deepEqual(parseSignupSourceOptions({ enabled: true }), []);
// 打开时：9 个选项，顺序和文字都对；带不带信封都能读
const options = parseSignupSourceOptions(enabled);
assert.deepEqual(options.map((o) => o.label), LABELS);
assert.deepEqual(parseSignupSourceOptions(enabled.data).map((o) => o.code), CODES);

// 只把题目里有的代码交给注册接口；跳过、自由文本、显示名都不带
assert.deepEqual(signupSourceField('zhihu', options), { signupSource: 'zhihu' });
for (const bad of [undefined, '', '知乎', 'tv-ad', '我在电梯里看到的', 3]) {
  assert.deepEqual(signupSourceField(bad, options), {});
}
assert.deepEqual(signupSourceField('zhihu', []), {}, '题目没显示时不该提交来源');

// 注册请求：选了就只多一个 signupSource 字段；没选时字段白名单和以前一样
const seen = [];
const reply = async (url, init) => {
  seen.push({ url, body: JSON.parse(init.body) });
  return new Response(JSON.stringify({ user: { id: 'u' } }), { status: 200, headers: { 'content-type': 'application/json' } });
};
await svc.registerWithEmail({ email: 'a@b.cn', password: '123456', agreedToTerms: true, confirmedAge16: true, signupSource: 'bilibili' }, reply);
assert.equal(seen.at(-1).url, '/api/auth/register');
assert.equal(seen.at(-1).body.signupSource, 'bilibili');
await svc.registerWithPhone({ phone: '13812345678', code: '123456', agreedToTerms: true, confirmedAge16: true, signupSource: 'friend' }, reply);
assert.equal(seen.at(-1).url, '/api/auth/register/phone');
assert.equal(seen.at(-1).body.signupSource, 'friend');
await svc.registerWithPhone({ phone: '13812345678', code: '123456', agreedToTerms: true, confirmedAge16: true }, reply);
assert.ok(!('signupSource' in seen.at(-1).body), '跳过时不带 signupSource');

// 注册页：题目只在拿到选项后显示，并且标明选填
const page = fs.readFileSync(path.join(ROOT, 'src/app/(auth)/register/page.tsx'), 'utf8');
for (const needle of ["'/growth/signup-source'", 'sourceOptions.length > 0', '从哪知道我们（选填，可跳过）', 'allowClear', 'signupSourceField(values.signupSource, sourceOptions)']) {
  assert.ok(page.includes(needle), `注册页缺少 ${needle}`);
}
assert.equal(page.split('signupSourceField(values.signupSource, sourceOptions)').length - 1, 2, '邮箱和手机号两种注册都要带上来源');
console.log('signup source question: ok');
