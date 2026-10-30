import { Approval, buildChangeProposal, decideAdoption, diffRuleSnapshots, snapshotFromText, splitClauses } from './rule-diff';

const meta = { source_id: 'douyin-community', source_url: 'https://example.invalid/rules', fetched_at: '2026-10-30' };
const v1 = ['第一条 禁止发布违法信息。', '第二条 广告内容需要标注。', '补充说明：以平台公告为准。', '第三条 AI 生成内容需要提示。'].join('\n');
const v2 = ['第一条 禁止发布违法信息。', '第二条 广告内容需要显著标注“广告”。', '第三条 AI 生成内容需要提示。', '第四条 新增条款。'].join('\n');

describe('条款切分', () => {
  it('按编号切，无编号的续行归到上一条', () => {
    const clauses = splitClauses(v1);
    expect(clauses.map((c) => c.id)).toEqual(['第一条', '第二条', '第三条']);
    expect(clauses[1].text).toContain('以平台公告为准');
  });
  it('重复编号加序号，无编号开头用哈希', () => {
    expect(splitClauses('第一条 甲\n第一条 乙').map((c) => c.id)).toEqual(['第一条', '第一条#2']);
    expect(splitClauses('前言\n第一条 甲')[0].id).toMatch(/^h-[0-9a-f]{12}$/);
  });
  it('空白和换行风格不同不算变化', () => {
    expect(snapshotFromText(meta, 'a\r\n b ').content_hash).toBe(snapshotFromText(meta, 'a\n b').content_hash);
  });
});

describe('条款级差异', () => {
  const s1 = snapshotFromText(meta, v1);
  const s2 = snapshotFromText(meta, v2);
  it('识别新增、修改、不变', () => {
    const diff = diffRuleSnapshots(s1, s2);
    expect(diff.changed).toBe(true);
    expect(diff.added.map((c) => c.id)).toEqual(['第四条']);
    expect(diff.modified.map((c) => c.id)).toEqual(['第二条']);
    expect(diff.removed).toEqual([]);
    expect(diff.unchangedCount).toBe(2);
  });
  it('识别删除', () => {
    expect(diffRuleSnapshots(s2, s1).added).toEqual([]);
    expect(diffRuleSnapshots(s2, snapshotFromText(meta, '第一条 禁止发布违法信息。')).removed.map((c) => c.id)).toEqual(['第二条', '第三条', '第四条']);
  });
  it('首次抓取全部算新增', () => {
    expect(diffRuleSnapshots(null, s1).added).toHaveLength(3);
  });
});

describe('提议与采纳', () => {
  const s1 = snapshotFromText(meta, v1);
  const s2 = snapshotFromText(meta, v2);
  const proposal = buildChangeProposal(s1, s2)!;
  const approval: Approval = { status: 'approved', reviewer: '合规负责人-张', approved_at: '2026-10-31T09:00:00+08:00', to_hash: s2.content_hash, channel: 'wecom' };

  it('没变化不产生提议', () => {
    expect(buildChangeProposal(s1, snapshotFromText(meta, v1))).toBeNull();
  });
  it('有变化只生成待复核提议，并暂停依赖它的结论', () => {
    expect(proposal.status).toBe('pending_review');
    expect(proposal.pause_dependents).toBe(true);
    expect(proposal.summary).toBe('新增 1 条，删除 0 条，修改 1 条');
    expect(buildChangeProposal(null, s1)?.pause_dependents).toBe(false);
  });
  it('没有批准就不采纳', () => {
    expect(decideAdoption(proposal, null).decision).toBe('hold');
    expect(decideAdoption(proposal, undefined).decision).toBe('hold');
  });
  it('批准齐全才采纳', () => {
    expect(decideAdoption(proposal, approval)).toEqual({ decision: 'adopt', to_hash: s2.content_hash });
  });
  it.each([
    ['被拒绝', { status: 'rejected' as const }],
    ['不是企业微信', { channel: 'email' as unknown as 'wecom' }],
    ['批准人为空', { reviewer: '  ' }],
    ['自动化账号', { reviewer: 'bot-weekly' }],
    ['时间无效', { approved_at: 'soon' }],
    ['批准的是旧版', { to_hash: s1.content_hash }],
  ])('%s时不采纳', (_name, patch) => {
    expect(decideAdoption(proposal, { ...approval, ...patch }).decision).toBe('hold');
  });
});
