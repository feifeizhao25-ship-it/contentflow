export const SIGNUP_PROFILE_KEYS = ['industry', 'job_role', 'growth_stage', 'province'] as const;

/** 只提交用户真的填写了的项。空答案不写成空字符串。 */
/** 推荐原因按分号拆开，不另造一条理由。 */
export function reasonChips(reason: string): string[] {
  return String(reason || '').split('；').map((part) => part.trim()).filter(Boolean);
}

export function signupProfileBody(values: Record<string, unknown>): Record<string, string> {
  const body: Record<string, string> = {};
  for (const key of SIGNUP_PROFILE_KEYS) {
    const value = values[key];
    if (typeof value === 'string' && value.trim()) body[key] = value.trim();
  }
  return body;
}
