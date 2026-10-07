import { Equals, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * 「创建 / 更新内容」允许客户端给的字段。
 *
 * 原来控制器把请求体标成 any：运行时是 Object，ValidationPipe 的 whitelist 对它不起作用，
 * 整个请求体（更新时还是 `...data` 展开）原样交给 prisma。登录用户发
 * {"status":"approved"} 就能跳过审核，发 {"source":"manual"} 能抹掉 AI 生成来源，
 * 发 {"tenant_id":"别人的"} 能把内容挪到别的工作区。
 *
 * 状态只能由 submit / review 接口按流程推进；来源、模型、审核信息、版本号由服务端维护。
 */
export class CreateContentDto {
  @IsString({ message: '内容类型必须是文本' })
  @MaxLength(50)
  content_type!: string;

  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(500) summary?: string;
  @IsOptional() @IsString() @MaxLength(200_000) body?: string;
  @IsOptional() @IsString() @MaxLength(400_000) body_html?: string;
  @IsOptional() @IsString() @MaxLength(500) cover_url?: string;
  @IsOptional() @IsArray() media_urls?: unknown[];
  @IsOptional() @IsArray() tags?: unknown[];
  @IsOptional() @IsArray() keywords?: unknown[];
  @IsOptional() @IsString() @MaxLength(50) category?: string;

  /** 只有 'ai' 有意义（来自 AI 生成）；其它值一律按人工创作处理。创建后不可再改。 */
  @IsOptional() @IsString() @MaxLength(20) source?: string;
  @IsOptional() @IsString() @MaxLength(100) ai_model?: string;
  @IsOptional() ai_params?: Record<string, unknown>;
}

export class UpdateContentDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(500) summary?: string;
  @IsOptional() @IsString() @MaxLength(200_000) body?: string;
  @IsOptional() @IsString() @MaxLength(400_000) body_html?: string;
  @IsOptional() @IsString() @MaxLength(500) cover_url?: string;
  @IsOptional() @IsArray() media_urls?: unknown[];
  @IsOptional() @IsArray() tags?: unknown[];
  @IsOptional() @IsArray() keywords?: unknown[];
  @IsOptional() @IsString() @MaxLength(50) category?: string;
}

export class ReviewContentDto {
  @IsIn(['approve', 'reject'], { message: '审核动作只能是通过或驳回' })
  action!: 'approve' | 'reject';

  /** 驳回时必填（服务层校验），写给作者看的修改原因。 */
  @IsOptional() @IsString() @MaxLength(500, { message: '原因不能超过 500 字' }) comment?: string;
}

/** 所有者自行确认：confirm 必须是 true（界面二次确认），可附说明。 */
export class SelfConfirmContentDto {
  @IsBoolean({ message: '请先确认你已自行检查这条内容' })
  @Equals(true, { message: '请先确认你已自行检查这条内容' })
  confirm!: boolean;

  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
