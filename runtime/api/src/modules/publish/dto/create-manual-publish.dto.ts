import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsDate, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** POST /publish/manual-tasks：为小红书 / 视频号 / 公众号创建「人工确认发布」任务。 */
export class CreateManualPublishDto {
  @IsString({ message: '请选择要发布的内容' })
  @MaxLength(64)
  contentId!: string;

  @IsArray({ message: '请至少选择一个平台' })
  @ArrayNotEmpty({ message: '请至少选择一个平台' })
  @ArrayMaxSize(3, { message: '一次最多选择 3 个平台' })
  @IsIn(['xhs', 'weixin', 'wechat_mp'], { each: true, message: '人工确认发布只支持小红书、视频号、公众号' })
  platforms!: string[];

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: '计划发布时间格式不正确' })
  scheduledAt?: Date;
}

/** POST /publish/tasks/:id/manual-done：用户确认已在平台手动发出，可回填作品链接。 */
export class ConfirmManualPublishDto {
  @IsOptional()
  @IsString({ message: '作品链接格式不正确' })
  @MaxLength(500, { message: '作品链接太长' })
  postUrl?: string;
}
