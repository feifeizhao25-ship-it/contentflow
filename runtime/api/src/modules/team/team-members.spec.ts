/**
 * 成员列表：已注销的人不出现；手机号注册的账号没有邮箱，占位邮箱不外露。
 */
import { TeamService } from './team.service';
import { UserService } from '../user/user.service';

describe('成员列表', () => {
  const prisma: any = { user: { findMany: jest.fn(), findFirst: jest.fn() } };
  const rows = [
    { id: 'a', email: 'a@example.com', name: '甲', role: 'owner', status: 'active' },
    { id: 'b', email: 'phone-b@phone.invalid', name: '乙', role: 'member', status: 'active' },
  ];

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.user.findMany.mockResolvedValue(rows);
    prisma.user.findFirst.mockResolvedValue(rows[1]);
  });

  it('GET /team/members：只列在职成员（原来连已注销的匿名行都列出来）', async () => {
    await new TeamService(prisma).getMembers('t1');
    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ tenant_id: 't1', status: 'active' });
  });

  it('GET /team/members：占位邮箱显示为空', async () => {
    const members = await new TeamService(prisma).getMembers('t1');
    expect(members.map((m: any) => m.email)).toEqual(['a@example.com', '']);
    expect(JSON.stringify(members)).not.toContain('phone.invalid');
  });

  it('GET /users/members 与 /users/:id：占位邮箱显示为空', async () => {
    const service = new UserService(prisma);
    expect((await service.findByTenant('t1')).map((m: any) => m.email)).toEqual(['a@example.com', '']);
    expect((await service.findInTenant('b', 't1')).email).toBe('');
  });
});
