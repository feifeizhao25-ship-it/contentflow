/**
 * 内容库审核流：原来没有「提交审核」按钮，新内容保存为草稿后永远走不到发布。
 * 现在：草稿 → 提交审核 → 有权限的审核人通过 / 驳回（附原因）→ 可发布；
 * 作者不能自批；单人工作区由所有者「自行确认」（二次确认、单独记录）。
 *   node --import ./scripts/ts-extensionless.mjs --experimental-strip-types scripts/test-content-review.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentReviewState, parseReviewPolicy, reviewNote, validateRejectReason, SELF_CONFIRM_PREFIX } from '../src/lib/content-review.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf8');
let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  PASS ${name}`); } catch (e) { failures++; console.error(`  FAIL ${name}: ${e.message}`); }
}

console.log('Content review tests');

const owner = { userId: 'u-owner', role: 'owner', canReview: true, canSelfConfirm: false, otherReviewers: 1 };
const soloOwner = { ...owner, canSelfConfirm: true, otherReviewers: 0 };
const editor = { userId: 'u-editor', role: 'editor', canReview: false, canSelfConfirm: false, otherReviewers: 1 };

check('草稿、已驳回：可以编辑、提交审核', () => {
  assert.deepEqual(contentReviewState({ status: 'draft' }, editor).actions, ['edit', 'submit']);
  const rejected = contentReviewState({ status: 'rejected' }, editor);
  assert.deepEqual(rejected.actions, ['edit', 'submit']);
  assert.match(rejected.hint, /修改后可重新提交/);
});

check('待审核：审核人看到通过 / 驳回；作者不能审自己的；没权限的看到「等待审核」', () => {
  assert.deepEqual(contentReviewState({ status: 'pending_review', created_by: 'u-editor' }, owner).actions, ['review']);
  const own = contentReviewState({ status: 'pending_review', created_by: 'u-owner' }, owner);
  assert.deepEqual(own.actions, []);
  assert.match(own.hint, /不能审核自己的内容/);
  const waiting = contentReviewState({ status: 'pending_review', created_by: 'u-other' }, editor);
  assert.deepEqual(waiting.actions, []);
  assert.match(waiting.hint, /等待所有者或管理员审核/);
  // 读不到权限：一个审核按钮都不给
  assert.deepEqual(contentReviewState({ status: 'pending_review', created_by: 'x' }, null).actions, []);
});

check('单人工作区：所有者对自己的待审内容只能「自行确认」，不能直接点通过', () => {
  const s = contentReviewState({ status: 'pending_review', created_by: 'u-owner' }, soloOwner);
  assert.deepEqual(s.actions, ['self_confirm']);
  assert.ok(!s.actions.includes('review'));
});

check('已通过 / 已发布：才出现「发布」', () => {
  for (const status of ['approved', 'published']) assert.deepEqual(contentReviewState({ status }, editor).actions, ['publish']);
  for (const status of ['draft', 'pending_review', 'rejected']) assert.ok(!contentReviewState({ status, created_by: 'u-editor' }, owner).actions.includes('publish'));
});

check('驳回原因必填、最多 500 字；审核说明区分驳回与自行确认', () => {
  assert.match(validateRejectReason('   '), /请填写驳回原因/);
  assert.match(validateRejectReason('字'.repeat(501)), /500/);
  assert.equal(validateRejectReason('标题含绝对化用语'), null);
  assert.deepEqual(reviewNote({ status: 'rejected', review_comment: '请改标题' }), { kind: 'rejected', text: '驳回原因：请改标题' });
  assert.equal(reviewNote({ status: 'approved', review_comment: `${SELF_CONFIRM_PREFIX}（工作区没有其他审核人）` }).kind, 'self_confirm');
  assert.equal(reviewNote({ status: 'draft', review_comment: '' }), null);
});

check('审核权限解析：形状不对就当没有权限', () => {
  assert.equal(parseReviewPolicy(null), null);
  assert.equal(parseReviewPolicy({ canReview: true }), null);
  assert.deepEqual(parseReviewPolicy({ success: true, data: { userId: 'u', role: 'owner', canReview: true, canSelfConfirm: 'yes', otherReviewers: 0 } }),
    { userId: 'u', role: 'owner', canReview: true, canSelfConfirm: false, otherReviewers: 0 });
});

check('与后端一致：自行确认的说明前缀、作者不能自批的约束都在 API 里', () => {
  const svc = fs.readFileSync(path.join(ROOT, '../api/src/modules/content/content.service.ts'), 'utf8');
  assert.match(svc, new RegExp(`SELF_CONFIRM_LABEL = "${SELF_CONFIRM_PREFIX}`));
  assert.match(svc, /不能审核自己创作或提交的内容/);
  assert.match(svc, /驳回时请填写原因/);
});

check('内容库页面：提交审核、通过、驳回（原因）、自行确认（勾选后才能点）都接到接口；「新建内容」「编辑」不再是空按钮', () => {
  const page = read('app/(main)/contents/page.tsx');
  assert.match(page, /\/contents\/\$\{record\.id\}\/submit/);
  assert.match(page, /action: 'approve'/);
  assert.match(page, /action: 'reject', comment: rejectReason\.trim\(\)/);
  assert.match(page, /\/self-confirm`, \{ confirm: true/);
  assert.match(page, /okButtonProps=\{\{ disabled: !selfChecked \}\}/, '自行确认必须先勾选（二次确认）');
  assert.match(page, /'\/contents\/review-policy'/);
  assert.match(page, /onClick=\{\(\) => openEditor\('create'\)\}/);
  assert.match(page, /onClick=\{\(\) => openEditor\('edit', record\)\}/);
  assert.doesNotMatch(page, /<Button type="link" size="small" icon=\{<EditOutlined \/>\}>编辑<\/Button>/);
});

check('创作工作室「创建发布任务」：保存后直接提交审核，而不是只留一个走不下去的草稿', () => {
  const studio = read('app/(main)/studio/page.tsx');
  assert.match(studio, /\/contents\/\$\{contentId\}\/submit/);
  assert.match(studio, /\/contents\?status=pending_review/);
});

if (failures) { console.error(`${failures} failed`); process.exit(1); }
console.log('All content review tests passed');
