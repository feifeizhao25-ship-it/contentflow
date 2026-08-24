import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { AchievementService } from './achievement.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/achievements')
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) {}

  @Get()
  async getAchievements(@Query('category') category?: string) {
    const achievements = await this.achievementService.getAllAchievements(category);
    return { success: true, data: achievements };
  }

  @Get('user')
  async getUserAchievements(@Request() req: any) {
    const achievements = await this.achievementService.getUserAchievements(req.user.id);
    return { success: true, data: achievements };
  }

  @Get('stats')
  async getAchievementStats(@Request() req: any) {
    const stats = await this.achievementService.getAchievementStats(req.user.id);
    return { success: true, data: stats };
  }

  @Post('progress')
  async updateAchievementProgress(@Request() req: any, @Body() body: { conditionType: string; increment: number }) {
    await this.achievementService.updateAchievementProgress(req.user.id, body.conditionType, body.increment);
    return { success: true, message: '进度已更新' };
  }

  @Post('claim')
  async claimAchievementReward(@Request() req: any, @Body() body: { achievementId: string }) {
    const result = await this.achievementService.claimAchievementReward(req.user.id, body.achievementId);
    return { success: result.success, data: result };
  }
}
