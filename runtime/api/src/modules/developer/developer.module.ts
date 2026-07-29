import { Module } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { ApiKeyController } from './api-key.controller';
import { ExternalContentController } from './external-content.controller';
import { ExternalApiGuard } from './external-api.guard';
import { ApiRequestInterceptor } from './api-request.interceptor';
import { AIModule } from '../ai/ai.module';
import { ContentPackService } from '../ai/content-pack.service';
import { SystemModule } from '../system/system.module';

@Module({
    imports: [AIModule, SystemModule],
    providers: [ApiKeyService, ExternalApiGuard, ApiRequestInterceptor],
    controllers: [ApiKeyController, ExternalContentController],
    exports: [ApiKeyService, ExternalApiGuard],
})
export class DeveloperModule { }
