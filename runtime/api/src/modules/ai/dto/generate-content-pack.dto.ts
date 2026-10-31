import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsIn, IsInt, Max, MaxLength, Min } from 'class-validator';
import { TARGET_MARKETS } from '../../../common/target-market';
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

    @ApiProperty({ description: '标题数量（可选，1-10，默认 10）。旧版 App 会发送这个字段，不能因为它被拒绝。', example: 5, required: false })
    @IsInt()
    @Min(1)
    @Max(10)
    @IsOptional()
    count?: number;

    @ApiProperty({ required: false, enum: TARGET_MARKETS, description: 'International edition only: where the audience is (US, UK, IN, SG). Chooses the ad-disclosure wording hint.' })
    @IsOptional()
    @IsIn(TARGET_MARKETS as unknown as string[])
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
