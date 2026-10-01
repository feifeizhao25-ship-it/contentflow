import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const PHONE_MESSAGE = '请输入正确的 11 位中国大陆手机号';
const CODE_MESSAGE = '请输入 6 位数字验证码';
// 与 sms/phone.ts 的 normalizeChinaMobile 一致：允许 +86 / 86 前缀，空格、横线；真正的规范化在服务层
const PHONE_PATTERN = /^(\+?86)?[\s-]*1[3-9](?:[\s-]*\d){9}$/;

export class SendSmsCodeDto {
  @ApiProperty({ example: '13800138000' })
  @IsString({ message: PHONE_MESSAGE })
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  phone: string;

  @ApiProperty({ enum: ['register', 'login'] })
  @IsIn(['register', 'login'], { message: '验证码用途不正确' })
  purpose: 'register' | 'login';
}

export class BindPhoneSendDto {
  @ApiProperty({ example: '13800138000' })
  @IsString({ message: PHONE_MESSAGE })
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  phone: string;
}

export class BindPhoneDto extends BindPhoneSendDto {
  @ApiProperty({ example: '123456' })
  @IsString({ message: CODE_MESSAGE })
  @Matches(/^\d{6}$/, { message: CODE_MESSAGE })
  code: string;
}

export class LoginSmsDto extends BindPhoneDto {}

export class RegisterPhoneDto extends BindPhoneDto {
  @ApiPropertyOptional({ example: '张三' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: '我的工作室' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  tenantName?: string;

  @ApiProperty({ description: '已阅读并同意《用户协议》《隐私政策》' })
  // 隐式类型转换会把字符串 'false' 变成 true：取原始值，只认布尔 true
  @Transform(({ obj }) => obj.agreedToTerms)
  @IsBoolean({ message: '请先阅读并同意用户协议和隐私政策' })
  @Equals(true, { message: '请先阅读并同意用户协议和隐私政策' })
  agreedToTerms: boolean;
}
