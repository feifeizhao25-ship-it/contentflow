import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SIL_CRON } from '../../growth/self-improve/schedule';
import { scanInjection } from '../../growth/self-improve/sources';
import { LIBRARY_SLOTS, LibraryJobService, libraryJobEnabled, makeFetch, policy } from '../library-job.service';
import { main as cli } from '../cli';
import { buildPages, entriesOf, fakeHttp, page, tmpStore } from '../test-helpers';
import { LibraryStore, annotate, bundledDoc, sources } from '../store';
import { decide } from './display';
import { FetchError, checkEntries, diffSummary, discover, evaluateSource, opcodes, renderReport } from './freshness';
import * as review from './review';
import { dayStr, emptyState, extractLinks, extractText, parseDay } from './util';

const NOW = new Date('2026-11-02T02:00:00+08:00');
const day = (n: number) => parseDay('2026-11-02')! + n * 86_400_000;
const at = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe('文本抽取', () => {
  it('去掉导航和浏览量这类天天变的行，正文不变就摘要不变', () => {
    const a = extractText(page('标题', '<p>第一条 数值 10。</p><p>第二条。</p>', 1));
    const b = extractText(page('标题', '<p>第一条 数值 10。</p><p>第二条。</p>', 99999));
    expect(a.text).toBe(b.text);
    expect(a.text).not.toContain('浏览量');
    expect(a.title).toBe('标题');
  });
  it('列表页的链接带出标题和旁边的日期', () => {
    const links = extractLinks('<ul><li><a href="/a/1.html">广告新规发布</a> 2026-10-30</li><li><a href="javascript:x()">不要</a></li></ul>', 'https://www.gov.cn/zhengce/');
    expect(links).toEqual([{ title: '广告新规发布', url: 'https://www.gov.cn/a/1.html', date: '2026-10-30' }]);
  });
});

describe('变化检测', () => {
  it('块对比：只改一个字不会被算成整段变动', () => {
    expect(opcodes(['a', 'b', 'c'], ['a', 'x', 'c']).map((o) => o.tag)).toEqual(['equal', 'replace', 'equal']);
    const old = Array.from({ length: 40 }, (_, i) => `第${i}条 内容说明文字很长很长很长很长`).join('\n');
    const small = diffSummary(old, old.replace('第3条 内容说明文字很长很长很长很长', '第3条 内容说明文字很长很长很长很长。'));
    expect(small.ratio!).toBeLessThan(0.002);
    expect(small.digits_changed).toBe(false);
    const num = diffSummary(old, old.replace('第3条', '第8条'));
    expect(num.digits_changed).toBe(true);
  });

  const entry = () => ({ ...entriesOf()[0], review_status: '已审核' });
  const pg = (title: string, text: string) => ({ url: 'u', status: 200, title, text });

  it('未审核的条目基线跟着走；已审核的条目内容一变就是 changed，出现「废止」是 repeal_signal', () => {
    const e = entry();
    let st = evaluateSource(e, undefined, pg('办法', '第一条 10'), null, NOW);
    expect(st.check).toBe('ok');
    e.reviewed_hash = st.content_hash;
    const same = evaluateSource(e, st, pg('办法', '第一条 10'), null, at(1));
    expect(same.check).toBe('ok');
    const changed = evaluateSource(e, st, pg('办法', '第一条 15'), null, at(2), { baselineText: '第一条 10' });
    expect(changed.check).toBe('changed');
    expect(changed.change?.digits_changed).toBe(true);
    const gone = evaluateSource(e, st, pg('办法（已废止）', '第一条 10'), null, at(2));
    expect(evaluateSource(e, st, pg('办法（修订）', '第一条 10'), null, at(2)).check).toBe('changed'); // 只改标题也算变化
    expect(gone.check).toBe('repeal_signal');
    expect(gone.signals).toContain('repeal_marker');
  });

  it('404 是链接失效，其它失败是暂时无法访问；失败次数累计，恢复后清零', () => {
    const e = entry();
    let st = evaluateSource(e, undefined, null, new FetchError('broken', 404), NOW);
    expect(st.check).toBe('url_broken');
    st = evaluateSource(e, st, null, new FetchError('unreachable', 500), at(1));
    expect(st.check).toBe('unreachable');
    expect(st.failures).toBe(2);
    st = evaluateSource(e, st, pg('办法', '第一条'), null, at(2));
    expect(st.failures).toBe(0);
  });

  it('一个来源页被几条共用时只抓一次，拒绝程序访问的站点登记为 manual，不装作核对过', async () => {
    const entries = entriesOf().map((e) => ({ ...e, review_status: '已审核' }));
    const pages = buildPages(entries);
    let calls = 0;
    const http = fakeHttp(pages);
    const fetch = makeFetch(policy(), async (u, t) => (calls++, http(u, t)));
    const st = await checkEntries(entries, undefined, fetch, NOW, { product: 'contentflow', manualHosts: sources().manual_hosts });
    const urls = new Set(entries.map((e) => e.source.url).filter((u) => !u.includes('nhc.gov.cn')));
    expect(calls).toBe(urls.size);
    expect(st.entries['cf-rule-012'].check).toBe('manual');
    expect(st.entries['cf-rule-001'].check).toBe('ok');
    expect(Object.keys(st.entries)).toHaveLength(13);
  });
});

describe('展示规则 decide', () => {
  const base = () => ({ ...entriesOf()[0], review_status: '已审核', last_verified_at: '2026-11-02', reviewed_at: '2026-11-02' });
  it('待审核：不显示（预览开关才显示并带标记）', () => {
    const e = entriesOf()[0];
    expect(decide(e, undefined, day(0)).visible).toBe(false);
    const p = decide(e, undefined, day(0), { preview: true });
    expect(p.visible && !p.feed_eligible && p.banner === '待审核').toBe(true);
  });
  it('现行：带「核对于」；30 天内更新过的另带「更新于」和更新说明，之后徽标消失', () => {
    const e = { ...base(), updated_on: '2026-11-02', change_note: '第三条调整' };
    const d = decide(e, undefined, day(1));
    expect(d.state).toBe('current');
    expect(d.badges.map((b) => b.text)).toEqual(['核对于 2026-11-02', '更新于 2026-11-02']);
    expect(d.change_note).toBe('第三条调整');
    const later = decide(e, { check: 'ok', last_ok_at: '2026-12-10T02:00:00+08:00' }, day(40));
    expect(later.badges.map((b) => b.kind)).toEqual(['verified']);
    expect(later.change_note).toBeNull();
  });
  it('来源变了：显示但不推荐；废止迹象/已废止/被取代：一律不显示；连续打不开：不推荐；超时没核对：不推荐', () => {
    const e = base();
    expect(decide(e, { check: 'changed' }, day(1))).toMatchObject({ state: 'source_changed', visible: true, feed_eligible: false, current: false });
    expect(decide(e, { check: 'repeal_signal' }, day(1))).toMatchObject({ state: 'repeal_hold', visible: false });
    expect(decide({ ...e, status: '已废止' }, undefined, day(1))).toMatchObject({ state: 'repealed', visible: false });
    expect(decide({ ...e, superseded_by: 'cf-rule-002' }, undefined, day(1)).visible).toBe(false);
    expect(decide(e, { check: 'unreachable', failures: 2 }, day(1)).state).toBe('current');
    expect(decide(e, { check: 'unreachable', failures: 3 }, day(1)).state).toBe('unverifiable');
    expect(decide(e, undefined, day(91)).state).toBe('review_due');
    expect(decide({ ...e, status: '征求意见稿' }, undefined, day(1)).feed_eligible).toBe(false);
  });
  it('自动核对（来源没变）会续上核对日，所以人没动也不会过期', () => {
    const e = base();
    expect(decide(e, { check: 'ok', last_ok_at: '2026-12-20T02:00:00+08:00' }, day(60)).state).toBe('current');
    expect(decide(e, { check: 'manual' }, day(100)).state).toBe('review_due'); // manual 不算核对
  });
});

describe('审核写回', () => {
  it('approve / update / confirm / repeal：必须有审核人，更新要写变更说明，基线跟着换，写审计日志', async () => {
    const doc = bundledDoc();
    const st = await checkEntries(doc.entries, undefined, makeFetch(policy(), fakeHttp(buildPages(doc.entries))), NOW, { manualHosts: sources().manual_hosts });
    const logs: any[] = [];
    const ctx = { doc, state: st, log: (r: any) => logs.push(r), now: () => NOW };
    expect(() => review.approve(ctx, 'cf-rule-001', ' ', '2026-11-02')).toThrow('reviewer');
    const e = review.approve(ctx, 'cf-rule-001', '张三', '2026-11-02');
    expect(e).toMatchObject({ review_status: '已审核', reviewer: '张三', approved_at: '2026-11-02', version: 1 });
    expect(e.reviewed_hash).toBe(st.entries['cf-rule-001'].content_hash);
    expect(() => review.approve(ctx, 'cf-rule-001', '张三', '2026-11-02')).toThrow('already');
    expect(() => review.update(ctx, 'cf-rule-001', '张三', '2026-11-05', '')).toThrow('change_note');
    review.update(ctx, 'cf-rule-001', '张三', '2026-11-05', ' 第九条表述更新 ');
    expect(doc.entries.find((x) => x.id === 'cf-rule-001')).toMatchObject({ updated_on: '2026-11-05', change_note: '第九条表述更新', version: 2, approved_at: '2026-11-02' });
    review.repeal(ctx, 'cf-rule-001', '张三', '2026-11-06', '被新办法替代');
    expect(decide(doc.entries.find((x) => x.id === 'cf-rule-001')!, st.entries['cf-rule-001'], day(5)).visible).toBe(false);
    expect(logs.map((l) => l.action)).toEqual(['approve', 'update', 'repeal']);
  });
});

describe('发现新文件', () => {
  const listing = (items: string) => `<html><head><title>列表</title></head><body><ul>${items}</ul></body></html>`;
  const w = [{ id: 'samr-ad', listing_url: 'https://www.samr.gov.cn/ggjgs/', title_include: ['广告', '直播'], publisher: '市场监管总局', license_note: '政府网站公开信息' }];
  const mk = (html: string) => makeFetch(policy(), async (u) => ({ status: 200, body: u.endsWith('/ggjgs/') ? html : '' }));
  it('第一次只记「已见」（只收近 45 天且标题命中的）；之后新出现的才暂存，带出处，永远待核实', async () => {
    const first = listing('<li><a href="/a/1">互联网广告新规通知</a> 2026-10-20</li><li><a href="/a/2">旧的广告通知</a> 2025-01-01</li><li><a href="/a/3">园区巡礼</a> 2026-10-25</li>');
    let st = await discover(w, emptyState(), mk(first), NOW);
    expect(st.candidates.map((c) => c.title)).toEqual(['互联网广告新规通知']);
    expect(st.candidates[0]).toMatchObject({ status: '待核实', review_status: '待审核', publisher: '市场监管总局' });
    expect(st.candidates[0].provenance.read_scope).toContain('正文未读');
    const second = listing('<li><a href="/a/1">互联网广告新规通知</a> 2026-10-20</li><li><a href="/a/9">直播带货规范</a></li>');
    st = await discover(w, st, mk(second), at(7));
    expect(st.candidates.map((c) => c.title)).toEqual(['互联网广告新规通知', '直播带货规范']);
    st = await discover(w, st, mk(second), at(14)); // 再跑一遍不重复
    expect(st.candidates).toHaveLength(2);
  });
  it('列表页打不开只记错误，不影响其它', async () => {
    const st = await discover(w, emptyState(), makeFetch(policy(), async () => ({ status: 500, body: '' })), NOW);
    expect(st.listing_errors?.['samr-ad'].kind).toBe('unreachable');
    expect(st.candidates).toEqual([]);
  });
});

describe('定时任务', () => {
  it('默认关闭；挂在 SIL 已有的调度槽上；受限抓取只允许 https 白名单域名', async () => {
    expect(libraryJobEnabled({})).toBe(false);
    expect(libraryJobEnabled({ LIBRARY_FRESHNESS_ENABLED: '1' })).toBe(true);
    expect(LIBRARY_SLOTS).toEqual({ library_check: SIL_CRON.daily_scan, library_discover: SIL_CRON.weekly_cycle });
    const f = makeFetch(policy(), async () => ({ status: 200, body: '<title>x</title>' }));
    await expect(f('http://www.gov.cn/a')).rejects.toMatchObject({ kind: 'refused', detail: 'not_https' });
    await expect(f('https://evil.example.com/a')).rejects.toMatchObject({ kind: 'refused' });
    await expect(f('https://www.gov.cn/a')).resolves.toMatchObject({ title: 'x' });
    const redirect = makeFetch(policy(), async (u) => (u.endsWith('/a') ? { status: 302, body: '', location: 'https://evil.example.com/b' } : { status: 200, body: '' }));
    await expect(redirect('https://www.gov.cn/a')).rejects.toMatchObject({ kind: 'refused' });
    const job = new LibraryJobService(tmpStore());
    expect(await job.runCheck(NOW, { env: {} })).toEqual({ status: 'disabled' });
  });

  it('核对只写状态/快照/报告，从不改条目；需要人看的变化写进报告', async () => {
    const store = tmpStore();
    const job = new LibraryJobService(store);
    const env = { LIBRARY_FRESHNESS_ENABLED: '1' };
    const doc = store.loadDoc();
    const r1 = await job.runCheck(NOW, { env, fetch: makeFetch(policy(), fakeHttp(buildPages(doc.entries))) });
    expect(r1.status).toBe('ok');
    expect(store.loadDoc().entries.every((e) => e.review_status === '待审核')).toBe(true);
    const report = renderReport(doc.entries, store.loadState());
    expect(report).toContain('没有任何内容因此上线');
    expect(report).toContain('cf-rule-012');
    expect(store.loadState().entries['cf-rule-001'].check).toBe('ok');
  });

  it('命令行：没有审核人不行；通过后条目带审核信息并写审计日志', async () => {
    const store = tmpStore();
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(await cli(['approve', 'cf-rule-001', '--reviewer', ' '], store, NOW)).toBe(2);
    expect(await cli(['approve', 'cf-rule-001', '--reviewer', '张三'], store, NOW)).toBe(0);
    const e = store.loadDoc().entries.find((x) => x.id === 'cf-rule-001')!;
    expect(e).toMatchObject({ review_status: '已审核', reviewer: '张三' });
    expect(annotate(store.loadDoc(), store.loadState(), day(0)).map((x) => x.id)).toEqual(['cf-rule-001']);
    expect(await cli(['check'], store, NOW)).toBe(3);
    err.mockRestore();
    log.mockRestore();
  });
});
