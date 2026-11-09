/**
 * 合规规则的落库形状。
 *
 * reviewer 只能由 humanReviewerName 接受的真人姓名写入。
 * 创建时一律留空、published 一律 false，调用方传入的签署人或发布标记会被丢掉。
 */

const MACHINE_REVIEWER = /openclaw|自动复核|自动审核|github-actions|^(?:bot|system|auto|cron|ci)\b/i;

/** 空字符串和自动复核都不是人工签署。 */
export function humanReviewerName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || MACHINE_REVIEWER.test(name)) return '';
  return name;
}

export class ComplianceRuleError extends Error {}

export interface ComplianceRuleDraft {
  rule_id: string;
  market: string;
  version: string;
  example?: string | null;
  counter_example?: string | null;
  body?: string;
  /** 即使传入也会被丢掉。 */
  reviewer?: string | null;
  published?: boolean;
}

export interface ComplianceRuleWrite {
  rule_id: string;
  market: string;
  version: string;
  reviewer: null;
  example: string | null;
  counter_example: string | null;
  body: string;
  published: false;
}

function optionalText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function complianceRuleCreateData(draft: ComplianceRuleDraft): ComplianceRuleWrite {
  const rule_id = draft.rule_id.trim();
  const market = draft.market.trim();
  const version = draft.version.trim();
  if (!rule_id || !market || !version) throw new ComplianceRuleError('rule_id, market and version are required');
  return {
    rule_id,
    market,
    version,
    reviewer: null,
    example: optionalText(draft.example),
    counter_example: optionalText(draft.counter_example),
    body: draft.body ?? '',
    published: false,
  };
}

/** 真人签署只填写 reviewer，不把规则改成已发布。 */
export function complianceRuleSignPatch(reviewer: string): { reviewer: string } {
  const name = humanReviewerName(reviewer);
  if (!name) throw new ComplianceRuleError('reviewer_not_human');
  return { reviewer: name };
}

/** 没有真人签署人时不能发布。 */
export function complianceRulePublishPatch(row: { reviewer: string | null | undefined }): { published: true } {
  if (!humanReviewerName(row.reviewer)) throw new ComplianceRuleError('reviewer_not_human');
  return { published: true };
}
