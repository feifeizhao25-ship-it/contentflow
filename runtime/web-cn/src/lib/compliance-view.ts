export interface ComplianceHitView {
  ruleId: string;
  severity: 'block' | 'review';
  reason: string;
  label?: string;
}

export interface ComplianceView {
  passed: boolean;
  level: 'violation' | 'risk' | 'clear';
  disclaimer: string;
  mode?: string;
  hits: ComplianceHitView[];
  /** 已启用规则里没有跑到的项目。空数组表示接口没给这份清单。 */
  notChecked: string[];
  rulesChecked?: number;
  /** 候选规则命中。待审核，不改变 passed，不能当成已经检查通过。 */
  candidateHits: ComplianceHitView[];
}

function asHits(value: unknown): ComplianceHitView[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((hit) => {
    if (!hit || typeof hit !== 'object') return [];
    const reason = typeof (hit as { reason?: unknown }).reason === 'string' ? (hit as { reason: string }).reason : '';
    if (!reason.trim()) return [];
    const severity = (hit as { severity?: unknown }).severity === 'block' ? 'block' : 'review';
    const ruleId = typeof (hit as { ruleId?: unknown }).ruleId === 'string' ? (hit as { ruleId: string }).ruleId : '';
    const label = typeof (hit as { label?: unknown }).label === 'string' ? (hit as { label: string }).label.trim() : '';
    return [{ ruleId, severity, reason, ...(label ? { label } : {}) }];
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
  const notChecked = Array.isArray((raw as { notChecked?: unknown }).notChecked)
    ? (raw as { notChecked: unknown[] }).notChecked.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const rulesChecked = Number((raw as { rulesChecked?: unknown }).rulesChecked);
  return {
    passed: level !== 'violation' && (raw as { passed?: unknown }).passed !== false,
    level,
    disclaimer,
    mode: typeof (raw as { mode?: unknown }).mode === 'string' ? (raw as { mode: string }).mode : undefined,
    hits,
    notChecked,
    ...(Number.isInteger(rulesChecked) ? { rulesChecked } : {}),
    candidateHits: asHits((raw as { candidateHits?: unknown }).candidateHits),
  };
}

export interface ComplianceColumns {
  found: string[];
  checkedSummary: string;
  missed: string[];
}

/** 三栏：发现的问题、已检查没问题、这一项没有检查。 */
export function complianceColumns(view: ComplianceView): ComplianceColumns {
  const found = [
    ...view.hits.map((hit) => `${hit.severity === 'block' ? '拦截' : '风险'}：${hit.reason}`),
    ...view.candidateHits.map((hit) => `候选规则，待审核，不构成已通过：${hit.reason}`),
  ];
  const checkedSummary = typeof view.rulesChecked === 'number'
    ? `已检查 ${view.rulesChecked} 条规则。没有命中只说明这批规则没发现，不代表可以发布。`
    : '已按当前启用的规则检查。没有命中只说明这批规则没发现，不代表可以发布。';
  return { found, checkedSummary, missed: view.notChecked };
}

export function complianceFromError(error: unknown): ComplianceView | null {
  const compliance = (error as { compliance?: unknown } | null)?.compliance;
  if (!compliance) return null;
  return parseCompliance(compliance);
}
