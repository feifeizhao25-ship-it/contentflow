import { TenantService } from './tenant.service';
it('unlimited accounts permit usage and unknown quota types fail closed', async () => {
 const service = new TenantService({ tenant: { findUnique: jest.fn().mockResolvedValue({ limits: { max_accounts: -1 }, usage_stats: { accounts_count: 5 } }) } } as any);
 expect(await service.checkQuota('t', 'account')).toBe(true);
 expect(await service.checkQuota('t', 'misspelled')).toBe(false);
});
it('expired membership cannot add paid-tier team members', async () => {
 const service = new TenantService({ tenant: { findUnique: jest.fn().mockResolvedValue({ plan: 'team', plan_expires_at: new Date(0), limits: { max_members: 5 }, usage_stats: { members_count: 1 } }) } } as any);
 expect(await service.checkQuota('t', 'member')).toBe(false);
});
