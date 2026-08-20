import { Module } from '@nestjs/common';
import { PublishService } from './publish.service';
import { PublishController } from './publish.controller';
import { QueueModule } from '../../queue/queue.module';
import { TenantModule } from '../tenant/tenant.module';
import { PublishProcessor } from './publish.processor';

@Module({
  imports: [QueueModule, TenantModule],
  providers: [PublishService, PublishProcessor],
  controllers: [PublishController],
  exports: [PublishService],
})
export class PublishModule {}
