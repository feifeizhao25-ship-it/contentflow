import { Module, Global } from '@nestjs/common';
import { UsageService } from './usage.service';
import { SystemController } from './system.controller';

@Global()
@Module({
    controllers: [SystemController],
    providers: [UsageService],
    exports: [UsageService],
})
export class SystemModule { }
