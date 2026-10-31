import { AGE_CONFIRMATION_MESSAGE } from './age-confirmation';
import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6, maxLength: 20 })
  @IsString()
  @MinLength(6, { message: '密码至少6个字符' })
  @MaxLength(20, { message: '密码最多20个字符' })
  password: string;

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

  @ApiProperty({ description: '已确认年满 16 周岁（必须为 true）' })
  // 同上：取原始值，只认布尔 true
  @Transform(({ obj }) => obj.confirmedAge16)
  @IsBoolean({ message: AGE_CONFIRMATION_MESSAGE })
  @Equals(true, { message: AGE_CONFIRMATION_MESSAGE })
  confirmedAge16: boolean;
}
