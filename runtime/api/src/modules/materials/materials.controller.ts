import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MaterialsService } from './materials.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('materials')
@Controller('materials')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

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
}
