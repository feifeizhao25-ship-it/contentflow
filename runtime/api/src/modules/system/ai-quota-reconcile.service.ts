import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsageService } from './usage.service';

/** 每分钟把「模型已成功、记账还没写成」的预占补记入账，并把过期且没有结果的预占退回。 */
@Injectable()
export class AiQuotaReconcileService {
  private readonly logger = new Logger(AiQuotaReconcileService.name);

  constructor(private readonly usage: UsageService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    try {
      const result = await this.usage.reconcileAiReservations();
      if (result.committed || result.released || result.failed) {
        this.logger.log(`AI 额度对账：入账 ${result.committed}，退回 ${result.released}，失败 ${result.failed}`);
      }
    } catch (error) {
      this.logger.error(`AI 额度对账失败：${error instanceof Error ? error.message : error}`);
    }
  }
}
