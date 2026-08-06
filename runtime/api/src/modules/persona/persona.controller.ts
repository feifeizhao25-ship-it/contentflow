import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PersonaService } from './persona.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('persona')
@Controller('persona')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PersonaController {
    constructor(private readonly personaService: PersonaService) { }

    @Get()
    @ApiOperation({ summary: '获取所有人设模板（系统+个人）' })
    async findAll(@Request() req: any) {
        return this.personaService.findAll(req.user.tenantId);
    }

    @Get(':id')
    @ApiOperation({ summary: '获取人设详情' })
    async findOne(@Param('id') id: string, @Request() req: any) {
        return this.personaService.findOne(req.user.tenantId, id);
    }

    @Post()
    @ApiOperation({ summary: '创建自定义人设' })
    async create(@Request() req: any, @Body() body: any) {
        return this.personaService.create(req.user.tenantId, body);
    }

    @Put(':id')
    @ApiOperation({ summary: '更新人设' })
    async update(@Param('id') id: string, @Request() req: any, @Body() body: any) {
        return this.personaService.update(req.user.tenantId, id, body);
    }

    @Delete(':id')
    @ApiOperation({ summary: '删除自定义人设' })
    async remove(@Param('id') id: string, @Request() req: any) {
        return this.personaService.remove(req.user.tenantId, id);
    }
}
