import { Module } from '@nestjs/common';
import { PublishService } from './publish.service';
import { PublishController } from './publish.controller';
import { QueueModule } from '../../queue/queue.module';
import { TenantModule } from '../tenant/tenant.module';
import { AdapterRegistry } from './adapters/adapter.registry';
import { BilibiliAdapter } from './adapters/bilibili.adapter';
import { DouyinAdapter } from './adapters/douyin.adapter';
import { PublishProcessor } from './publish.processor';

const registryProvider = {
  provide: AdapterRegistry,
  inject: [BilibiliAdapter, DouyinAdapter],
  useFactory: (bilibili: BilibiliAdapter, douyin: DouyinAdapter) => {
    const registry = new AdapterRegistry();
    registry.register(bilibili);
    registry.register(douyin);
    return registry;
  },
};

@Module({
  imports: [QueueModule, TenantModule],
  providers: [PublishService, PublishProcessor, BilibiliAdapter, DouyinAdapter, registryProvider],
  controllers: [PublishController],
  exports: [PublishService],
})
export class PublishModule {}
