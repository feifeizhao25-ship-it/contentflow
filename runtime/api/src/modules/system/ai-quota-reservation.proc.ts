/**
 * 单独进程里的额度预占。集成测试会同时拉起两个这样的进程，连同一个 PostgreSQL。
 * 用法：node dist/modules/system/ai-quota-reservation.proc.js <tenantId> <holdTokens> <idempotencyKey>
 * 数据库地址用 DATABASE_URL。结果以一行 JSON 写到标准输出。
 */
import { PrismaClient } from '@prisma/client';
import { AiQuotaExceededError, UsageService } from './usage.service';

async function main() {
  const [tenantId, holdRaw, idempotencyKey] = process.argv.slice(2);
  const holdTokens = Number(holdRaw);
  const prisma = new PrismaClient();
  const usage = new UsageService(prisma as never);
  try {
    const result = await usage.reserveAiTokens({ tenantId, holdTokens, kind: 'article', idempotencyKey });
    process.stdout.write(`${JSON.stringify({ ok: true, result })}\n`);
  } catch (error) {
    if (error instanceof AiQuotaExceededError) {
      process.stdout.write(`${JSON.stringify({ ok: true, result: { action: 'quota' } })}\n`);
      return;
    }
    process.stdout.write(`${JSON.stringify({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    })}\n`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
