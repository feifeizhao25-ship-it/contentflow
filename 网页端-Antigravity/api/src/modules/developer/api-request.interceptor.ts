import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ApiRequestInterceptor implements NestInterceptor {
    private readonly logger = new Logger(ApiRequestInterceptor.name);

    constructor(private readonly prisma: PrismaService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const startTime = Date.now();
        const { method, url, tenantId, apiKeyId } = request;

        // 只记录通过 API Key 发起的请求
        if (!apiKeyId) {
            return next.handle();
        }

        return next.handle().pipe(
            tap({
                next: (data) => {
                    const duration = Date.now() - startTime;
                    this.logRequest(tenantId, apiKeyId, method, url, 200, duration);
                },
                error: (err) => {
                    const duration = Date.now() - startTime;
                    this.logRequest(tenantId, apiKeyId, method, url, err.status || 500, duration, err.message);
                },
            }),
        );
    }

    private async logRequest(
        tenantId: string,
        apiKeyId: string,
        method: string,
        url: string,
        statusCode: number,
        duration: number,
        error?: string,
    ) {
        try {
            await (this.prisma as any).api_request_logs.create({
                data: {
                    tenant_id: tenantId,
                    api_key_id: apiKeyId,
                    method,
                    endpoint: url,
                    status_code: statusCode,
                    latency_ms: duration,
                    error_message: error || null,
                    request_payload: null, // 为了性能和隐私，暂时不记录 payload
                },
            });
        } catch (e) {
            this.logger.error('Failed to log API request:', e);
        }
    }
}
