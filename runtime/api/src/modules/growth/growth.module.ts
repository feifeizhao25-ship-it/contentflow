import { Module } from '@nestjs/common';
import { GrowthService } from './growth.service';
import { GrowthController, GrowthPublicController } from './growth.controller';
import { GrowthTrafficService } from './growth-traffic.service';

@Module({
  providers: [GrowthService, GrowthTrafficService],
  controllers: [GrowthController, GrowthPublicController],
  exports: [GrowthService, GrowthTrafficService],
})
export class GrowthModule {}
