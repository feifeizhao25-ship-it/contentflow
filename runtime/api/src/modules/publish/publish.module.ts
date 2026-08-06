import { Module } from '@nestjs/common';
import { PublishService } from './publish.service';
import { PublishController } from './publish.controller';
import { QueueModule } from '../../queue/queue.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [QueueModule, TenantModule],
  providers: [PublishService],
  controllers: [PublishController],
  exports: [PublishService],
})
export class PublishModule {}
