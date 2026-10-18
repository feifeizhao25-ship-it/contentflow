import { Module } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { ApiKeyController } from './api-key.controller';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { ExternalContentController } from './external-content.controller';
import { ExternalApiGuard } from './external-api.guard';
import { ApiRequestInterceptor } from './api-request.interceptor';
import { AIModule } from '../ai/ai.module';
import { ContentPackService } from '../ai/content-pack.service';
import { SystemModule } from '../system/system.module';

@Module({
    imports: [AIModule, SystemModule],
    providers: [ApiKeyService, WebhookService, ExternalApiGuard, ApiRequestInterceptor],
    controllers: [ApiKeyController, WebhookController, ExternalContentController],
    exports: [ApiKeyService, WebhookService, ExternalApiGuard],
})
export class DeveloperModule { }
