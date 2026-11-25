/** 平台账号名：空字符串、纯空白、null、缺失都显示为「未命名账号」，避免对空值取首字时崩溃。 */
export function accountDisplayName(name: unknown): string {
  if (typeof name !== 'string') return '未命名账号';
  const text = name.trim();
  return text || '未命名账号';
}

export function accountInitial(name: unknown): string {
  return Array.from(accountDisplayName(name))[0] ?? '账';
}

function placeholderAuth(authType: unknown): boolean {
  return typeof authType === 'string' && /placeholder|not_live/i.test(authType);
}

/** 占位授权不是官方接通。超额停用只在接口给出 within_plan=false 时标出。 */
export function accountConnectionLabel(authType: unknown): string {
  return placeholderAuth(authType) ? '未接通' : '已保存授权';
}

export function accountRunLabel(status: unknown, authType: unknown, withinPlan: unknown): string {
  if (withinPlan === false) return '已暂停（超出套餐名额）';
  if (placeholderAuth(authType)) return '未接通';
  if (status === 'active') return '运行中';
  if (status === 'expired') return '授权已过期';
  return '异常';
}
