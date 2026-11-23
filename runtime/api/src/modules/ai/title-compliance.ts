/**
 * 给已经解析好的标题逐条跑国内合规检查。
 * 违规标题仍然返回，并标成「违规」，方便创作页逐条展示，而不是整批丢掉后用户看不到原因。
 */
import { evaluateDomesticContent } from '../../common/domestic-content-compliance';

export type TitleStatusLabel = '违规' | '需复核' | '未发现';

export interface TitleComplianceItem {
  title: string;
  statusLabel: TitleStatusLabel;
  level: 'violation' | 'risk' | 'clear';
  passed: boolean;
  hits: Array<{
    ruleId: string;
    severity: 'block' | 'review';
    reason: string;
    label?: string;
    matchedTerms: string[];
  }>;
}

export function titleStatusFromLevel(level: 'violation' | 'risk' | 'clear'): TitleStatusLabel {
  if (level === 'violation') return '违规';
  if (level === 'risk') return '需复核';
  return '未发现';
}

export function checkGeneratedTitles(titles: readonly string[]): TitleComplianceItem[] {
  return titles.map((title) => {
    const result = evaluateDomesticContent(title);
    return {
      title,
      statusLabel: titleStatusFromLevel(result.level),
      level: result.level,
      passed: result.passed,
      hits: result.hits.map((hit) => ({
        ruleId: hit.ruleId,
        severity: hit.severity,
        reason: hit.reason,
        ...(hit.label ? { label: hit.label } : {}),
        matchedTerms: hit.matchedTerms,
      })),
    };
  });
}
