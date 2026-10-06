import { Module } from '@nestjs/common';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { QueueModule } from '../../queue/queue.module';
import { SystemModule } from '../system/system.module';
import { ContentPackController } from './content-pack.controller';
import { ContentPackService } from './content-pack.service';
import { ComplianceService } from './compliance.service';
import { RagPolicyService } from './rag-policy.service';
import { AiAllowanceService } from './ai-allowance.service';

@Module({
  imports: [QueueModule, SystemModule],
  providers: [AIService, AiAllowanceService, ContentPackService, ComplianceService, RagPolicyService],
  controllers: [AIController, ContentPackController],
  exports: [AIService, AiAllowanceService, ContentPackService, RagPolicyService],
})
export class AIModule {}
