import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Request, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { BindPhoneDto, BindPhoneSendDto, LoginSmsDto, RegisterPhoneDto, SendSmsCodeDto } from './dto/phone.dto';
import { maskPhone } from '../../common/pii';
import { publicEmail } from './phone-account';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { ttl: 60_000, limit: 10 } }) // 登录/注册：每个地址每分钟 10 次
  @ApiOperation({ summary: '用户注册' })
  @ApiResponse({ status: 201, description: '注册成功' })
  @ApiResponse({ status: 409, description: '邮箱已被注册' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 10 } }) // 登录/注册：每个地址每分钟 10 次
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({ status: 200, description: '登录成功' })
  @ApiResponse({ status: 401, description: '邮箱或密码错误' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // 短信接口每次都可能产生费用：每个地址每分钟 5 次；另有按手机号 / 地址的发送上限（见 SmsCodeService）
  @Post('sms/send')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '发送短信验证码（注册 / 登录）' })
  @ApiResponse({ status: 200, description: '已发送（登录用途下，未注册的手机号也返回成功但不发送）' })
  @ApiResponse({ status: 429, description: '获取太频繁' })
  @ApiResponse({ status: 503, description: '短信服务未配置' })
  async sendSmsCode(@Body() dto: SendSmsCodeDto, @Req() req: any) {
    return this.authService.sendPublicSmsCode(dto.phone, dto.purpose, req.ip);
  }

  @Post('register/phone')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: '手机号 + 短信验证码注册' })
  @ApiResponse({ status: 201, description: '注册成功' })
  @ApiResponse({ status: 409, description: '手机号已注册' })
  async registerWithPhone(@Body() dto: RegisterPhoneDto) {
    return this.authService.registerWithPhone(dto);
  }

  @Post('login/sms')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '手机号 + 短信验证码登录' })
  @ApiResponse({ status: 200, description: '登录成功' })
  async loginWithSms(@Body() dto: LoginSmsDto) {
    return this.authService.loginWithSms(dto.phone, dto.code);
  }

  @Post('phone/bind/send')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '绑定手机号：发送验证码' })
  async sendBindCode(@Body() dto: BindPhoneSendDto, @Request() req: any) {
    return this.authService.sendBindSmsCode(req.user.sub, dto.phone, req.ip);
  }

  @Post('phone/bind')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '绑定手机号：提交验证码' })
  async bindPhone(@Body() dto: BindPhoneDto, @Request() req: any) {
    return this.authService.bindPhone(req.user.sub, dto.phone, dto.code);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新Token' })
  @ApiResponse({ status: 200, description: '刷新成功' })
  @ApiResponse({ status: 401, description: '无效的刷新令牌' })
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getProfile(@Request() req: any) {
    const user = await this.authService.validateUser(req.user.sub);
    return {
      user: {
        id: user?.id,
        email: publicEmail(user?.email),
        phone: user?.phone ? maskPhone(user.phone) : undefined,
        phone_verified: !!user?.phone_verified,
        real_name_verified: !!user?.real_name_verified,
        name: user?.name,
        role: user?.role,
        avatar_url: user?.avatar_url,
        tenant: {
          id: user?.tenant?.id,
          name: user?.tenant?.name,
          plan: user?.tenant?.plan,
        },
      },
    };
  }
}
