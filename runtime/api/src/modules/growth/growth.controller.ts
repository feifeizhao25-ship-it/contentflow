import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GrowthService } from './growth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('growth')
@Controller('growth')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GrowthController {
  constructor(private readonly growthService: GrowthService) {}

  @Get('plan')
  @ApiOperation({ summary: '获取增长计划' })
  async getPlan(@Request() req: any) {
    // GrowthGoal 上的字段是 user_id 不是 tenant_id
    return this.growthService.getGrowthPlan(req.user.id);
  }

  @Put('plan')
  @ApiOperation({ summary: '更新增长计划' })
  async updatePlan(@Request() req: any, @Body() body: any) {
    return this.growthService.updateGrowthPlan(req.user.id, body);
  }
}
