import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reasonChips, signupProfileBody } from '../src/lib/signup-profile.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const register = fs.readFileSync(path.join(root, 'src/app/(auth)/register/page.tsx'), 'utf8');
const card = fs.readFileSync(path.join(root, 'src/components/library/ForYouSection.tsx'), 'utf8');

assert.deepEqual(signupProfileBody({ industry: ' 教育 ', job_role: '  ', growth_stage: '', province: '浙江' }), {
  industry: '教育',
  province: '浙江',
});
assert.deepEqual(reasonChips('你填写的「养生」和这条相关；你关注了「健康食品宣传」'), [
  '你填写的「养生」和这条相关',
  '你关注了「健康食品宣传」',
]);
for (const name of ['industry', 'job_role', 'growth_stage', 'province', '/users/me/signup-profile']) {
  assert.ok(register.includes(name), `注册页缺少 ${name}`);
}
assert.ok(card.includes('foryou-reason-chip'), '推荐卡没有把原因拆成说明');
console.log('signup profile fields and reason chips: ok');
