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

  @Post('progress')
  async updateQuestProgress(@Request() req: any, @Body() body: { questId: string; increment: number }) {
    await this.questService.updateQuestProgress(req.user.id, body.questId, body.increment);
    return { success: true, message: '进度已更新' };
  }

  @Post('claim')
  async claimQuestReward(@Request() req: any, @Body() body: { questId: string }) {
    const result = await this.questService.claimQuestReward(req.user.id, body.questId);
    return { success: result.success, data: result };
  }
}
