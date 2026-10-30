import { Candidate } from './store';

/**
 * 企业微信审批。默认关闭、超时即不晋升（timeout = no promotion）。
 * 审批人名单来自环境变量 POLICY_REVIEWERS（逗号分隔的企业微信 userid）。
 * 名单为空 = 没有任何人能批准。TODO(owner): 由负责人填写，本代码与自动化流程都不得代填。
 * expert_signed 之类的专家签字由真实人员在外部完成，这里永不设置。
 * 密钥只通过环境变量名读取：WECOM_CORP_ID / WECOM_AGENT_ID / WECOM_APP_SECRET。
 */
export interface ApprovalPolicy {
  reviewers: ReadonlySet<string>;
  timeoutHours: number;
}

export function approvalPolicyFromEnv(env: NodeJS.ProcessEnv = process.env): ApprovalPolicy {
  const reviewers = new Set((env.POLICY_REVIEWERS ?? '').split(',').map((s) => s.trim()).filter(Boolean));
  return { reviewers, timeoutHours: Number(env.SIL_APPROVAL_TIMEOUT_HOURS ?? 72) };
}

export const canApprove = (p: ApprovalPolicy, reviewer: string): boolean => p.reviewers.has(reviewer);

export function buildCard(c: Candidate, gatesPassed: boolean, baseUrl = ''): Record<string, unknown> {
  return {
    msgtype: 'textcard',
    textcard: {
      title: `[自改进] 待审批：${c.id}`,
      description:
        `<div class="gray">对象：${c.target}（${c.kind}）</div><div class="normal">${c.summary.slice(0, 120)}</div>` +
        `<div class="highlight">门禁：${gatesPassed ? '通过' : '未通过'}${c.needs_expert ? ' · 需真实专家签字' : ''}</div>` +
        '<div class="gray">超时未批准将作废，不会上线。</div>',
      url: baseUrl ? `${baseUrl}/self-improve/${c.id}` : 'about:blank',
      btntxt: '查看详情',
    },
  };
}

export interface Gateway {
  send(card: Record<string, unknown>, toUsers: string[]): Promise<string>;
}

/** 未配置企业微信时使用：只记录，不外发。 */
export class NullGateway implements Gateway {
  sent: { card: Record<string, unknown>; to: string[] }[] = [];
  async send(card: Record<string, unknown>, to: string[]): Promise<string> {
    this.sent.push({ card, to });
    return `null-${this.sent.length}`;
  }
}

export type Http = (method: 'GET' | 'POST', url: string, body?: unknown) => Promise<any>;

export class WeComGateway implements Gateway {
  static readonly API = 'https://qyapi.weixin.qq.com/cgi-bin';
  constructor(private readonly http: Http, private readonly env: NodeJS.ProcessEnv = process.env) {}

  configured(): boolean {
    return ['WECOM_CORP_ID', 'WECOM_AGENT_ID', 'WECOM_APP_SECRET'].every((k) => !!this.env[k]);
  }

  async send(card: Record<string, unknown>, to: string[]): Promise<string> {
    if (!this.configured()) throw new Error('wecom_not_configured');
    if (!to.length) throw new Error('no_reviewers_configured');
    const tok = await this.http('GET', `${WeComGateway.API}/gettoken?corpid=${this.env.WECOM_CORP_ID}&corpsecret=${this.env.WECOM_APP_SECRET}`);
    const res = await this.http('POST', `${WeComGateway.API}/message/send?access_token=${tok.access_token}`, { ...card, touser: to.join('|'), agentid: Number(this.env.WECOM_AGENT_ID) });
    if ((res.errcode ?? 0) !== 0) throw new Error(`wecom_send_failed:${res.errcode}`);
    return String(res.msgid ?? '');
  }
}

export const isTimedOut = (updatedAtIso: string, now: Date, timeoutHours: number): boolean => now.getTime() - Date.parse(updatedAtIso) >= timeoutHours * 3_600_000;
