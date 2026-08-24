import { Controller, Get, Post, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { GamificationService } from './gamification.service';

@Controller('gamification')
export class GamificationController {
    constructor(private readonly gamificationService: GamificationService) { }

    @Get('status')
    async getStatus(@Query('userId') userId: string) {
        if (!userId) return { error: 'userId is required' };
        return await this.gamificationService.getUserStatus(userId);
    }

    @Post('xp')
    async addXp(@Body() body: { userId: string; amount: number; source: string }) {
        return await this.gamificationService.addXp(body.userId, body.amount, body.source);
    }

    @Post('streak')
    async updateStreak(@Body() body: { userId: string }) {
        return await this.gamificationService.updateStreak(body.userId);
    }

    @Get('achievements')
    async getAchievements(@Query('userId') userId: string) {
        if (!userId) return { error: 'userId is required' };
        return await this.gamificationService.getUserAchievements(userId);
    }
}
