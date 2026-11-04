import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { HomeService } from './home.service';

@ApiTags('home')
@Controller('home')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get('today')
  @ApiOperation({ summary: '首页「今天先做什么」：只用你自己账号的真实活动，国内版中文、国际版英文' })
  today(@Request() req: any) {
    return this.home.today(req.user);
  }
}
