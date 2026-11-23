/** 平台账号名：空字符串、纯空白、null、缺失都显示为「未命名账号」，避免对空值取首字时崩溃。 */
export function accountDisplayName(name: unknown): string {
  if (typeof name !== 'string') return '未命名账号';
  const text = name.trim();
  return text || '未命名账号';
}

export function accountInitial(name: unknown): string {
  return Array.from(accountDisplayName(name))[0] ?? '账';
}
