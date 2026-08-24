import type { ContentDomain, TargetPlatform } from '@/store/onboardingStore';

// 脚本模板类型
export interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
  structure: ScriptStructure;
 适用领域: ContentDomain[];
}

export interface ScriptStructure {
  开场: string[];
  正文: string[];
  结尾: string[];
}

// 脚本生成参数
export interface ScriptGenerationParams {
  topic: string;
  domain: ContentDomain;
  platform: TargetPlatform;
  style?: '专业' | '轻松' | '幽默' | '治愈';
  length?: '短' | '中' | '长';
}

// 脚本生成结果
export interface GeneratedScript {
  id: string;
  title: string;
  content: string;
  structure: {
    opening: string;
    body: string;
    closing: string;
  };
  viralScore: number;
  tips: string[];
  createdAt: Date;
}

// 领域对应的模板
const SCRIPT_TEMPLATES: Record<ContentDomain, ScriptTemplate[]> = {
  beauty: [
    {
      id: 'beauty_review',
      name: '产品测评',
      description: '美妆护肤产品真实测评',
      structure: {
        开场: ['产品外观展示', '购买渠道和价格', '适用肤质介绍'],
        正文: ['产品质地描述', '使用感受', '效果对比', '优缺点分析'],
        结尾: ['推荐指数', '适用人群', '购买建议'],
      },
      适用领域: ['beauty'],
    },
    {
      id: 'beauty_tutorial',
      name: '化妆教程',
      description: '新手友好的化妆步骤教程',
      structure: {
        开场: ['妆容风格介绍', '适用场景', '所需产品清单'],
        正文: ['底妆步骤', '眼妆画法', '唇妆搭配', '定妆技巧'],
        结尾: ['注意事项', '常见错误', '进阶技巧'],
      },
      适用领域: ['beauty'],
    },
  ],
  fashion: [
    {
      id: 'fashion_match',
      name: '穿搭分享',
      description: '一周穿搭不重样',
      structure: {
        开场: ['今日穿搭主题', '搭配亮点', '适用场景'],
        正文: ['上衣选择', '下装搭配', '配饰点缀', '鞋子配合'],
        结尾: ['穿搭技巧总结', '同款链接', '下期预告'],
      },
      适用领域: ['fashion'],
    },
  ],
  food: [
    {
      id: 'food_recipe',
      name: '食谱教程',
      description: '简单易学的美食制作',
      structure: {
        开场: ['菜品介绍', '难度预估', '所需时间'],
        正文: ['食材准备', '步骤详解', '火候控制', '调味技巧'],
        结尾: ['小贴士', '变体建议', '搭配推荐'],
      },
      适用领域: ['food'],
    },
  ],
  tech: [
    {
      id: 'tech_review',
      name: '产品测评',
      description: '数码产品深度测评',
      structure: {
        开场: ['产品背景', '配置介绍', '价格定位'],
        正文: ['外观设计', '性能测试', '使用体验', '竞品对比'],
        结尾: ['优缺点总结', '购买建议', '适用人群'],
      },
      适用领域: ['tech'],
    },
  ],
  gaming: [
    {
      id: 'gaming_guide',
      name: '游戏攻略',
      description: '上分技巧和游戏攻略',
      structure: {
        开场: ['版本介绍', '英雄/关卡概述', '适用水平'],
        正文: ['核心技巧', '装备推荐', '对线思路', '团战处理'],
        结尾: ['进阶练习', '常见错误', '上分建议'],
      },
      适用领域: ['gaming'],
    },
  ],
  movie: [
    {
      id: 'movie_review',
      name: '影视解说',
      description: '电影/剧集精彩解说',
      structure: {
        开场: ['作品简介', '导演/演员介绍', '看点预告'],
        正文: ['剧情概述', '精彩片段', '深层解析', '经典台词'],
        结尾: ['观后感', '推荐理由', '观看渠道'],
      },
      适用领域: ['movie'],
    },
  ],
  career: [
    {
      id: 'career_tips',
      name: '职场技巧',
      description: '职场生存和发展指南',
      structure: {
        开场: ['问题引入', '目标受众', '核心观点'],
        正文: ['技巧一', '技巧二', '技巧三', '案例分析'],
        结尾: ['行动建议', '注意事项', '延伸资源'],
      },
      适用领域: ['career'],
    },
  ],
  emotional: [
    {
      id: 'emotional_story',
      name: '情感故事',
      description: '引发共鸣的情感内容',
      structure: {
        开场: ['场景描述', '情感引入', '共情点'],
        正文: ['故事发展', '情感转折', '高潮片段', '深层思考'],
        结尾: ['感悟总结', '互动问题', '正能量升华'],
      },
      适用领域: ['emotional'],
    },
  ],
  knowledge: [
    {
      id: 'knowledge_share',
      name: '知识科普',
      description: '有趣又有料的科普内容',
      structure: {
        开场: ['有趣问题', '吸引点', '话题引入'],
        正文: ['概念解释', '案例说明', '数据支撑', '常见误区'],
        结尾: ['总结回顾', '延伸阅读', '互动问题'],
      },
      适用领域: ['knowledge'],
    },
  ],
  lifestyle: [
    {
      id: 'lifestyle_vlog',
      name: '生活分享',
      description: '日常生活vlog文案',
      structure: {
        开场: ['今日主题', '场景介绍', '心情预告'],
        正文: ['事件一', '事件二', '事件三', '亮点时刻'],
        结尾: ['今日感悟', '明日预告', '粉丝互动'],
      },
      适用领域: ['lifestyle'],
    },
  ],
  pets: [
    {
      id: 'pets_cute',
      name: '萌宠日常',
      description: '宠物可爱瞬间',
      structure: {
        开场: ['宠物介绍', '今日趣事', '期待点'],
        正文: ['搞笑片段', '可爱瞬间', '互动场景', '萌点总结'],
        结尾: ['宠物感悟', '养宠建议', '粉丝互动'],
      },
      适用领域: ['pets'],
    },
  ],
  travel: [
    {
      id: 'travel_guide',
      name: '旅行攻略',
      description: '实用旅行指南',
      structure: {
        开场: ['目的地介绍', '亮点预览', '最佳时间'],
        正文: ['行程安排', '美食推荐', '拍照点位', '避坑指南'],
        结尾: ['费用参考', '注意事项', '推荐理由'],
      },
      适用领域: ['travel'],
    },
  ],
};

// 平台适配规则
const PLATFORM_RULES: Record<TargetPlatform, { length: string; style: string; hashtagCount: number }> = {
  douyin: {
    length: '短',
    style: '节奏快、有爆点',
    hashtagCount: 3,
  },
  xiaohongshu: {
    length: '中',
    style: '真实、有干货',
    hashtagCount: 5,
  },
  bilibili: {
    length: '长',
    style: '深度、有内容',
    hashtagCount: 2,
  },
  kuaishou: {
    length: '短',
    style: '接地气、真实',
    hashtagCount: 4,
  },
  video号: {
    length: '中',
    style: '正式、有价值',
    hashtagCount: 3,
  },
};

// 生成脚本
export async function generateScript(params: ScriptGenerationParams): Promise<GeneratedScript> {
  const { topic, domain, platform, style = '专业', length = '中' } = params;
  
  // 获取模板
  const templates = SCRIPT_TEMPLATES[domain] || SCRIPT_TEMPLATES.lifestyle;
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  // 获取平台规则
  const platformRule = PLATFORM_RULES[platform];
  
  // 生成标题
  const title = generateTitle(topic, domain, template.name);
  
  // 生成正文内容
  const content = generateContent(topic, domain, template, platformRule, style, length);
  
  // 计算爆款分数
  const viralScore = calculateViralScore(title, content, platform);
  
  // 生成建议
  const tips = generateTips(domain, platform, template);

  return {
    id: `script_${Date.now()}`,
    title,
    content,
    structure: {
      opening: extractSection(content, '开场'),
      body: extractSection(content, '正文'),
      closing: extractSection(content, '结尾'),
    },
    viralScore,
    tips,
    createdAt: new Date(),
  };
}

// 生成批量脚本
export async function generateBatchScripts(
  topics: string[],
  domain: ContentDomain,
  platform: TargetPlatform
): Promise<GeneratedScript[]> {
  const scripts: GeneratedScript[] = [];
  
  for (const topic of topics) {
    const script = await generateScript({ topic, domain, platform });
    scripts.push(script);
  }
  
  return scripts;
}

// 获取热门话题
export function getTrendingTopics(domain: ContentDomain): string[] {
  const trendingTopics: Record<ContentDomain, string[]> = {
    beauty: [
      '2024流行妆容趋势',
      '平价替代好物',
      '新手化妆入门',
      '护肤成分党',
      '早C晚A实测',
    ],
    fashion: [
      'OOTD每日穿搭',
      '显瘦穿搭技巧',
      '小众设计师品牌',
      '职场穿搭指南',
      '季节过渡穿搭',
    ],
    food: [
      '懒人快手菜',
      '减脂餐食谱',
      '网红美食复刻',
      '一人食推荐',
      '家庭烘焙教程',
    ],
    tech: [
      '性价比手机推荐',
      'APP使用技巧',
      '数码好物清单',
      'AI工具实测',
      '装机配置推荐',
    ],
    gaming: [
      '王者荣耀上分',
      '原神攻略',
      'Switch游戏推荐',
      '电竞外设分享',
      '游戏折扣信息',
    ],
    movie: [
      '近期新片推荐',
      '经典电影解读',
      '追剧清单',
      '明星八卦合集',
      '影视解说素材',
    ],
    career: [
      '面试技巧总结',
      '职场沟通话术',
      '简历优化建议',
      '副业赚钱思路',
      '自我提升计划',
    ],
    emotional: [
      '治愈系文案',
      '情感共鸣故事',
      '正能量语录',
      '心理成长分享',
      '人生感悟随笔',
    ],
    knowledge: [
      '冷知识合集',
      '技能教程分享',
      '科普知识讲解',
      '干货整理汇总',
      '学习技巧分享',
    ],
    lifestyle: [
      '租房好物推荐',
      '独居生活技巧',
      '时间管理方法',
      '生活仪式感',
      '极简生活心得',
    ],
    pets: [
      '猫咪行为解读',
      '养宠必备清单',
      '宠物零食测评',
      '萌宠日常记录',
      '宠物健康护理',
    ],
    travel: [
      '小众景点推荐',
      '旅行省钱攻略',
      '出行必备清单',
      '酒店住宿测评',
      '旅行摄影技巧',
    ],
  };
  
  return trendingTopics[domain] || trendingTopics.lifestyle;
}

// 辅助函数
function generateTitle(topic: string, domain: ContentDomain, templateName: string): string {
  const titlePrefixes = [
    topic,
    `关于${topic}，你必须知道的事`,
    `${topic}的正确打开方式`,
    `为什么${topic}这么火？`,
    `${templateName}：${topic}`,
    `新手必看：${topic}全攻略`,
  ];
  
  return titlePrefixes[Math.floor(Math.random() * titlePrefixes.length)];
}

function generateContent(
  topic: string,
  domain: ContentDomain,
  template: ScriptTemplate,
  platformRule: { length: string; style: string; hashtagCount: number },
  style: string,
  length: string
): string {
  const lengthMultiplier = length === '短' ? 0.5 : length === '长' ? 1.5 : 1;
  
  let content = `【开场】\n`;
  content += template.structure.开场.map(line => `• ${line}：${topic}相关的引入内容`).join('\n');
  content += '\n\n【正文】\n';
  content += template.structure.正文.map(line => `• ${line}`).join('\n');
  content += `\n\n针对${topic}，我们可以从以下几个角度展开...\n`;
  content += `1. 核心亮点：${topic}的最大优势\n`;
  content += `2. 实用技巧：如何更好地运用${topic}\n`;
  content += `3. 注意事项：需要避免的常见错误\n`;
  content += '\n\n【结尾】\n';
  content += template.structure.结尾.map(line => `• ${line}`).join('\n');
  content += `\n\n以上就是关于${topic}的分享，希望对你有帮助！`;
  
  return content;
}

function calculateViralScore(title: string, content: string, platform: TargetPlatform): number {
  // 基础分数
  let score = 70;
  
  // 标题吸引力
  if (title.includes('为什么') || title.includes('你必须') || title.includes('全攻略')) {
    score += 10;
  }
  
  // 内容丰富度
  if (content.length > 200) score += 5;
  if (content.length > 500) score += 5;
  
  // 平台适配
  if (platform === 'douyin') score += 5; // 抖音偏好
  if (platform === 'xiaohongshu') score += 3; // 小红书偏好
  
  // 随机波动
  score += Math.floor(Math.random() * 10) - 5;
  
  return Math.min(99, Math.max(50, score));
}

function generateTips(domain: ContentDomain, platform: TargetPlatform, template: ScriptTemplate): string[] {
  return [
    `根据${platform}平台特性，建议控制时长在15-30秒`,
    '开头3秒要抓住观众注意力',
    '适当使用表情符号增加亲和力',
    '添加热门话题标签提升曝光',
    '保持内容真实、有价值',
    `${domain}领域的内容要注重专业性`,
  ];
}

function extractSection(content: string, section: string): string {
  const regex = new RegExp(`【${section}】([\\s\\S]*?)(?=【|$)`);
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

// 导出模板供其他组件使用
export function getTemplatesForDomain(domain: ContentDomain): ScriptTemplate[] {
  return SCRIPT_TEMPLATES[domain] || SCRIPT_TEMPLATES.lifestyle;
}
