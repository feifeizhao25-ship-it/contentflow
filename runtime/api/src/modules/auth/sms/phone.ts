/**
 * 手机号规范化。国内版只接受中国大陆手机号（11 位，1[3-9] 开头），
 * 允许带 +86 / 86 前缀和空格、横线；统一成 11 位数字。
 */
export function normalizeChinaMobile(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let value = input.replace(/[\s-]/g, '');
  if (value.startsWith('+86')) value = value.slice(3);
  else if (value.length === 13 && value.startsWith('86')) value = value.slice(2);
  return /^1[3-9]\d{9}$/.test(value) ? value : null;
}
