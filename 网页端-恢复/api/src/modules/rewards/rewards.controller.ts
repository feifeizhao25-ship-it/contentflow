import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get()
  async getRewards(@Query('category') category?: string) {
    const rewards = await this.rewardsService.getAvailableRewards(category);
    return { success: true, data: rewards };
  }

  @Get(':id')
  async getReward(@Param('id') id: string) {
    const reward = await this.rewardsService.getRewardById(id);
    return { success: true, data: reward };
  }

  @Post('redeem')
  async redeemReward(@Request() req: any, @Body() body: { rewardId: string }) {
    const result = await this.rewardsService.redeemReward(req.user.id, body.rewardId);
    return { success: result.success, data: result };
  }

  @Get('user/redemptions')
  async getUserRedemptions(@Request() req: any, @Query('page') page?: number, @Query('limit') limit?: number) {
    const result = await this.rewardsService.getUserRedemptions(req.user.id, page || 1, limit || 20);
    return { success: true, data: result };
  }

  @Post('use-code')
  async useRedeemCode(@Request() req: any, @Body() body: { redeemCode: string }) {
    const result = await this.rewardsService.useRedeemCode(req.user.id, body.redeemCode);
    return { success: result.success, data: result };
  }
}
