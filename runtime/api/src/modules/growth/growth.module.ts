import { Module } from '@nestjs/common';
import { GrowthService } from './growth.service';
import { GrowthController, GrowthPublicController } from './growth.controller';
import { HomeModule } from '../home/home.module';
import { GrowthTrafficService } from './growth-traffic.service';
import { TemplatePageReceiverController } from './publish-receiver/template-page-receiver.controller';
import { TemplatePageReceiverService } from './publish-receiver/template-page-receiver.service';

@Module({
  imports: [HomeModule],
  providers: [GrowthService, GrowthTrafficService, TemplatePageReceiverService],
  controllers: [GrowthController, GrowthPublicController, TemplatePageReceiverController],
  exports: [GrowthService, GrowthTrafficService],
})
export class GrowthModule {}
