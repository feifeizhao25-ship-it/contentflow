import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('system')
@Controller('health')
export class SystemController {
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
}
