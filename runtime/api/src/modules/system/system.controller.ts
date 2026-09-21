import { Controller, Get, Inject, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../database/prisma.service';

type Check = 'up' | 'down' | 'skipped';

@ApiTags('system')
@SkipThrottle()
@Controller('health')
export class SystemController {
    constructor(
        @Optional() private readonly prisma?: PrismaService,
        @Optional() @Inject('REDIS_CLIENT') private readonly redis?: { ping?: () => Promise<string> },
    ) { }

    /** 存活：进程在就行。 */
    @Get()
    @ApiOperation({ summary: '健康检查' })
    healthCheck() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'fenfa-ai-api',
            version: '1.0.0',
        };
    }

    /**
     * 就绪：数据库与 Redis 都能用才算。容器健康检查打这里
     * （Dockerfile HEALTHCHECK 与 compose healthcheck 同一路径）。
     */
    @Get('ready')
    @ApiOperation({ summary: '就绪检查（数据库、Redis）' })
    async ready() {
        const checks: Record<string, Check> = { database: 'skipped', redis: 'skipped' };
        if (this.prisma) {
            try {
                await this.prisma.$queryRaw`SELECT 1`;
                checks.database = 'up';
            } catch {
                checks.database = 'down';
            }
        }
        if (this.redis && typeof this.redis.ping === 'function') {
            try {
                checks.redis = (await this.redis.ping()) === 'PONG' ? 'up' : 'down';
            } catch {
                checks.redis = 'down';
            }
        }
        const body = { status: 'ok', service: 'fenfa-ai-api', checks };
        if (Object.values(checks).includes('down')) {
            throw new ServiceUnavailableException({ ...body, status: 'degraded' });
        }
        return body;
    }
}
