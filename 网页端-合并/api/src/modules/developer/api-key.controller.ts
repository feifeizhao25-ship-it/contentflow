import { Controller, Post, Body, UseGuards, Request, Get, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiKeyService } from './api-key.service';

@ApiTags('developer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('developer/keys')
export class ApiKeyController {
    constructor(private readonly apiKeyService: ApiKeyService) { }

    @Post()
    @ApiOperation({ summary: '创建新的 API Key (明文密钥仅显示一次)' })
    async create(@Request() req: any, @Body() body: { name: string }) {
        return this.apiKeyService.createKey(req.user.tenantId, body.name);
    }

    @Get()
    @ApiOperation({ summary: '列出所有 API Keys' })
    async list(@Request() req: any) {
        return this.apiKeyService.listKeys(req.user.tenantId);
    }
}
