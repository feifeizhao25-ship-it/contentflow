import { apiErrorText } from '@/lib/api-error';

const INVITE_REASON: Record<string, string> = {
  INVITE_EXPIRED: '邀请已过期。',
  INVITE_REVOKED: '邀请已被撤销。',
  INVITE_WRONG_EMAIL: '这个邀请只发给指定邮箱。',
  INVITE_SEAT_FULL: '席位已满，不能加入。',
  INVITE_CLOSED: '邀请已结束，不能再使用。',
  INVITE_NOT_FOUND: '邀请不存在。',
  INVITE_ALREADY_MEMBER: '你已经在这个工作区。',
  INVITE_WORKSPACE_BUSY: '你当前的工作区还有其他成员，不能转入。',
};

export function inviteReason(envelope: { error?: { code?: string } } | null): string {
  const code = envelope?.error?.code ?? '';
  return INVITE_REASON[code] || apiErrorText(envelope) || '邀请没有完成。';
}
