import { RetryableWebhookDnsError, WebhookDeliveryDeps, isBlockedWebhookAddress, isBlockedWebhookHost, resolveWebhookAddresses } from './webhook-delivery';

export interface WebhookAuditRow { id: string; tenant_id: string; url: string; status?: string }
export interface WebhookAuditFinding {
  id: string;
  tenant_id: string;
  status?: string;
  host: string;
  reason: 'invalid_url' | 'not_https' | 'blocked_host' | 'private_or_reserved_address' | 'nxdomain' | 'dns_temporarily_unavailable';
  addresses: string[];
}

/**
 * 只读：逐条检查已存订阅的域名现在解析到哪里，列出指向本机/内网/保留地址或解析不了的订阅。
 * 不改库、不投递、不输出 URL 路径和密钥（只给 host）。
 */
export async function auditWebhookSubscriptions(
  rows: WebhookAuditRow[],
  lookup: NonNullable<WebhookDeliveryDeps['lookup']>,
): Promise<WebhookAuditFinding[]> {
  const findings: WebhookAuditFinding[] = [];
  for (const row of rows) {
    const base = { id: row.id, tenant_id: row.tenant_id, status: row.status };
    let url: URL;
    try { url = new URL(String(row.url || '').trim()); } catch { findings.push({ ...base, host: '', reason: 'invalid_url', addresses: [] }); continue; }
    const host = url.hostname;
    if (url.protocol !== 'https:') { findings.push({ ...base, host, reason: 'not_https', addresses: [] }); continue; }
    if (isBlockedWebhookHost(host)) { findings.push({ ...base, host, reason: 'blocked_host', addresses: [] }); continue; }
    const literal = host.replace(/^\[|\]$/g, '');
    if (literal.includes(':') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(literal)) continue; // 公网 IP 字面量，上面已判过
    try {
      const records = await resolveWebhookAddresses(host, lookup);
      const blocked = records.filter((r) => isBlockedWebhookAddress(r.address)).map((r) => r.address);
      if (!records.length) findings.push({ ...base, host, reason: 'nxdomain', addresses: [] });
      else if (blocked.length) findings.push({ ...base, host, reason: 'private_or_reserved_address', addresses: blocked });
    } catch (e) {
      findings.push({ ...base, host, reason: e instanceof RetryableWebhookDnsError ? 'dns_temporarily_unavailable' : 'nxdomain', addresses: [] });
    }
  }
  return findings;
}
