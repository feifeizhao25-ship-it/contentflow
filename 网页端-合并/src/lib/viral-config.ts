/**
 * 2026 各大平台爆款底层逻辑与模版配置
 * 基于最新潮趋势（包含小红书、抖音、视频号、知乎等）
 */

export interface PlatformStrategy {
    name: string;
    viralLogic: string;
    titleTemplates: string[];
    contentStructure: string;
    hooks: string[];
}

export const PLATFORM_STRATEGIES: Record<string, PlatformStrategy> = {
    xhs: {
        name: '小红书',
        viralLogic: '65% 流量来自搜索。强调“情绪共鸣”与“真实体验”。转发和评论权重是点赞的4倍。CES模型：前3秒强钩子，中段引导收藏。',
        titleTemplates: [
            '后悔没早点知道的 [关键词]...',
            '[关键词] 竟然还能这么玩？',
            '答应我！[关键词] 一定要看这篇！',
            '熬夜整理！[关键词] 全攻略',
            '说实话...[关键词] 真的惊艳到我了'
        ],
        contentStructure: '【痛点引入】+【超干货分享】+【情绪价值/个人感悟】+【呼吁行动(CTA)】',
        hooks: ['别再盲目做了...', '如果你也...', '建议收藏，防止找不到']
    },
    douyin: {
        name: '抖音',
        viralLogic: '7天爆款周期。第一人称叙事，真人出镜感。强调“快节奏”和“强反转”。前2秒决定完播率。',
        titleTemplates: [
            '谁懂啊！这种 [关键词] 太绝了',
            '假如 [关键词] 有段段，那是...',
            '建议反复观看！[关键词] 的真相',
            '这大概就是 [关键词] 的天花板吧'
        ],
        contentStructure: '【黄金3秒反转开头】+【快节奏信息点】+【神反转/神总结】',
        hooks: ['你敢相信吗？', '一定要看到最后...', '这是我见过最...']
    },
    channels: {
        name: '视频号',
        viralLogic: '半公域半私域机制。强调“真实生活方式”与“正能量/价值观”。中老年群体偏好，注重情感沉淀。',
        titleTemplates: [
            '这就是生活：[关键词]',
            '深度好文：[关键词] 给我们的启示',
            '看完这个 [关键词]，我沉默了',
            '[关键词]：藏在平凡里的智慧'
        ],
        contentStructure: '【场景引入】+【温情/深度解析】+【升华价值观】',
        hooks: ['余生很贵，请自重...', '如果你正处于...', '转给关心的人']
    },
    zhihu: {
        name: '知乎',
        viralLogic: '专业性、逻辑性、长尾搜索。强调“谢邀”、“利益相关”。数据驱动和案例支撑。',
        titleTemplates: [
            '如何评价 [关键词]？',
            '在 [关键词] 是一种什么样的体验？',
            '[关键词] 到底是不是智商税？',
            '有哪些关于 [关键词] 的硬核干货？'
        ],
        contentStructure: '【论点/结论先行】+【多维度深度拆解】+【数据/案例支撑】+【总结建议】',
        hooks: ['谢邀，利益相关...', '很多人误解了...', '废话不多说，直接上结论']
    }
};

export function getPlatformStrategy(platform: string): PlatformStrategy {
    return PLATFORM_STRATEGIES[platform] || PLATFORM_STRATEGIES.xhs;
}
