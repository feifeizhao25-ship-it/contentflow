import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MaterialsService } from './materials.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('materials')
@Controller('materials')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) { }

  @Get()
  @ApiOperation({ summary: '获取素材列表' })
  async getList(@Request() req: any, @Query('type') type?: string) {
    return this.materialsService.getList(req.user.tenantId, type);
  }

  @Post('upload')
  @ApiOperation({ summary: '上传素材' })
  async upload(@Request() req: any, @Body() body: any) {
    return this.materialsService.upload(req.user.tenantId, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新素材信息' })
  async update(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.materialsService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除素材' })
  async delete(@Param('id') id: string, @Request() req: any) {
    return this.materialsService.delete(req.user.tenantId, id);
  }
}
