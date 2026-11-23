import { apiErrorText } from './api-error';

/** 邀请表单交给后端的字段。留言去掉首尾空白；没写就不传，避免把空串当成留言。 */
export function inviteRequestBody(values: { email?: string; role?: string; message?: string }): {
  email?: string;
  role: string;
  message?: string;
} {
  const email = typeof values.email === 'string' ? values.email.trim() : '';
  const role = typeof values.role === 'string' && values.role.trim() ? values.role.trim() : 'editor';
  const message = typeof values.message === 'string' ? values.message.trim() : '';
  return {
    ...(email ? { email } : {}),
    role,
    ...(message ? { message } : {}),
  };
}

/** 席位已满：后端错误码或中文原因都算。这时邀请弹窗留下「查看套餐」。 */
export function inviteSeatFull(envelope: unknown): boolean {
  if (!envelope || typeof envelope !== 'object') return false;
  const error = (envelope as { error?: { code?: unknown; message?: unknown } }).error;
  if (error?.code === 'INVITE_SEAT_FULL') return true;
  const text = apiErrorText(envelope);
  return typeof text === 'string' && text.includes('席位已满');
}
