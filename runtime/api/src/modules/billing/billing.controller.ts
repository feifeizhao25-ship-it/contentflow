import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CN_PLANS, PLANS } from './plans.constant';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly config: ConfigService) {}

  // 公开端点:定价页与落地页直接消费,不要求登录
  @Get('plans')
  @ApiOperation({ summary: '获取订阅套餐列表(公开)' })
  getPlans() {
    return {
      market: this.config.get<string>('MARKET_REGION') === 'global' ? 'global' : 'cn',
      plans: this.config.get<string>('MARKET_REGION') === 'global' ? PLANS : CN_PLANS,
    };
  }
}
