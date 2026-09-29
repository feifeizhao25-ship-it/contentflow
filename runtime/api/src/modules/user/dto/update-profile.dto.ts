import { IsIn, IsObject, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

/**
 * 「更新我的资料」允许改的字段——只有这三个。
 *
 * 原来控制器把请求体当成 `{ name?, avatar_url?, preferences? }` 的行内类型，
 * 运行时它就是 Object：Nest 的 ValidationPipe 对 Object 不做校验，
 * `whitelist / forbidNonWhitelisted` 形同虚设，整个请求体原样交给 `prisma.user.update`。
 * 登录用户发 `{"role":"owner","tenant_id":"<别人的工作区>","status":"active"}`
 * 就能把自己改成别人工作区的所有者。
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true }, { message: '头像地址必须是 https 链接' })
  @MaxLength(500)
  avatar_url?: string;

  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;
}

export class DeleteAccountDto {
  /** 必须明确传 true：防止误调用 */
  @IsIn([true], { message: '请先确认已了解注销后果' })
  confirm!: true;

  /** 有密码的账号必须再输一次密码 */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;
}
