import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { UsageService } from './usage.service';
import { AiQuotaReconcileService } from './ai-quota-reconcile.service';
import { SystemController } from './system.controller';

@Global()
@Module({
    imports: [ScheduleModule.forRoot()],
    controllers: [SystemController],
    providers: [UsageService, AiQuotaReconcileService],
    exports: [UsageService],
})
export class SystemModule { }
