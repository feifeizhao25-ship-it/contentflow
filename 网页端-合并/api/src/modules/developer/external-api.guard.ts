import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';

@Injectable()
export class ExternalApiGuard implements CanActivate {
    constructor(private readonly apiKeyService: ApiKeyService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const apiKey = request.headers['x-api-key'] || request.headers['authorization']?.replace('Bearer ', '');

        if (!apiKey) {
            throw new UnauthorizedException('缺少 API Key');
        }

        try {
            const keyRecord = await this.apiKeyService.validateKey(apiKey);

            // 将租户信息挂载到请求对象，供后续 Controller 使用
            request.tenantId = keyRecord.tenant_id;
            request.apiKeyId = keyRecord.id;
            request.scopes = keyRecord.scopes;

            return true;
        } catch (error) {
            throw new UnauthorizedException(error.message);
        }
    }
}
