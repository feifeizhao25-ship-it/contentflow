import { Body, Controller, Headers, HttpCode, Post, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { bearer, configuredToken, receiverEnabled, tokenMatches } from './template-page-receiver';
import { rejection, TemplatePageReceiverService } from './template-page-receiver.service';

/** 可替换的时钟，测试里改它来验证时间窗边界。 */
export const receiverClock = { now: (): Date => new Date() };

/**
 * POST /api/v1/growth/publish/template-page —— 运营中枢的 fenfaxia_template_pages 渠道。
 * 不走登录（JwtAuthGuard），只认专用令牌 OPENCLAW_FENFAXIA_API_TOKEN；登录令牌和其他密钥都不认。
 * 顺序：开关关 → 503 disabled；令牌没配 → 503；令牌不对 → 401。这三种不写审计（防止灌表）。之后交给服务做四项检查。
 */
@ApiTags('growth')
@Controller('growth/publish')
export class TemplatePageReceiverController {
  constructor(private readonly receiver: TemplatePageReceiverService) {}

  @Post('template-page')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async receive(@Headers('authorization') authorization: string | undefined, @Body() body: unknown, @Res() res: Response): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    let result;
    if (!receiverEnabled()) result = rejection('disabled');
    else {
      const expected = configuredToken();
      if (!expected) result = rejection('token_not_configured');
      else if (!tokenMatches(bearer(authorization), expected)) result = rejection('unauthorized');
      else result = await this.receiver.receive(body, receiverClock.now());
    }
    res.status(result.status).json(result.body);
  }
}
