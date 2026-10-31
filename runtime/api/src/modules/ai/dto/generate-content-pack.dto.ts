import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsInt, Min, Max } from 'class-validator';

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
}
