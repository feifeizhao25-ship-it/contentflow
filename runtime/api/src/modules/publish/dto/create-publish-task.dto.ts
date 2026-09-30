import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsDate, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** POST /publish/tasks 的请求体。原来是 any：什么都能传，且没有账号数量上限。 */
export class CreatePublishTaskDto {
  @IsString({ message: '请选择要发布的内容' })
  @MaxLength(64)
  contentId!: string;

  @IsArray({ message: '请至少选择一个平台账号' })
  @ArrayNotEmpty({ message: '请至少选择一个平台账号' })
  @ArrayMaxSize(20, { message: '一次最多选择 20 个平台账号' })
  @IsString({ each: true })
  platformAccountIds!: string[];

  @IsIn(['immediate', 'scheduled'], { message: '发布类型无效' })
  publishType!: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: '定时发布时间格式不正确' })
  scheduledAt?: Date;
}
