import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';

/** 规则库是国内版（中文）专属；国际版部署下这些接口不存在。 */
@Injectable()
export class DomesticOnlyGuard implements CanActivate {
  canActivate(): boolean {
    if (process.env.MARKET_REGION === 'global') throw new NotFoundException();
    return true;
  }
}
