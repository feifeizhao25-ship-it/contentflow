import { readFileSync } from 'fs';
import { join } from 'path';
import { AppendOnlyAuditLog } from './audit-log';
import { assignArm } from './canary';
import { runCycleFromInput } from './cli';
import { CycleInput, runImprovementCycle } from './cycle';

function input(overrides: Partial<CycleInput> = {}): CycleInput {
  return {
    metrics: [
      { arm: 'control', conversions: 40, trials: 100 },
      { arm: 'treatment', conversions: 80, trials: 100 },
    ],
    proposal: { id: 'title-v2', kind: 'copy', text: '标题候选', needsHumanApproval: false },
    evalPassed: true,
    complianceOk: true,
    ...overrides,
  };
}

describe('自改进循环', () => {
  it('明显优于对照才晋升，明显差则回滚，重叠则不改', () => {
    expect(runImprovementCycle(input()).action).toBe('promote');
    expect(runImprovementCycle(input({
      metrics: [
        { arm: 'control', conversions: 80, trials: 100 },
        { arm: 'treatment', conversions: 10, trials: 100 },
      ],
    })).action).toBe('rollback');
    expect(runImprovementCycle(input({
      metrics: [
        { arm: 'control', conversions: 50, trials: 100 },
        { arm: 'treatment', conversions: 55, trials: 100 },
      ],
    })).action).toBe('no_change');
  });

  it('闸门失败或样本不足时保持不变', () => {
    expect(runImprovementCycle(input({ complianceOk: false })).action).toBe('no_change');
    expect(runImprovementCycle(input({ evalPassed: false })).action).toBe('no_change');
    expect(runImprovementCycle(input({
      proposal: { id: 'rag', kind: 'rag', text: '规则', needsHumanApproval: true },
    })).action).toBe('no_change');
    expect(runImprovementCycle(input({
      metrics: [
        { arm: 'control', conversions: 8, trials: 10 },
        { arm: 'treatment', conversions: 9, trials: 10 },
      ],
    })).action).toBe('no_change');
  });

  it('审计只追加，序号递增，对照分组稳定且约占 15%', () => {
    const log = new AppendOnlyAuditLog();
    const result = runCycleFromInput(input());
    log.append({ action: result.decision.action, subject: 'title-v2', detail: { reasons: result.decision.reasons } });
    log.append({ action: 'no_change', subject: 'later' });
    const rows = log.list();
    expect(rows.map((row) => row.sequence)).toEqual([1, 2]);
    expect(() => {
      (rows[0].detail as { extra?: number }).extra = 1;
    }).toThrow();
    expect(assignArm('visitor-42')).toBe(assignArm('visitor-42'));
    let control = 0;
    for (let i = 0; i < 1000; i += 1) if (assignArm(`visitor-${i}`) === 'control') control += 1;
    expect(control).toBeGreaterThan(100);
    expect(control).toBeLessThan(200);
  });

  it('cron 说明留给人工安装，不写入 OpenClaw 目录', () => {
    const cron = JSON.parse(readFileSync(join(__dirname, 'openclaw-cron.json'), 'utf8'));
    expect(cron.install).toBe('human');
    expect(cron.jobs.map((job: { name: string }) => job.name)).toEqual(['cn-trio-growth-daily', 'cn-trio-growth-weekly-research']);
    expect(JSON.stringify(cron)).not.toContain('~/.openclaw/workspace');
  });
});
