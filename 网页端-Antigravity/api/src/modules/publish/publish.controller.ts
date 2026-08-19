import { Controller, Post, Get, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PublishService } from './publish.service';
import { Request as ExpressRequest } from 'express';

@ApiTags('Publish')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/publish')
export class PublishController {
  constructor(private readonly publishService: PublishService) { }

  @Post('tasks')
  @ApiOperation({ summary: '创建发布任务 (Create Publish Task)' })
  async createTasks(@Request() req: ExpressRequest & { user: any }, @Body() body: {
    contentId: string;
    platform: string;
    accountId: string;
    publishType: 'immediate' | 'scheduled';
    scheduledAt?: string;
    idempotencyKey: string;
  }) {
    return this.publishService.createPublishTask(req.user.id, req.user.tenantId, {
      ...body,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
    });
  }

  @Get('tasks')
  @ApiOperation({ summary: '获取发布任务列表 (Get Publish Tasks)' })
  async getTasks(@Request() req: ExpressRequest & { user: any }) {
    return this.publishService.getTasks(req.user.tenantId);
  }
}
