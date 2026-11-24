import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

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

/** 批量删除：逐条校验，单条失败不影响其余条目。 */
export class BatchDeleteContentDto {
  @IsArray({ message: '请选择要删除的内容' })
  @ArrayMinSize(1, { message: '请选择要删除的内容' })
  @ArrayMaxSize(100, { message: '一次最多删除 100 条内容' })
  @IsString({ each: true, message: '内容编号不正确' })
  @MaxLength(80, { each: true, message: '内容编号不正确' })
  ids!: string[];
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

const CONTENT_ASSET_TYPE_VALUES = ['script', 'cover', 'image', 'video'] as const;

/**
 * 脚本素材里的正文。必须单独成类并标上 `@Type`：
 * 全局 ValidationPipe 开了 `transform` + `enableImplicitConversion`。
 * `assets` 若只标成 `unknown[]`，反射类型是 Array，管道会把每一项对象变成空数组，
 * 随后服务层判定格式不对并返回 400。嵌套字段标了装饰器之后，whitelist 才会留下它们。
 */
export class ContentAssetMetaDto {
  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  content?: string;
}

/**
 * 创作页保存的一条素材。只接受这些字段，多余字段由 forbidNonWhitelisted 拒绝。
 * 嵌套校验不要写中文提示：管道会把属性路径加在提示前面（assets.0.…），
 * 国内界面就会带上英文路径。不合规的类型和地址仍由服务层用中文说明。
 */
export class ContentAssetItemDto {
  @IsString()
  @IsIn(CONTENT_ASSET_TYPE_VALUES)
  type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContentAssetMetaDto)
  meta?: ContentAssetMetaDto;
}

/**
 * 创作页保存素材：`POST /contents/:id/assets`。
 * 项内的正文、地址、名称在这里过白名单，避免被 ValidationPipe 剥掉；
 * 地址是否为 http(s)、脚本是否有正文，仍由服务层按条说明。
 */
export class AppendContentAssetsDto {
  @IsArray({ message: '素材必须是列表' })
  @ArrayMaxSize(20, { message: '一次最多保存 20 个素材' })
  @ValidateNested({ each: true })
  @Type(() => ContentAssetItemDto)
  assets!: ContentAssetItemDto[];
}
