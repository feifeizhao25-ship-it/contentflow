import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export interface PublishJobData {
  taskId: string;
  contentId: string;
  platformAccountId: string;
  platform: string;
  scheduledAt?: Date;
}

@Injectable()
export class PublishQueueService {
  private readonly logger = new Logger(PublishQueueService.name);

  constructor(
    @InjectQueue('publish-queue') private readonly publishQueue: Queue<PublishJobData>,
  ) {}

  async addPublishTask(data: PublishJobData, delay?: number) {
    const job = await this.publishQueue.add(data, {
      delay: delay || 0,
      jobId: `publish-${data.taskId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
    return job;
  }

  async addBulkPublishTasks(tasks: PublishJobData[]) {
    return this.publishQueue.addBulk(tasks.map(task => ({
      data: task,
      jobId: `publish-${task.taskId}`,
    })));
  }

  async retryPublishTask(data: PublishJobData) {
    const existing = await this.publishQueue.getJob(`publish-${data.taskId}`);
    if (existing) {
      const state = await existing.getState();
      if (state === 'failed') {
        await existing.retry();
        return existing;
      }
      if (['waiting', 'active', 'delayed'].includes(state)) return existing;
    }
    return this.publishQueue.add(data, {
      jobId: `publish-${data.taskId}-retry-${Date.now()}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }

  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.publishQueue.getWaitingCount(),
      this.publishQueue.getActiveCount(),
      this.publishQueue.getCompletedCount(),
      this.publishQueue.getFailedCount(),
      this.publishQueue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }
}
