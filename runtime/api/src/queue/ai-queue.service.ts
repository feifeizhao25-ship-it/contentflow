import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export interface AIJobData {
  jobId: string;
  tenantId: string;
  userId: string;
  generationType: string;
  inputParams: any;
  model?: string;
}

@Injectable()
export class AIQueueService {
  private readonly logger = new Logger(AIQueueService.name);

  constructor(
    @InjectQueue('ai-generate-queue') private readonly aiQueue: Queue<AIJobData>,
  ) {}

  async addAITask(data: AIJobData) {
    const job = await this.aiQueue.add(data, {
      jobId: `ai-${data.jobId}`,
    });
    return job;
  }

  async getQueueStats() {
    return {
      waiting: await this.aiQueue.getWaitingCount(),
      active: await this.aiQueue.getActiveCount(),
      completed: await this.aiQueue.getCompletedCount(),
      failed: await this.aiQueue.getFailedCount(),
    };
  }
}
