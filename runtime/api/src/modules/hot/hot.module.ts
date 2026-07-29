import { Module } from '@nestjs/common';
import { HotService } from './hot.service';
import { HotController } from './hot.controller';

@Module({
  providers: [HotService],
  controllers: [HotController],
  exports: [HotService],
})
export class HotModule {}
