import { Controller, Get, Post, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { PointsService } from './points.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('points')
@UseGuards(JwtAuthGuard)
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('balance')
  async getBalance(@Request() req: any) {
    return this.pointsService.getUserPoints(req.user.sub);
  }

  @Get('logs')
  async getLogs(@Request() req: any) {
    return this.pointsService.getPointsLogs(req.user.sub);
  }

  @Post('checkin')
  @HttpCode(HttpStatus.OK)
  async checkin(@Request() req: any) {
    return this.pointsService.checkIn(req.user.sub);
  }

  @Get('stats')
  async getStats(@Request() req: any) {
    return this.pointsService.getUserPointsStats(req.user.sub);
  }
}
