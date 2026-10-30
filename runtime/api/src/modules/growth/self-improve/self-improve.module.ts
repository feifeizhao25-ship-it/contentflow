import { Module } from '@nestjs/common';
import { SelfImproveService } from './self-improve.service';

/** 依赖 SystemModule 里的 ScheduleModule.forRoot()（全局），本模块只注册定时服务。 */
@Module({ providers: [SelfImproveService], exports: [SelfImproveService] })
export class SelfImproveModule {}
