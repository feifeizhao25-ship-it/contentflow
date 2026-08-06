import { Controller, Post, Get, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PublishService } from './publish.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('publish')
@Controller('publish')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  @Post('tasks')
  @ApiOperation({ summary: '创建发布任务' })
  async createTask(@Request() req: any, @Body() body: any) {
    return this.publishService.createTask(req.user.tenantId, req.user.sub, body);
  }

  @Get('tasks')
  @ApiOperation({ summary: '获取发布任务列表' })
  async getTasks(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.publishService.getTasks(req.user.tenantId, { status, page, pageSize });
  }

  @Post('tasks/:id/retry')
  @ApiOperation({ summary: '重试失败的任务' })
  async retryTask(@Param('id') id: string, @Request() req: any) {
    return this.publishService.retryTask(id, req.user.tenantId);
  }

  @Post('tasks/:id/cancel')
  @ApiOperation({ summary: '取消任务' })
  async cancelTask(@Param('id') id: string, @Request() req: any) {
    return this.publishService.cancelTask(id, req.user.tenantId);
  }
}
