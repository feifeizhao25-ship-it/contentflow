/**
 * 手机号注册的账号没有邮箱，但 User.email 是必填列：用不可送达的占位地址（.invalid 是保留域名）。
 * 占位邮箱不展示、不外发；界面与接口响应里一律当作「没有邮箱」。
 */
export const PHONE_PLACEHOLDER_DOMAIN = 'phone.invalid';

export function placeholderEmail(id: string): string {
  return `phone-${id}@${PHONE_PLACEHOLDER_DOMAIN}`;
}

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return typeof email === 'string' && email.toLowerCase().endsWith(`@${PHONE_PLACEHOLDER_DOMAIN}`);
}

export function publicEmail(email: string | null | undefined): string {
  return !email || isPlaceholderEmail(email) ? '' : email;
}
