import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HotService } from './hot.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('hot')
@Controller('hot')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HotController {
  constructor(private readonly hotService: HotService) {}

  @Get('list')
  @ApiOperation({ summary: '获取热点榜单' })
  async getList(@Query('platform') platform: string, @Query('category') category?: string) {
    return this.hotService.getHotList(platform || 'xhs', category);
  }
}
