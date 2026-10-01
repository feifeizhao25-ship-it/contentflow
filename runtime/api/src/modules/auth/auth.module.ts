import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserModule } from '../user/user.module';
import { TenantModule } from '../tenant/tenant.module';
import { PrismaService } from '../../database/prisma.service';
import { createSmsGateway } from './sms/sms-gateway.factory';
import { PrismaSmsCodeStore, SMS_CODE_STORE, SmsCodeService } from './sms/sms-code.service';
import { SMS_GATEWAY } from './sms/sms.types';
import { NotConfiguredRealNameVerifier, REAL_NAME_VERIFIER } from './real-name/real-name.verifier';

@Module({
  imports: [
    UserModule,
    TenantModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN', '7d'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    // 实名认证（公安 / 运营商二要素）属外部资质，尚未接入：接入时在这里换成真实实现
    { provide: REAL_NAME_VERIFIER, useClass: NotConfiguredRealNameVerifier },
    // 短信服务按环境变量选择实现（SMS_PROVIDER=aliyun | dev），缺配置时发送会明确报「短信服务未配置」
    { provide: SMS_GATEWAY, useFactory: (config: ConfigService) => createSmsGateway(config), inject: [ConfigService] },
    { provide: SMS_CODE_STORE, useFactory: (prisma: PrismaService) => new PrismaSmsCodeStore(prisma), inject: [PrismaService] },
    {
      provide: SmsCodeService,
      useFactory: (store: PrismaSmsCodeStore, gateway: any, config: ConfigService) => new SmsCodeService(store, gateway, config),
      inject: [SMS_CODE_STORE, SMS_GATEWAY, ConfigService],
    },
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
