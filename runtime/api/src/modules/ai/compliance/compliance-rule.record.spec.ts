import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ComplianceRuleError,
  complianceRuleCreateData,
  complianceRulePublishPatch,
  complianceRuleSignPatch,
} from './compliance-rule.record';
import { ComplianceRuleService } from './compliance-rule.service';

describe('compliance rule reviewer stays empty until a person signs', () => {
  const migration = readFileSync(
    join(__dirname, '../../../database/prisma/migrations/20261109130000_compliance_rule_fields/migration.sql'),
    'utf8',
  );

  it('migration stores version, reviewer, example and counter-example without signing anyone', () => {
    for (const column of ['"version"', '"reviewer"', '"example"', '"counter_example"']) {
      expect(migration).toContain(column);
    }
    expect(migration).toContain('"published" BOOLEAN NOT NULL DEFAULT false');
    expect(migration).not.toMatch(/INSERT/i);
    expect(migration).not.toMatch(/OpenClaw|自动复核/);
  });

  it('creating a rule drops any supplied reviewer and stays unpublished', () => {
    const row = complianceRuleCreateData({
      rule_id: ' CN-AD-ART9-3 ',
      market: 'cn',
      version: 'cn-content-2026.10.31',
      example: '  这是普通分享  ',
      counter_example: '全网第一',
      body: '绝对化用语',
      reviewer: 'OpenClaw 自动复核',
      published: true,
    });
    expect(row).toEqual({
      rule_id: 'CN-AD-ART9-3',
      market: 'cn',
      version: 'cn-content-2026.10.31',
      reviewer: null,
      example: '这是普通分享',
      counter_example: '全网第一',
      body: '绝对化用语',
      published: false,
    });
  });

  it('automatic names cannot sign or publish', () => {
    for (const name of ['', '   ', 'OpenClaw 自动复核', 'openclaw', 'bot', 'system', 'github-actions']) {
      expect(() => complianceRuleSignPatch(name)).toThrow(ComplianceRuleError);
      expect(() => complianceRulePublishPatch({ reviewer: name })).toThrow(ComplianceRuleError);
    }
    expect(complianceRuleSignPatch('合规专员张某')).toEqual({ reviewer: '合规专员张某' });
    expect(complianceRulePublishPatch({ reviewer: '合规专员张某' })).toEqual({ published: true });
  });

  it('the write service never calls the database when the signer is not a person', async () => {
    const prisma = {
      complianceRule: {
        create: jest.fn(async ({ data }: any) => data),
        update: jest.fn(async ({ data }: any) => data),
        findUnique: jest.fn(async () => ({ reviewer: 'OpenClaw 自动复核' })),
      },
    };
    const service = new ComplianceRuleService(prisma as any);
    const created = await service.create({
      rule_id: 'INTL-DISCLOSURE',
      market: 'intl',
      version: 'intl-content-2026.11.06',
      reviewer: 'OpenClaw 自动复核',
      published: true,
    });
    expect(created.reviewer).toBeNull();
    expect(created.published).toBe(false);
    expect(prisma.complianceRule.create).toHaveBeenCalledTimes(1);

    await expect(service.sign('rule-1', 'OpenClaw 自动复核')).rejects.toThrow('reviewer_not_human');
    await expect(service.publish('rule-1')).rejects.toThrow('reviewer_not_human');
    expect(prisma.complianceRule.update).not.toHaveBeenCalled();

    prisma.complianceRule.findUnique.mockResolvedValue({ reviewer: '合规专员张某' });
    await service.sign('rule-1', '合规专员张某');
    await service.publish('rule-1');
    expect(prisma.complianceRule.update).toHaveBeenNthCalledWith(1, { where: { id: 'rule-1' }, data: { reviewer: '合规专员张某' } });
    expect(prisma.complianceRule.update).toHaveBeenNthCalledWith(2, { where: { id: 'rule-1' }, data: { published: true } });
  });
});
