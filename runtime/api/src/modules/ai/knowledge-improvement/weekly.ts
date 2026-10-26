export interface BlockFeedback {
  tenantId: string;
  platform: string;
  code: string;
}

export interface RuleProposal {
  proposals: { platform: string; code: string; count: number; text: string }[];
  needsHumanApproval: true;
  autoApplied: false;
}

/** 只输出匿名聚合。提案不自动进入规则库。 */
export function proposeRuleUpdates(rows: BlockFeedback[]): RuleProposal {
  const counts = new Map<string, { platform: string; code: string; count: number }>();
  for (const row of rows) {
    const key = `${row.platform}:${row.code}`;
    const current = counts.get(key) ?? { platform: row.platform, code: row.code, count: 0 };
    current.count += 1;
    counts.set(key, current);
  }
  return {
    needsHumanApproval: true,
    autoApplied: false,
    proposals: [...counts.values()].map((item) => ({
      ...item,
      text: `${item.platform} 的规则 ${item.code} 本周被拦截 ${item.count} 次。请人工决定是否更新平台规则库。`,
    })),
  };
}
