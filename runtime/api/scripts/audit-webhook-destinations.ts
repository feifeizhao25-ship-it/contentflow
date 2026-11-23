/*
 * 只读审计：列出已存 Webhook 订阅里，域名现在解析到本机/内网/链路本地/保留地址（或解析不了）的条目。
 *
 *   本地样例（不连任何库）：npx ts-node scripts/audit-webhook-destinations.ts --fixture path/to/rows.json
 *   连库（只做 SELECT id, tenant_id, url, status；不读密钥、不改数据）：
 *     AUDIT_WEBHOOKS_READONLY=yes npx ts-node scripts/audit-webhook-destinations.ts --from-db
 *
 * 输出 JSON：每条只有 id、tenant_id、status、host、reason、addresses，不含 URL 路径和密钥。
 * 连生产库前请先确认用的是只读账号；这个脚本本身不写库，也不发任何 HTTP 请求。
 */
import { readFileSync } from 'fs';
import { lookup as dnsLookup } from 'dns/promises';
import { auditWebhookSubscriptions, WebhookAuditRow } from '../src/modules/developer/webhook-audit';

async function systemLookup(hostname: string) {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.map((r) => ({ address: r.address, family: r.family }));
}

async function loadRows(argv: string[]): Promise<WebhookAuditRow[]> {
  const fixture = argv.indexOf('--fixture');
  if (fixture >= 0) return JSON.parse(readFileSync(argv[fixture + 1], 'utf8'));
  if (argv.includes('--from-db')) {
    if (process.env.AUDIT_WEBHOOKS_READONLY !== 'yes') throw new Error('连库前请设置 AUDIT_WEBHOOKS_READONLY=yes，并确认 DATABASE_URL 是只读账号');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    try {
      return await prisma.webhookSubscription.findMany({ select: { id: true, tenant_id: true, url: true, status: true } });
    } finally {
      await prisma.$disconnect();
    }
  }
  throw new Error('用法：--fixture rows.json 或 --from-db');
}

export async function main(argv = process.argv.slice(2), lookup = systemLookup) {
  const rows = await loadRows(argv);
  const findings = await auditWebhookSubscriptions(rows, lookup);
  process.stdout.write(JSON.stringify({ checked: rows.length, flagged: findings.length, findings }, null, 2) + '\n');
  return findings;
}

if (require.main === module) {
  main().catch((e) => { process.stderr.write(`${e?.message ?? e}\n`); process.exit(1); });
}
