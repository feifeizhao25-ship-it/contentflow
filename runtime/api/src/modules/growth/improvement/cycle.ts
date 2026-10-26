import { AppendOnlyAuditLog } from './audit-log';
import { wilsonInterval } from './wilson';

export type CycleAction = 'no_change' | 'promote' | 'rollback';

export interface ArmMetric {
  arm: 'control' | 'treatment';
  conversions: number;
  trials: number;
}

export interface CycleProposal {
  id: string;
  kind: 'skill' | 'rag' | 'copy';
  text: string;
  needsHumanApproval: boolean;
  humanApproved?: boolean;
}

export interface CycleInput {
  metrics: ArmMetric[];
  proposal: CycleProposal;
  evalPassed: boolean;
  complianceOk: boolean;
  minSample?: number;
}

export interface CycleDecision {
  action: CycleAction;
  reasons: string[];
}

function arm(metrics: ArmMetric[], name: 'control' | 'treatment'): ArmMetric {
  return metrics.find((item) => item.arm === name) ?? { arm: name, conversions: 0, trials: 0 };
}

/**
 * 闸门失败时一律 no_change。
 * 样本足够且治疗下界高于对照上界才晋升；治疗上界低于对照下界则回滚；否则不改。
 */
export function runImprovementCycle(input: CycleInput): CycleDecision {
  const reasons: string[] = [];
  if (!input.complianceOk) reasons.push('合规闸未通过');
  if (!input.evalPassed) reasons.push('评测未通过');
  if (input.proposal.needsHumanApproval && input.proposal.humanApproved !== true) reasons.push('需要人工批准');
  if (reasons.length) return { action: 'no_change', reasons };

  const minSample = input.minSample ?? 50;
  const control = arm(input.metrics, 'control');
  const treatment = arm(input.metrics, 'treatment');
  if (control.trials < minSample || treatment.trials < minSample) {
    return { action: 'no_change', reasons: [`每组样本不足 ${minSample}`] };
  }
  const controlBand = wilsonInterval(control.conversions, control.trials);
  const treatmentBand = wilsonInterval(treatment.conversions, treatment.trials);
  if (treatmentBand.lower > controlBand.upper) {
    return { action: 'promote', reasons: ['治疗组 Wilson 下界高于对照组上界'] };
  }
  if (treatmentBand.upper < controlBand.lower) {
    return { action: 'rollback', reasons: ['治疗组 Wilson 上界低于对照组下界'] };
  }
  return { action: 'no_change', reasons: ['区间重叠，保持现状'] };
}

export function runAndAudit(input: CycleInput, log = new AppendOnlyAuditLog()): { decision: CycleDecision; log: AppendOnlyAuditLog } {
  const decision = runImprovementCycle(input);
  log.append({ action: decision.action, subject: input.proposal.id, detail: { reasons: decision.reasons, kind: input.proposal.kind } });
  return { decision, log };
}
