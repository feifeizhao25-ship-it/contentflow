import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export interface DataSyncJobData {
  type: string;
  accountId?: string;
  [key: string]: any;
}

@Injectable()
export class DataSyncQueueService {
  private readonly logger = new Logger(DataSyncQueueService.name);

  constructor(
    @InjectQueue('data-sync-queue') private readonly dataSyncQueue: Queue<DataSyncJobData>,
  ) {}

  async addSyncTask(type: string, data: any) {
    const job = await this.dataSyncQueue.add({
      type,
      ...data,
    });
    return job;
  }

  async scheduleAccountSync(accountId: string) {
    return this.addSyncTask('account_sync', { accountId });
  }

  async scheduleHotTopicsSync() {
    return this.addSyncTask('hot_topics_sync', {});
  }

  async getQueueStats() {
    return {
      waiting: await this.dataSyncQueue.getWaitingCount(),
      active: await this.dataSyncQueue.getActiveCount(),
      completed: await this.dataSyncQueue.getCompletedCount(),
      failed: await this.dataSyncQueue.getFailedCount(),
    };
  }
}
