import { TeamService } from './team.service';
import { RecordingTeamInviteMailer } from './team-invite.mailer';
import { seatLimit } from './seat-limit';

function memory() {
  const tenants = new Map<string, any>();
  const users = new Map<string, any>();
  const invites: any[] = [];
  const prisma: any = {
    tenant: {
      findUnique: async ({ where }: any) => tenants.get(where.id) ?? null,
    },
    user: {
      findFirst: async ({ where }: any) => [...users.values()].find((user) => Object.entries(where).every(([key, value]) => user[key] === value)) ?? null,
      findMany: async () => [],
      count: async ({ where }: any) => [...users.values()].filter((user) => Object.entries(where).every(([key, value]) => user[key] === value)).length,
      update: async ({ where, data }: any) => {
        const user = users.get(where.id);
        Object.assign(user, data);
        return user;
      },
    },
    teamInvite: {
      create: async ({ data }: any) => {
        const row = { id: `inv-${invites.length + 1}`, created_at: new Date(), resolved_at: null, accepted_by: null, ...data };
        invites.push(row);
        return row;
      },
      findMany: async ({ where }: any) => invites.filter((row) => row.tenant_id === where.tenant_id),
      findFirst: async ({ where }: any) => invites.find((row) => row.id === where.id && row.tenant_id === where.tenant_id) ?? null,
      findUnique: async ({ where }: any) => invites.find((row) => row.token_hash === where.token_hash) ?? null,
      update: async ({ where, data }: any) => {
        const row = invites.find((item) => item.id === where.id);
        Object.assign(row, data);
        return row;
      },
      count: async ({ where }: any) => invites.filter((row) => row.tenant_id === where.tenant_id && row.status === where.status && row.expires_at > where.expires_at.gt).length,
    },
    activityLog: { create: async () => ({}) },
  };
  return { tenants, users, invites, prisma };
}

function workspace(store: ReturnType<typeof memory>, id: string, plan: string) {
  store.tenants.set(id, { id, plan, plan_expires_at: null, limits: {} });
}

describe('团队邀请', () => {
  const now = new Date('2026-11-10T00:00:00Z');

  it('席位来自现有国内套餐，不另写一套人数', () => {
    expect(seatLimit({ plan: 'free' })).toBe(1);
    expect(seatLimit({ plan: 'pro' })).toBe(1);
    expect(seatLimit({ plan: 'team' })).toBe(5);
    expect(seatLimit({ plan: 'enterprise' })).toBe(20);
    expect(seatLimit({ plan: 'team', plan_expires_at: new Date('2020-01-01') })).toBe(1);
  });

  it('所有者可以用邮箱或链接邀请；邮件只记入替身，不把对方直接加成成员', async () => {
    const store = memory();
    workspace(store, 't1', 'team');
    store.users.set('owner', { id: 'owner', tenant_id: 't1', role: 'owner', status: 'active', email: 'owner@example.com' });
    const mailer = new RecordingTeamInviteMailer();
    const service = new TeamService(store.prisma, mailer);
    const emailed = await service.createInvite('t1', 'owner', { email: 'New@Example.com', role: 'editor' }, now);
    expect(emailed.delivery).toBe('recorded');
    expect(emailed.role).toBe('editor');
    expect(mailer.sent).toEqual([expect.objectContaining({ to: 'new@example.com', token: emailed.token })]);
    expect([...store.users.keys()]).toEqual(['owner']);
    const linked = await service.createInvite('t1', 'owner', {}, now);
    expect(linked.delivery).toBe('link');
    expect(linked.email).toBeNull();
    expect(mailer.sent).toHaveLength(1);
  });

  it('非所有者不能邀请，也不能指定所有者角色', async () => {
    const store = memory();
    workspace(store, 't1', 'team');
    store.users.set('member', { id: 'member', tenant_id: 't1', role: 'admin', status: 'active', email: 'a@example.com' });
    const service = new TeamService(store.prisma, new RecordingTeamInviteMailer());
    await expect(service.createInvite('t1', 'member', { email: 'b@example.com' }, now)).rejects.toThrow(/所有者/);
    store.users.set('owner', { id: 'owner', tenant_id: 't1', role: 'owner', status: 'active', email: 'o@example.com' });
    await expect(service.createInvite('t1', 'owner', { role: 'owner' }, now)).rejects.toThrow(/角色/);
  });

  it('席位算上未过期邀请，满员后不能再邀请', async () => {
    const store = memory();
    workspace(store, 't1', 'pro');
    store.users.set('owner', { id: 'owner', tenant_id: 't1', role: 'owner', status: 'active', email: 'o@example.com' });
    const service = new TeamService(store.prisma, new RecordingTeamInviteMailer());
    await expect(service.createInvite('t1', 'owner', { email: 'a@example.com' }, now)).rejects.toThrow(/席位已满（上限 1）/);
  });

  it('接受后按邀请角色加入，且同一链接不能再用；拒绝、撤销、过期都不能加入', async () => {
    const store = memory();
    workspace(store, 't1', 'team');
    workspace(store, 'solo', 'free');
    store.users.set('owner', { id: 'owner', tenant_id: 't1', role: 'owner', status: 'active', email: 'o@example.com' });
    store.users.set('guest', { id: 'guest', tenant_id: 'solo', role: 'owner', status: 'active', email: 'guest@example.com' });
    const service = new TeamService(store.prisma, new RecordingTeamInviteMailer());
    const invite = await service.createInvite('t1', 'owner', { email: 'guest@example.com', role: 'admin' }, now);
    const accepted = await service.acceptInvite('guest', invite.token, now);
    expect(accepted).toMatchObject({ accepted: true, role: 'admin', tenantId: 't1' });
    expect(store.users.get('guest').role).toBe('admin');
    expect(store.users.get('guest').tenant_id).toBe('t1');
    await expect(service.acceptInvite('guest', invite.token, now)).rejects.toThrow(/已结束/);

    store.users.set('other', { id: 'other', tenant_id: 'solo', role: 'owner', status: 'active', email: 'other@example.com' });
    const declined = await service.createInvite('t1', 'owner', { email: 'other@example.com', role: 'viewer' }, now);
    await service.declineInvite('other', declined.token, now);
    await expect(service.acceptInvite('other', declined.token, now)).rejects.toThrow(/已结束/);

    const revoked = await service.createInvite('t1', 'owner', { email: 'other@example.com' }, now);
    await service.revokeInvite('t1', 'owner', revoked.id, now);
    await expect(service.acceptInvite('other', revoked.token, now)).rejects.toThrow(/已结束/);

    const stale = await service.createInvite('t1', 'owner', { email: 'other@example.com' }, now);
    await expect(service.acceptInvite('other', stale.token, new Date(now.getTime() + 24 * 60 * 60 * 1000))).rejects.toThrow(/过期/);
  });

  it('别的工作区不能撤销邀请，指定邮箱的邀请也不能由别人接受', async () => {
    const store = memory();
    workspace(store, 't1', 'team');
    workspace(store, 't2', 'team');
    store.users.set('owner', { id: 'owner', tenant_id: 't1', role: 'owner', status: 'active', email: 'o@example.com' });
    store.users.set('intruder', { id: 'intruder', tenant_id: 't2', role: 'owner', status: 'active', email: 'intruder@example.com' });
    const service = new TeamService(store.prisma, new RecordingTeamInviteMailer());
    const invite = await service.createInvite('t1', 'owner', { email: 'guest@example.com', role: 'editor' }, now);
    await expect(service.revokeInvite('t2', 'intruder', invite.id, now)).rejects.toThrow(/只能撤销/);
    await expect(service.listInvites('t2', 'intruder', now)).resolves.toEqual([]);
    await expect(service.acceptInvite('intruder', invite.token, now)).rejects.toThrow(/指定邮箱/);
    expect(store.users.get('intruder').tenant_id).toBe('t2');
  });
});
