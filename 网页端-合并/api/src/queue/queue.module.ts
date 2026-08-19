import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PublishQueueService } from './publish-queue.service';
import { AIQueueService } from './ai-queue.service';
import { DataSyncQueueService } from './data-sync-queue.service';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD') || undefined,
          db: configService.get('REDIS_DB', 0),
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'publish-queue' },
      { name: 'ai-generate-queue' },
      { name: 'data-sync-queue' },
    ),
  ],
  providers: [PublishQueueService, AIQueueService, DataSyncQueueService],
  exports: [BullModule, PublishQueueService, AIQueueService, DataSyncQueueService],
})
export class QueueModule {}
