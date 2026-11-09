import {
  accountRows,
  analyticsRows,
  calendarRows,
  contentRows,
  developerRows,
  materialRows,
  profileRows,
  publishRows,
  teamRows,
  voiceRows,
} from './workspace-records';

describe('international workspace records', () => {
  it('does not invent content, tasks, or follower counts when the payload is empty', () => {
    expect(contentRows({ contents: [] }).notes.join(' ')).toMatch(/empty because/);
    expect(contentRows({ contents: [] }).rows).toEqual([]);
    expect(publishRows({ tasks: [] }).rows).toEqual([]);
    expect(calendarRows({ tasks: [{ scheduled_at: null, status: 'queued' }] }).notes.join(' ')).toMatch(/No tasks have a scheduled time/);
    expect(accountRows([]).notes.join(' ')).toMatch(/none are stored/);
    expect(materialRows([]).notes.join(' ')).toMatch(/does not pretend/);
    expect(analyticsRows({ week: { publish: { total: 0, published: 0, failed: 0 }, ai: { generations: 0, savedAsContent: 0, approvedOrPublished: 0 } }, engagement: { detail: 'No engagement numbers are shown.' } }).notes.join(' ')).toMatch(/stored count/);
    expect(JSON.stringify(analyticsRows({}))).not.toMatch(/8\.5%|893/);
  });

  it('keeps only the signed-in payload and hides key secrets', () => {
    const library = contentRows({ contents: [{ title: 'Launch note', content_type: 'article', status: 'draft', created_at: '2026-11-09T02:00:00Z' }] });
    expect(library.rows[0][0]).toBe('Launch note');
    expect(library.notes).toEqual([]);

    const keys = developerRows([{ name: 'CI', key_prefix: 'sk_ff_abc', key_hash: 'secret-hash', secret: 'sk_ff_full', created_at: '2026-11-01T00:00:00Z' }]);
    expect(keys.rows[0]).toEqual(['CI', 'sk_ff_abc', '2026-11-01T00:00:00.000Z']);
    expect(JSON.stringify(keys)).not.toContain('secret-hash');
    expect(JSON.stringify(keys)).not.toContain('sk_ff_full');

    expect(profileRows({ user: { name: 'Ada', email: 'ada@example.com', role: 'owner' } }).rows).toEqual([
      ['Name', 'Ada'],
      ['Email', 'ada@example.com'],
      ['Role', 'owner'],
    ]);
    expect(teamRows([{ name: 'Ada', email: 'ada@example.com', role: 'owner' }]).rows[0][2]).toBe('owner');
    expect(voiceRows([{ name: 'Plain spoken', description: 'Short sentences.', is_system: false }]).rows[0][2]).toBe('Workspace voice');
    expect(accountRows([{ platform: 'linkedin', account_name: 'Ada', status: 'active', follower_count: 0 }]).rows[0][3]).toBe('0');
  });

  it('leaves a missing analytics count as not returned instead of zero', () => {
    const view = analyticsRows({ week: { publish: {}, ai: {} }, engagement: {} });
    expect(view.rows.every((row) => row[1] === 'Not returned')).toBe(true);
    expect(view.notes.join(' ')).toMatch(/not estimated/);
  });

  it('calendar ignores tasks that were never scheduled', () => {
    const view = publishRows({ tasks: [{ content: { title: 'Now' }, platform_content: { platform: 'youtube' }, status: 'queued', scheduled_at: '2026-11-12T15:00:00Z' }] });
    expect(view.rows[0][1]).toBe('youtube');
    const calendar = calendarRows({ tasks: [{ content: { title: 'Now' }, status: 'queued', scheduled_at: null }, { content: { title: 'Later' }, platform_account: { platform: 'instagram' }, status: 'queued', scheduled_at: '2026-11-12T15:00:00Z' }] });
    expect(calendar.rows.map((row) => row[0])).toEqual(['Later']);
  });
});
