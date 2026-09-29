import { Module, forwardRef } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AccountErasureService } from './account-erasure.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [forwardRef(() => TenantModule)],
  providers: [UserService, AccountErasureService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
