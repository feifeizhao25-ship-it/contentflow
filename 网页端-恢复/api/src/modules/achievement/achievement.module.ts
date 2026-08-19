import { Module } from '@nestjs/common';
import { AchievementController } from './achievement.controller';
import { AchievementService } from './achievement.service';
import { DatabaseModule } from '@/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AchievementController],
  providers: [AchievementService],
  exports: [AchievementService],
})
export class AchievementModule {}
