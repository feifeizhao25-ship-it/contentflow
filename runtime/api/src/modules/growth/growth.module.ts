import { Module } from '@nestjs/common';
import { GrowthService } from './growth.service';
import { GrowthController, GrowthPublicController } from './growth.controller';
import { HomeModule } from '../home/home.module';
import { GrowthTrafficService } from './growth-traffic.service';

@Module({
  imports: [HomeModule],
  providers: [GrowthService, GrowthTrafficService],
  controllers: [GrowthController, GrowthPublicController],
  exports: [GrowthService, GrowthTrafficService],
})
export class GrowthModule {}
