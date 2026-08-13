import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { marketMessage } from '../../../common/i18n/market-message';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: marketMessage('Enter a valid email address', '请输入有效的邮箱地址') })
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6, maxLength: 20 })
  @IsString()
  @MinLength(6, { message: marketMessage('Password must contain at least 6 characters', '密码至少6个字符') })
  @MaxLength(20, { message: marketMessage('Password must contain at most 20 characters', '密码最多20个字符') })
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
}
