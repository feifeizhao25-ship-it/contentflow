import { Module, forwardRef } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [forwardRef(() => TenantModule)],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
