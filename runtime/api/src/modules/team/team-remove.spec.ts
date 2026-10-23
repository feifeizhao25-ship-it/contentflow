import { TeamService } from './team.service';
describe('Team 动态与移除（批2）', () => {
  it('removeMember：管理员可移除普通成员并写动态，成员无权、所有者不可移除', async () => {
    const prisma: any = {
      user: {
        findFirst: jest.fn(async ({ where }: any) => where.id === 'actor' ? { id: 'actor', role: 'admin', status: 'active' } : { id: where.id, role: 'member', status: 'active' }),
        update: jest.fn(async () => ({})),
      },
      activityLog: { create: jest.fn(async () => ({})), findMany: jest.fn(async () => [{ id: 'l1', action: 'team.member_removed', resource_type: 'user', resource_id: 'm1', user_id: 'actor', created_at: new Date() }]) },
    };
    const svc = new TeamService(prisma);
    await expect(svc.removeMember('t1', 'actor', 'm1')).resolves.toMatchObject({ removed: true });
    expect(prisma.user.update.mock.calls[0][0].data.status).toBe('removed');
    const acts: any = await svc.getActivity('t1');
    expect(acts[0].action).toBe('team.member_removed');
    prisma.user.findFirst.mockImplementation(async ({ where }: any) => ({ id: where.id, role: where.id === 'actor' ? 'member' : 'owner', status: 'active' }));
    await expect(svc.removeMember('t1', 'actor', 'o1')).rejects.toThrow(/只有团队所有者或管理员/);
  });
});
