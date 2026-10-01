/**
 * 个人信息在日志里的脱敏。日志只允许出现脱敏后的手机号 / 邮箱。
 */
export function maskPhone(phone: string | null | undefined): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length < 7) return '***';
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

export function maskEmail(email: string | null | undefined): string {
  const value = String(email ?? '');
  const at = value.lastIndexOf('@');
  if (at < 1) return '***';
  return `${value[0]}***${value.slice(at)}`;
}
