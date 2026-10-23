import { Controller, Post, Get, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WebhookService } from './webhook.service';

@ApiTags('developer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('developer/webhooks')
export class WebhookController {
  constructor(private readonly svc: WebhookService) {}
  @Post() @ApiOperation({ summary: '创建 Webhook 订阅（签名密钥只返回一次）' })
  create(@Request() req: any, @Body() body: any) { return this.svc.create(req.user.tenantId, body); }
  @Get() @ApiOperation({ summary: 'Webhook 订阅列表' })
  list(@Request() req: any) { return this.svc.list(req.user.tenantId); }
  @Delete(':id') @ApiOperation({ summary: '删除 Webhook 订阅' })
  remove(@Request() req: any, @Param('id') id: string) { return this.svc.remove(req.user.tenantId, id); }
}
