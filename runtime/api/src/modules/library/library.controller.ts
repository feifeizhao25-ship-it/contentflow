import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Put, Request, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { DomesticOnlyGuard } from './domestic-only.guard';
import { LibraryService } from './library.service';

class PrefsBody {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) follow?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) unfollow?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) mute?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) unmute?: string[];
}

const ids = (v: unknown): string[] | undefined => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 20) : undefined);

@ApiTags('library')
@Controller('library')
@UseGuards(DomesticOnlyGuard, JwtAuthGuard)
@ApiBearerAuth()
export class LibraryController {
  constructor(private readonly service: LibraryService) {}

  @Get('entries')
  @ApiOperation({ summary: '规则库条目（已审核、来源未异常的；带展示结论，登录用户另带「相对上次来访」标记）' })
  entries(@Request() req: any) {
    return this.service.entriesFor(req.user.id);
  }

  @Get('entries/:id')
  @ApiOperation({ summary: '单条规则；已废止的只显示废止提示' })
  entry(@Param('id') id: string) {
    const e = this.service.entry(id);
    if (!e) throw new NotFoundException('规则不存在或尚未上线');
    return e;
  }

  @Get('feed')
  @ApiOperation({ summary: '为你推荐（按绑定的平台、账号定位、关注的主题、规则更新）' })
  feed(@Request() req: any) {
    return this.service.feed(req.user.id);
  }

  @Get('home-card')
  @ApiOperation({ summary: '工作台首页卡片：只在有新增/更新或匹配度很高时才有' })
  async homeCard(@Request() req: any) {
    return { card: await this.service.homeCard(req.user.id) };
  }

  @Get('preferences')
  preferences(@Request() req: any) {
    return this.service.preferences(req.user.id);
  }

  @Put('preferences')
  @ApiOperation({ summary: '总开关、关注/取消关注/不再推荐某个主题' })
  async setPreferences(@Request() req: any, @Body() body: PrefsBody) {
    try {
      return await this.service.setPreferences(req.user.id, {
        enabled: typeof body?.enabled === 'boolean' ? body.enabled : undefined,
        follow: ids(body?.follow),
        unfollow: ids(body?.unfollow),
        mute: ids(body?.mute),
        unmute: ids(body?.unmute),
      });
    } catch (e) {
      if (e instanceof RangeError) throw new UnprocessableEntityException('未知的主题');
      throw e;
    }
  }

  @Post('visit')
  @HttpCode(200)
  async visit(@Request() req: any) {
    await this.service.visit(req.user.id);
    return { ok: true };
  }

  @Post('opened/:id')
  @HttpCode(200)
  async opened(@Request() req: any, @Param('id') id: string) {
    if (!this.service.entry(id)) throw new NotFoundException('规则不存在或尚未上线');
    await this.service.opened(req.user.id, id);
    return { ok: true };
  }
}
