export interface ComplianceHitView {
  ruleId: string;
  severity: 'block' | 'review';
  reason: string;
}

export interface ComplianceView {
  passed: boolean;
  level: 'violation' | 'risk' | 'clear';
  disclaimer: string;
  mode?: string;
  hits: ComplianceHitView[];
}

function asHits(value: unknown): ComplianceHitView[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((hit) => {
    if (!hit || typeof hit !== 'object') return [];
    const reason = typeof (hit as { reason?: unknown }).reason === 'string' ? (hit as { reason: string }).reason : '';
    if (!reason.trim()) return [];
    const severity = (hit as { severity?: unknown }).severity === 'block' ? 'block' : 'review';
    const ruleId = typeof (hit as { ruleId?: unknown }).ruleId === 'string' ? (hit as { ruleId: string }).ruleId : '';
    return [{ ruleId, severity, reason }];
  });
}

/** 检查接口或错误信封里的合规结果。认不出级别时返回 null，不编造。 */
export function parseCompliance(payload: unknown): ComplianceView | null {
  const raw = payload && typeof payload === 'object' && 'data' in (payload as object) && (payload as { data?: unknown }).data
    ? (payload as { data: unknown }).data
    : payload;
  if (!raw || typeof raw !== 'object') return null;
  const level = (raw as { level?: unknown }).level;
  if (level !== 'violation' && level !== 'risk' && level !== 'clear') return null;
  const disclaimer = typeof (raw as { disclaimer?: unknown }).disclaimer === 'string' ? (raw as { disclaimer: string }).disclaimer : '';
  const hits = asHits((raw as { hits?: unknown }).hits);
  return {
    passed: level !== 'violation' && (raw as { passed?: unknown }).passed !== false,
    level,
    disclaimer,
    mode: typeof (raw as { mode?: unknown }).mode === 'string' ? (raw as { mode: string }).mode : undefined,
    hits,
  };
}

export function complianceFromError(error: unknown): ComplianceView | null {
  const compliance = (error as { compliance?: unknown } | null)?.compliance;
  if (!compliance) return null;
  return parseCompliance(compliance);
}
