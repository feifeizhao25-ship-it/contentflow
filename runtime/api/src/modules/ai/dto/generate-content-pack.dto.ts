import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsIn, IsInt, Max, MaxLength, Min } from 'class-validator';
import { ACCEPTED_TARGET_MARKETS } from '../../../common/target-market';
import { MATERIAL_MAX_CHARS } from '../grounding';

export class GenerateContentPackDto {
    @ApiProperty({ description: '创作主题或指令', example: '1000元极简桌搭推荐' })
    @IsString()
    @IsNotEmpty()
    topic: string;

    @ApiProperty({ description: '目标平台', example: ['小红书', '抖音'] })
    @IsArray()
    @IsOptional()
    platforms?: string[];

    @ApiProperty({ description: '人设ID', example: 'persona_knowledge_1' })
    @IsString()
    @IsOptional()
    personaId?: string;

    @ApiProperty({ required: false, enum: ACCEPTED_TARGET_MARKETS, description: 'International edition only: where the audience is (US, UK, IN, SG, or OTHER for any other country: general guidance only). Chooses the ad-disclosure wording hint.' })
    @IsOptional()
    // 大小写/空白不敏感：'uk'、' us ' 与 'UK'、'US' 等价（复测 B15：小写曾被 400 拒绝）。空串视为未选。
    @Transform(({ value }) => (typeof value === 'string' ? (value.trim().toUpperCase() || undefined) : value))
    @IsIn(ACCEPTED_TARGET_MARKETS as unknown as string[])
    targetMarket?: string;

    @ApiProperty({ required: false, description: '用户提供的品牌/产品资料；具体数据和品牌名只能来自这里（最多 4000 字）' })
    @IsOptional()
    @IsString()
    @MaxLength(MATERIAL_MAX_CHARS)
    material?: string;

    @ApiProperty({ description: '标题数量（可选，1-10，默认 10）。旧版 App 会发送这个字段，不能因为它被拒绝。', example: 5, required: false })
    @IsInt()
    @Min(1)
    @Max(10)
    @IsOptional()
    count?: number;
}
