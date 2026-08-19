import { Module } from '@nestjs/common';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { QueueModule } from '../../queue/queue.module';

@Module({
  imports: [QueueModule],
  providers: [AIService],
  controllers: [AIController],
  exports: [AIService],
})
export class AIModule {}
