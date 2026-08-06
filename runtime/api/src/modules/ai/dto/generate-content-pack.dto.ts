import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

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
}
