import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString, MaxLength } from 'class-validator';

/** POST /publish/tasks/retry：批量重试失败任务。 */
export class RetryPublishTasksDto {
  @IsArray({ message: '请选择要重试的任务' })
  @ArrayNotEmpty({ message: '请选择要重试的任务' })
  @ArrayMaxSize(50, { message: '一次最多重试 50 条任务' })
  @IsString({ each: true, message: '任务编号格式不正确' })
  @MaxLength(64, { each: true, message: '任务编号格式不正确' })
  taskIds!: string[];
}
