import { Module } from '@nestjs/common';
import { CompetitorService } from './competitor.service';
import { CompetitorController } from './competitor.controller';

@Module({
  providers: [CompetitorService],
  controllers: [CompetitorController],
  exports: [CompetitorService],
})
export class CompetitorModule {}
