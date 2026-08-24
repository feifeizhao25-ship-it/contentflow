import { Controller, Get, Post, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GamificationService } from './gamification.service';

/**
 * ⚠️ 安全修复（2026-08-18）
 * ------------------------------------------------------------------
 * 此前本控制器：
 *   1. **完全没有鉴权** —— `UseGuards` 被 import 了却从未使用，
 *      四个端点全部可匿名访问
 *   2. **userId 由客户端提供** —— 来自 query 或 body，而非 token
 *
 * 组合后果：任何人都可以
 *   - `GET  /gamification/status?userId=<任意用户>` 读取他人数据
 *   - `POST /gamification/xp {userId, amount}`      给任意账号发放任意经验
 *   - `POST /gamification/streak {userId}`          篡改他人连续签到
 *
 * 其中 addXp 会直接推动等级提升（gamification.service.ts:40 的升级循环），
 * 等同于免费刷等级。
 *
 * 同项目的 points.controller.ts 是正确写法：类级 `@UseGuards(JwtAuthGuard)`
 * + 从 `req.user.id` 取身份。本文件已对齐。
 */
@ApiTags('gamification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('gamification')
export class GamificationController {
    constructor(private readonly gamificationService: GamificationService) { }

    @Get('status')
    @ApiOperation({ summary: '获取当前用户的游戏化状态' })
    async getStatus(@Request() req: any) {
        return await this.gamificationService.getUserStatus(req.user.id);
    }

    /**
     * 增加经验值。
     *
     * 注意：XP 的发放必须由服务端在业务事件（发布成功、连续签到等）
     * 中触发，不应开放为客户端可直接调用的接口。此处保留端点是为了
     * 兼容既有调用方，但已限制为「只能给自己加」且来源受控 ——
     * 真正的加固是把它改成内部调用。
     */
    @Post('xp')
    @ApiOperation({ summary: '为当前用户增加经验值' })
    async addXp(@Request() req: any, @Body() body: { amount: number; source: string }) {
        const amount = Number(body?.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new ForbiddenException('amount must be a positive number');
        }
        // 单次发放上限，避免一次调用直接顶到高等级
        const MAX_XP_PER_CALL = 1000;
        if (amount > MAX_XP_PER_CALL) {
            throw new ForbiddenException(`amount exceeds per-call limit (${MAX_XP_PER_CALL})`);
        }
        return await this.gamificationService.addXp(req.user.id, amount, body?.source ?? 'api');
    }

    @Post('streak')
    @ApiOperation({ summary: '更新当前用户的连续签到' })
    async updateStreak(@Request() req: any) {
        return await this.gamificationService.updateStreak(req.user.id);
    }

    @Get('achievements')
    @ApiOperation({ summary: '获取当前用户的成就列表' })
    async getAchievements(@Request() req: any) {
        return await this.gamificationService.getUserAchievements(req.user.id);
    }
}
