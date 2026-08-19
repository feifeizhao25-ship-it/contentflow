import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';

// PrismaService 由 @Global 的 DatabaseModule 提供，无需在此显式 imports
@Module({
  controllers: [BillingController],
})
export class BillingModule {}
