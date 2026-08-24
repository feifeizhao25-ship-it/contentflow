import { Module, Global, OnModuleInit } from '@nestjs/common';
import { PublishService } from './publish.service';
import { PublishController } from './publish.controller';
import { AdapterRegistry } from './adapters/adapter.registry';
import { BilibiliAdapter } from './adapters/bilibili.adapter';
import { DouyinAdapter } from './adapters/douyin.adapter';
import { GamificationModule } from '../gamification/gamification.module';

@Global()
@Module({
  imports: [GamificationModule],
  controllers: [PublishController],
  providers: [
    PublishService,
    AdapterRegistry,
    BilibiliAdapter,
    DouyinAdapter,
  ],
  exports: [PublishService, AdapterRegistry],
})
export class PublishModule implements OnModuleInit {
  constructor(
    private registry: AdapterRegistry,
    private bilibili: BilibiliAdapter,
    private douyin: DouyinAdapter,
  ) { }

  onModuleInit() {
    // 注册所有适配器
    this.registry.register(this.bilibili);
    this.registry.register(this.douyin);
  }
}
