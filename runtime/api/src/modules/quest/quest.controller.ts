import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { QuestService } from './quest.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/quests')
export class QuestController {
  constructor(private readonly questService: QuestService) {}

  @Get()
  async getQuests(@Request() req: any) {
    const quests = await this.questService.getAvailableQuests(req.user.id);
    return { success: true, data: quests };
  }

  @Get('progress')
  async getQuestProgress(@Request() req: any) {
    const progress = await this.questService.getUserQuestProgress(req.user.id);
    return { success: true, data: progress };
  }

  @Get('daily')
  async getDailyQuests(@Request() req: any) {
    const dailyQuests = await this.questService.getDailyQuests(req.user.id);
    return { success: true, data: dailyQuests };
  }

  // 不提供 POST /progress：任务进度由服务端在真实业务事件里推进（QuestService.updateQuestProgress），
  // 不能让客户端自报 increment —— 进度刷满 → 领积分 → 兑换 VIP，等于免费领会员。

  @Post('claim')
  async claimQuestReward(@Request() req: any, @Body() body: { questId: string }) {
    const result = await this.questService.claimQuestReward(req.user.id, body.questId);
    return { success: result.success, data: result };
  }
}
