import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsDate, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** POST /publish/manual-tasks：六个平台都是人工确认发布，不是自动发布。 */
export class CreateManualPublishDto {
  @IsString({ message: '请选择要发布的内容' })
  @MaxLength(64)
  contentId!: string;

  @IsArray({ message: '请至少选择一个平台' })
  @ArrayNotEmpty({ message: '请至少选择一个平台' })
  @ArrayMaxSize(6, { message: '一次最多选择 6 个平台' })
  @IsIn(['douyin', 'bilibili', 'xhs', 'weixin', 'wechat_mp', 'zhihu'], { each: true, message: '人工确认发布只支持抖音、B站、小红书、视频号、公众号、知乎' })
  platforms!: string[];

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: '计划发布时间格式不正确' })
  scheduledAt?: Date;

  /** 规则资料过期时，用户确认已自行核对“可能有风险”的提示。不能用来跳过明确违规。 */
  @IsOptional()
  @IsBoolean({ message: '请明确是否已自行核对风险提示' })
  riskAcknowledged?: boolean;
}

/** POST /publish/tasks/:id/manual-done：用户确认已在平台手动发出，可回填作品链接。 */
export class ConfirmManualPublishDto {
  @IsOptional()
  @IsString({ message: '作品链接格式不正确' })
  @MaxLength(500, { message: '作品链接太长' })
  postUrl?: string;
}
