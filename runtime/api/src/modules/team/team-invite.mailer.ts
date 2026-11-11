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

/** Nest 注入令牌。接口在编译后会被擦掉，不能靠类型本身注入。 */
export const TEAM_INVITE_MAILER = 'TEAM_INVITE_MAILER';

export class RecordingTeamInviteMailer implements TeamInviteMailer {
  readonly sent: TeamInviteMail[] = [];

  async send(mail: TeamInviteMail): Promise<void> {
    this.sent.push({ ...mail });
  }
}
