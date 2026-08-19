import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ComplianceService {
    private readonly logger = new Logger(ComplianceService.name);

    // 基础敏感词库 (Sprint 1 示例)
    private readonly blacklistedWords = [
        '暴利', '发大财', '绝对', '第一', '最', '博彩', '赌博',
        '代发', '刷单', '兼职', '赚钱项目'
    ];

    async checkContent(content: string): Promise<{ safe: boolean; triggers: string[]; suggestion: string }> {
        const triggers = this.blacklistedWords.filter(word => content.includes(word));

        if (triggers.length > 0) {
            return {
                safe: false,
                triggers,
                suggestion: `内容包含敏感词或夸大用语: ${triggers.join(', ')}。请修改为更稳健的表达。`,
            };
        }

        return {
            safe: true,
            triggers: [],
            suggestion: '',
        };
    }

    // 模拟对 AI 输出的二次合规过滤
    async scrubOutput(content: string): Promise<string> {
        let scrubbed = content;
        this.blacklistedWords.forEach(word => {
            const reg = new RegExp(word, 'g');
            scrubbed = scrubbed.replace(reg, '***');
        });
        return scrubbed;
    }
}
