import { Module } from '@nestjs/common';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { ContentPackService } from './content-pack.service';
import { ContentPackController } from './content-pack.controller';
import { ComplianceService } from './compliance.service';
import { QueueModule } from '../../queue/queue.module';
import { PointsModule } from '../points/points.module';
import { PersonaModule } from '../persona/persona.module';

@Module({
  imports: [QueueModule, PointsModule, PersonaModule],
  providers: [AIService, ContentPackService, ComplianceService],
  controllers: [AIController, ContentPackController],
  exports: [AIService, ContentPackService, ComplianceService],
})
export class AIModule { }
