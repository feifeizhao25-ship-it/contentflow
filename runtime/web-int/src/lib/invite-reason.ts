const INVITE_REASON: Record<string, string> = {
  INVITE_EXPIRED: 'This invite has expired.',
  INVITE_REVOKED: 'This invite was revoked.',
  INVITE_WRONG_EMAIL: 'This invite was sent to a different email address.',
  INVITE_SEAT_FULL: 'This workspace has no seats left.',
  INVITE_CLOSED: 'This invite has already been used.',
  INVITE_NOT_FOUND: 'This invite does not exist.',
  INVITE_ALREADY_MEMBER: 'You are already in this workspace.',
  INVITE_WORKSPACE_BUSY: 'Your current workspace still has other members.',
};

export function inviteReason(envelope: { error?: { code?: string } } | null): string {
  const code = envelope?.error?.code ?? '';
  return INVITE_REASON[code] ?? 'This invite can no longer be used.';
}
