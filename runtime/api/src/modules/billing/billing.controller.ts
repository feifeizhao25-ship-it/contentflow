import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PLANS } from './plans.constant';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  // 公开端点:定价页与落地页直接消费,不要求登录
  @Get('plans')
  @ApiOperation({ summary: '获取订阅套餐列表(公开)' })
  getPlans() {
    return { plans: PLANS };
  }
}
