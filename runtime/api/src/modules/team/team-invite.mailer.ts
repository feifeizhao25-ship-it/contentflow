/**
 * 邀请邮件的抽象。默认实现只记录，不打开网络、不调用邮件供应商。
 * 测试注入同一个接口的替身。
 */
export interface TeamInviteMail {
  to: string;
  tenantId: string;
  role: string;
  token: string;
  expiresAt: string;
}

export interface TeamInviteMailer {
  send(mail: TeamInviteMail): Promise<void>;
}

export class RecordingTeamInviteMailer implements TeamInviteMailer {
  readonly sent: TeamInviteMail[] = [];

  async send(mail: TeamInviteMail): Promise<void> {
    this.sent.push({ ...mail });
  }
}
