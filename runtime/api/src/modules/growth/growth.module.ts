import { Module } from '@nestjs/common';
import { GrowthService } from './growth.service';
import { GrowthController, GrowthPublicController } from './growth.controller';
import { HomeModule } from '../home/home.module';
import { GrowthTrafficService } from './growth-traffic.service';
import { TemplatePageReceiverController } from './publish-receiver/template-page-receiver.controller';
import { TemplatePageReceiverService } from './publish-receiver/template-page-receiver.service';
import { SiteFunnelController } from './site-funnel/site-funnel.controller';
import { SiteFunnelService } from './site-funnel/weekly-funnel';

@Module({
  imports: [HomeModule],
  providers: [GrowthService, GrowthTrafficService, TemplatePageReceiverService, SiteFunnelService],
  controllers: [GrowthController, GrowthPublicController, TemplatePageReceiverController, SiteFunnelController],
  exports: [GrowthService, GrowthTrafficService],
})
export class GrowthModule {}
