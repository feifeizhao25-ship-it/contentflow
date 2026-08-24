'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Button, Input, Select, message, Tabs, Modal, Upload, Drawer,
    Checkbox, Slider, Space, Dropdown, Empty, Tooltip, Badge, Progress
} from 'antd';
import {
    ThunderboltFilled, PictureOutlined, CalendarOutlined,
    CopyOutlined, DownloadOutlined, SaveOutlined, SettingOutlined,
    PlusOutlined, DeleteOutlined, EditOutlined, DragOutlined,
    FileTextOutlined, AppstoreOutlined, HistoryOutlined,
    StarOutlined, BgColorsOutlined, TagsOutlined, FileImageOutlined,
    ScissorOutlined, CheckCircleOutlined, LoadingOutlined,
    CloseOutlined, EyeOutlined, RocketOutlined, RobotOutlined,
    ClockCircleOutlined, LinkOutlined, FolderOutlined,
    UploadOutlined, VideoCameraOutlined, CrownFilled, ThunderboltOutlined
} from '@ant-design/icons';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import clsx from 'clsx';
import { TiptapEditor } from '@/components/editor/TiptapEditor';
import { PhonePreview } from '@/components/preview/PhonePreview';
import dayjs from 'dayjs';
import { supabase } from '@/lib/supabase';
import { aiService } from '@/lib/ai-service';
import { imageService } from '@/lib/image-service';
import { createContent, Content } from '@/lib/content-service';
import { usePermissions } from '@/hooks/usePermissions';
import { UpgradeModal, QuotaDisplay } from '@/components/membership/PremiumGate';

const { TextArea } = Input;
const { Option } = Select;

// ==================== 类型定义 ====================
interface ContentTemplate {
    id: string;
    name: string;
    style: string;
    imageStyle: string;
    hasEmoji: boolean;
    hashtags: string[];
    introTemplate: string;
    outroTemplate: string;
    isDefault: boolean;
}

interface ContentItem {
    id: string;
    title: string;
    content: string;
    images: string[];
    platform: string;
    status: 'draft' | 'scheduled' | 'published';
    scheduledDate?: string;
    scheduledTime?: string;
    createdAt: string;
}

interface WeeklyPlan {
    id: string;
    title: string;
    topics: string[];
    startDate: string;
    status: 'pending' | 'generating' | 'completed';
    contents: ContentItem[];
}

interface Material {
    id: string;
    name: string;
    url: string;
    type: 'image' | 'video';
    tags: string[];
    createdAt: string;
}

// ==================== 平台配置 ====================
const PLATFORMS = [
    { id: 'xhs', name: '小红书', icon: '📕', ratio: 'portrait_4_3', color: '#ef4444' },
    { id: 'douyin', name: '抖音', icon: '🎵', ratio: 'portrait_9_16', color: '#10b981' },
    { id: 'weixin', name: '公众号', icon: '💬', ratio: 'landscape_16_9', color: '#22c55e' },
    { id: 'weibo', name: '微博', icon: '👁️', ratio: 'square', color: '#f59e0b' },
    { id: 'bilibili', name: 'B站', icon: '📺', ratio: 'landscape_16_9', color: '#3b82f6' },
    { id: 'zhihu', name: '知乎', icon: '💡', ratio: 'landscape_16_9', color: '#06b6d4' },
];

// ==================== 风格选项 ====================
const STYLE_OPTIONS = [
    { value: 'professional', label: '专业权威', emoji: '👔', desc: '逻辑清晰，术语专业' },
    { value: 'xhs_influencer', label: '种草安利', emoji: '🛍️', desc: '口语化，亲测推荐' },
    { value: 'humorous', label: '幽默风趣', emoji: '🤪', desc: '段子手风格，轻松有趣' },
    { value: 'emotional', label: '情感共鸣', emoji: '❤️', desc: '走心文案，引发共情' },
    { value: 'storytelling', label: '故事叙事', emoji: '📖', desc: '情节跌宕，引人入胜' },
    { value: 'casual', label: '轻松日常', emoji: '☕', desc: '佛系分享，生活记录' },
];

const IMAGE_STYLES = [
    { value: 'warm', label: '暖色调', emoji: '🟠' },
    { value: 'cool', label: '冷色调', emoji: '🔵' },
    { value: 'vintage', label: '复古胶片', emoji: '📼' },
    { value: 'minimal', label: '简约白色', emoji: '⬜' },
    { value: 'dark', label: '暗黑风格', emoji: '⬛' },
    { value: 'vibrant', label: '鲜艳明亮', emoji: '🌈' },
];

// ==================== 智能配图生成辅助函数 ====================

// 提取图片关键词
function extractImageKeywords(topic: string, content: string): string[] {
    const keywords = new Set<string>();
    
    // 添加主题词（中文 + 英文翻译）
    const topicTranslations: Record<string, string> = {
        'AI': 'artificial intelligence', '人工智能': 'artificial intelligence',
        '工具': 'tool', 'APP': 'app', '软件': 'software',
        '效率': 'productivity', '效率工具': 'productivity tool',
        '职场': 'office', '工作': 'work', '办公': 'office',
        '学习': 'study', '教育': 'education', '知识': 'knowledge',
        '健康': 'health', '健身': 'fitness', '运动': 'exercise',
        '美食': 'food', '料理': 'cooking', '烹饪': 'cooking',
        '旅行': 'travel', '旅游': 'travel', '旅游攻略': 'travel guide',
        '美妆': 'beauty', '化妆': 'makeup', '护肤': 'skincare',
        '家居': 'home', '装修': 'interior', '生活': 'lifestyle',
        '理财': 'finance', '投资': 'investment', '赚钱': 'money',
        '情感': 'emotion', '恋爱': 'relationship', '心理': 'psychology',
        '手机': 'smartphone', '数码': 'digital', '科技': 'technology',
        '穿搭': 'fashion', '时尚': 'fashion', '衣服': 'clothing',
        '母婴': 'baby', '育儿': 'parenting', '孩子': 'child',
        '宠物': 'pet', '养猫': 'cat', '养狗': 'dog',
        '汽车': 'car', '车': 'automobile', '驾驶': 'driving',
        '摄影': 'photography', '拍照': 'photo', '相机': 'camera',
        '游戏': 'gaming', '手游': 'mobile game', '电竞': 'esports',
        '减肥': 'weight loss', '瘦身': 'slimming', '减脂': 'diet',
        '养生': 'wellness', '中医': 'traditional chinese medicine', '调理': 'healthcare',
        '推荐': 'recommendation', '测评': 'review', '评测': 'review',
        '教程': 'tutorial', '入门': 'beginner', '指南': 'guide',
        '对比': 'comparison',
    };
    
    const lowerTopic = topic.toLowerCase();
    
    // 翻译主题词
    for (const [cn, en] of Object.entries(topicTranslations)) {
        if (lowerTopic.includes(cn.toLowerCase())) {
            keywords.add(cn); // 保留中文
            keywords.add(en); // 添加英文
        }
    }
    
    // 如果没有匹配，添加原始主题
    if (keywords.size === 0) {
        keywords.add(topic);
        // 尝试翻译常见词
        for (const [cn, en] of Object.entries(topicTranslations)) {
            if (lowerTopic.includes(cn.toLowerCase())) {
                keywords.add(en);
                break;
            }
        }
    }
    
    // 从内容中提取关键词
    const contentText = content.replace(/<[^>]*>/g, '');
    
    // 提取常见词
    const commonPatterns = [
        '推荐', '必用', '神器', '技巧', '方法', '步骤', '案例', '数据',
        'review', 'tips', 'guide', 'how to', 'best', 'top', 'essential',
        'amazing', 'incredible', 'transformative', 'game-changer'
    ];
    
    commonPatterns.forEach(pattern => {
        if (contentText.includes(pattern)) {
            keywords.add(pattern);
        }
    });
    
    // 限制关键词数量
    return Array.from(keywords).slice(0, 8);
}

// 生成图片提示词
function generateImagePrompt(keywords: string[], style: string, platform: string): string {
    const keywordText = keywords.join(', ');
    
    // 风格对应的图片风格描述
    const stylePrompts: Record<string, string> = {
        'professional': 'Professional, clean, modern, business style, high quality photography, minimal design',
        'xhs_influencer': 'Aesthetic, Instagram style, trendy, warm tones, lifestyle photography, vibrant colors',
        'humorous': 'Fun, playful, colorful, cartoon illustration, vibrant, creative',
        'emotional': 'Warm, emotional, soft lighting, heartfelt, cozy atmosphere',
        'storytelling': 'Cinematic, storytelling, dramatic lighting, narrative scene, epic',
        'casual': 'Casual, lifestyle, natural light, relaxed atmosphere, everyday life',
    };
    
    // 平台适配的图片尺寸和风格
    const platformStyle: Record<string, string> = {
        'xhs': 'Chinese social media aesthetic, clean and aesthetic, lifestyle photography',
        'douyin': 'Dynamic, vibrant, eye-catching, vertical video thumbnail style',
        'weixin': 'Professional, clean, article cover style, minimalist',
        'weibo': 'Eye-catching, colorful, social media shareable',
        'bilibili': 'Anime style acceptable, gaming aesthetic, tech-focused',
        'zhihu': 'Professional, informative, clean and readable',
    };
    
    const baseStyle = stylePrompts[style] || stylePrompts['professional'];
    const platformModifier = platformStyle[platform] || '';
    
    // 构建完整提示词
    const prompt = `${keywordText}, ${baseStyle}, ${platformModifier}, 8k, high quality, masterpiece, sharp focus, professional photography`;
    
    return prompt;
}

// 根据平台获取图片尺寸
function getImageSizeByPlatform(platform: string): 'square' | 'portrait' | 'landscape' {
    const sizeMap: Record<string, 'square' | 'portrait' | 'landscape'> = {
        'xhs': 'portrait',
        'douyin': 'portrait',
        'weixin': 'landscape',
        'weibo': 'square',
        'bilibili': 'landscape',
        'zhihu': 'landscape',
    };
    return sizeMap[platform] || 'square';
}

// ==================== 主组件 ====================
export default function AICreatePage() {
    // 权限系统
    const { 
        subscription, 
        isPremium, 
        plan, 
        canUse, 
        consumeQuota, 
        requestUpgrade,
        showUpgradeModal, 
        setShowUpgradeModal,
        upgradeReason,
        usagePercentage,
        remainingQuota,
        loading: permLoading
    } = usePermissions();

    const [activeTab, setActiveTab] = useState('create');

    // 创作状态
    const [topic, setTopic] = useState('');
    const [style, setStyle] = useState('professional');
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['xhs']);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // 生成结果 - 初始为空
    const [results, setResults] = useState<ContentItem[]>([]);

    // 自动化设置
    const [autoPublish, setAutoPublish] = useState(false);
    const [bestTimePublish, setBestTimePublish] = useState(true);
    const [batchCount, setBatchCount] = useState(7);
    const [autoGenerateImages, setAutoGenerateImages] = useState(true);

    // 模板状态
    const [templates, setTemplates] = useState<ContentTemplate[]>([
        {
            id: '1',
            name: '默认模板',
            style: 'professional',
            imageStyle: 'warm',
            hasEmoji: true,
            hashtags: ['#AI', '#效率工具'],
            introTemplate: '今天来聊聊{topic}...',
            outroTemplate: '以上就是今天的分享，有问题评论区见！',
            isDefault: true
        }
    ]);

    // 周计划状态
    const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlan[]>([]);
    const [planDrawerOpen, setPlanDrawerOpen] = useState(false);
    const [planTopics, setPlanTopics] = useState<string[]>(['', '', '', '', '', '', '']);
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

    // 内容库状态
    const [contentLibrary, setContentLibrary] = useState<ContentItem[]>([]);

    // 素材必须来自用户上传或真实生成接口，生产环境不预置占位图片。
    const [materials, setMaterials] = useState<Material[]>([]);
    const [materialTags, setMaterialTags] = useState(['全部', '封面', '配图', '头像', 'Banner']);
    const [selectedTag, setSelectedTag] = useState('全部');

    // UI状态
    const [templateModalOpen, setTemplateModalOpen] = useState(false);
    const [currentTemplate, setCurrentTemplate] = useState<ContentTemplate | null>(null);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [selectedImageIndices, setSelectedImageIndices] = useState<number[]>([]);

    // ==================== 最佳发布时间配置 ====================
    const getBestPublishTime = (index: number) => {
        if (!bestTimePublish) return '10:00';
        // 小红书最佳发布时间（根据数据推荐的时段）
        const bestTimes = ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
        return bestTimes[index % bestTimes.length];
    };

    // ==================== 创作核心功能 ====================
    const handleGenerate = async () => {
        if (!topic) {
            message.warning('请输入创作主题');
            return;
        }
        if (selectedPlatforms.length === 0) {
            message.warning('请至少选择一个平台');
            return;
        }

        setIsGenerating(true);
        const newResults: ContentItem[] = [];

        try {
            // 获取当前用户
            const { data: { user } } = await supabase.auth.getUser();
            
            // 构建详细的 AI 提示词 - 生成更丰富的内容
            const prompt = `请为以下主题创作一篇高质量的社交媒体爆款文章：

【主题】${topic}
【风格】${STYLE_OPTIONS.find(s => s.value === style)?.label || '专业'}
【目标平台】${selectedPlatforms.map(p => PLATFORMS.find(plat => plat.id === p)?.name).join('、')}

【写作要求】
1. 开场要吸引眼球，用一个引人入胜的问题、统计数据或场景引入话题
2. 主体部分要结构清晰，层层递进，包含：
   - 核心观点阐述（2-3个分论点）
   - 实用干货分享（至少3-5条具体建议）
   - 真实案例分析（1-2个具体案例）
3. 结尾要有行动号召，引导用户互动
4. 语言风格要口语化、有感染力，适当使用 emoji
5. 包含5-8个相关的话题标签

【特别注意】
- 内容要足够详实，每篇至少800-1200字
- 避免空洞说教，要有实操性强的内容
- 适当制造槽点或争议点，引发讨论

请直接输出完整的正文内容，不需要标题和标签。`;

            // 批量生成内容
            for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
                for (const platformId of selectedPlatforms) {
                    // 更新进度
                    message.loading({ content: `正在生成第 ${batchIndex + 1}/${batchCount} 批内容 (${PLATFORMS.find(p => p.id === platformId)?.name})...`, key: 'generate' });

                    try {
                        // 调用真实 AI 服务生成内容 - 增加 token 限制
                        const result = await aiService.generateArticle({
                            prompt,
                            style,
                            maxTokens: 3000,  // 增加 token 限制，生成更长的内容
                            temperature: 0.8  // 稍微提高温度，增加创意性
                        });

                        const publishTime = getBestPublishTime(batchIndex);
                        const publishDate = dayjs().add(batchIndex, 'day').format('YYYY-MM-DD');

                        // 生成标题
                        const title = `${PLATFORMS.find(p => p.id === platformId)?.icon} ${PLATFORMS.find(p => p.id === platformId)?.name} · ${topic} #${batchIndex + 1}`;

                        // 生成配图（如果开启）
                        let images: string[] = [];
                        if (autoGenerateImages) {
                            message.loading({ content: `正在生成配图...`, key: `image-${batchIndex}-${platformId}` });
                            try {
                                // 从生成的文案中提取关键信息，用于生成更匹配的配图
                                const generatedContent = result.content;
                                
                                // 提取关键主题词（从标题和内容中提取）
                                const keywords = extractImageKeywords(topic, generatedContent);
                                
                                // 生成详细的图片提示词
                                const imagePrompt = generateImagePrompt(keywords, style, platformId);
                                
                                console.log('生成配图提示词:', imagePrompt);
                                
                                const imageResult = await imageService.generateImage({
                                    prompt: imagePrompt,
                                    style,
                                    imageSize: getImageSizeByPlatform(platformId)
                                });
                                
                                // FalImageService 返回 { images: [{ url, width, height }] }
                                images = imageResult.images.map(img => img.url);
                            } catch (imageError) {
                                console.warn('Image generation failed, using placeholder', imageError);
                                // 使用更具体的提示词生成占位图
                                const keywords = extractImageKeywords(topic, '');
                                const imagePrompt = generateImagePrompt(keywords, style, platformId);
                                images = [`https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=1024&height=1024&nologo=true&seed=${Date.now()}`];
                            }
                        }

                        const newItem: ContentItem = {
                            id: Date.now().toString() + platformId + batchIndex,
                            title,
                            content: `<p>${result.content.replace(/\n\n/g, '</p><p>')}</p>`,
                            images,
                            platform: platformId,
                            status: 'scheduled',
                            scheduledDate: publishDate,
                            scheduledTime: publishTime,
                            createdAt: dayjs().format()
                        };

                        newResults.push(newItem);

                        // 保存到 Supabase
                        if (user) {
                            await createContent({
                                user_id: user.id,
                                title: newItem.title,
                                content: newItem.content,
                                platform: platformId,
                                status: 'scheduled',
                                topic,
                                style,
                                images: newItem.images,
                                scheduled_date: publishDate,
                                scheduled_time: publishTime,
                                tags: [`#${platformId}`, `#${style}`]
                            });
                        }
                    } catch (aiError) {
                        console.error('AI generation error:', aiError);
                        // 如果 AI 调用失败，使用降级方案
                        const publishTime = getBestPublishTime(batchIndex);
                        const fallbackContent = `<p>💡 关于${topic}，今天来分享一些实用的经验和技巧。</p>
<p><br/></p>
<p>${topic}是很多人关心的话题，今天我们就来详细聊一聊。</p>
<p><br/></p>
<p>📌 <strong>为什么${topic}如此重要？</strong></p>
<p>在这个快速变化的时代，${topic}已经成为了不可忽视的话题。无论是工作还是生活，掌握${topic}都能带来巨大的帮助。</p>
<p><br/></p>
<p>💪 <strong>如何快速入门？</strong></p>
<p>1️⃣ <strong>了解基础知识</strong> - 先从概念入手，建立整体认知</p>
<p>2️⃣ <strong>实践出真知</strong> - 理论结合实际，多动手尝试</p>
<p>3️⃣ <strong>持续学习</strong> - 关注行业动态，不断更新知识库</p>
<p><br/></p>
<p>🌟 <strong>实用建议</strong></p>
<p>• 制定明确的学习计划</p>
<p>• 找到志同道合的伙伴一起进步</p>
<p>• 定期复盘总结经验</p>
<p><br/></p>
<p>希望以上分享对你有所帮助！如果你觉得有用，欢迎点赞收藏，也可以评论区聊聊你的想法～</p>`;

                        // 生成降级配图
                        let fallbackImages: string[] = [];
                        if (autoGenerateImages) {
                            fallbackImages = [`https://image.pollinations.ai/prompt/${encodeURIComponent(topic)}?width=400&height=300&nologo=true&seed=${Date.now()}`];
                        }

                        const fallbackItem: ContentItem = {
                            id: Date.now().toString() + platformId + batchIndex,
                            title: `${PLATFORMS.find(p => p.id === platformId)?.icon} ${PLATFORMS.find(p => p.id === platformId)?.name} · ${topic} #${batchIndex + 1}`,
                            content: fallbackContent,
                            images: fallbackImages,
                            platform: platformId,
                            status: 'scheduled',
                            scheduledDate: dayjs().add(batchIndex, 'day').format('YYYY-MM-DD'),
                            scheduledTime: publishTime,
                            createdAt: dayjs().format()
                        };
                        newResults.push(fallbackItem);
                    }
                }
            }

            // 清空进度消息
            message.destroy('generate');
            // 清空所有图片生成进度消息
            for (let i = 0; i < batchCount; i++) {
                message.destroy(`image-${i}-xhs`);
                message.destroy(`image-${i}-douyin`);
                message.destroy(`image-${i}-weixin`);
            }

            setResults(newResults);

            // 如果开启了最佳时间提示
            if (bestTimePublish) {
                message.success(`🎉 成功生成 ${newResults.length} 篇内容！已自动匹配最佳发布时间`);
            } else {
                message.success(`成功生成 ${newResults.length} 篇内容！`);
            }

            // 添加到内容库
            setContentLibrary(prev => [...newResults, ...prev]);
        } catch (error) {
            console.error('Generation error:', error);
            message.error('生成失败，请重试');
        } finally {
            setIsGenerating(false);
        }
    };

    // ==================== 一键发布全部 ====================
    const handleAutoPublishAll = async () => {
        if (results.length === 0) {
            message.warning('请先生成内容');
            return;
        }

        try {
            message.loading({ content: '正在创建发布任务...', key: 'publish' });

            // 模拟创建发布任务
            await new Promise(resolve => setTimeout(resolve, 1000));

            message.success({
                content: `已为 ${results.length} 篇内容创建定时发布任务`,
                key: 'publish',
                duration: 3
            });

            // 跳转到分发中心
            window.location.href = '/publish';
        } catch (error) {
            message.error('发布任务创建失败');
        }
    };

    // ==================== 智能周计划 ====================
    const handleGenerateWeeklyPlan = async () => {
        const validTopics = planTopics.filter(t => t.trim());
        if (validTopics.length === 0) {
            message.warning('请至少输入一个主题');
            return;
        }

        setIsGeneratingPlan(true);

        try {
            await new Promise(resolve => setTimeout(resolve, 2000));

            const planContents: ContentItem[] = validTopics.map((t, i) => ({
                id: `plan-${Date.now()}-${i}`,
                title: `周计划-${i + 1}: ${t}`,
                content: `<p>关于${t}的深度内容...</p>`,
                images: [`https://picsum.photos/400/300?random=${Date.now() + i}`],
                platform: 'xhs',
                status: 'scheduled',
                scheduledDate: dayjs().add(i, 'day').format('YYYY-MM-DD'),
                scheduledTime: '10:00',
                createdAt: dayjs().format()
            }));

            const newPlan: WeeklyPlan = {
                id: Date.now().toString(),
                title: `${dayjs().format('M月D日')} - 周计划`,
                topics: validTopics,
                startDate: dayjs().format('YYYY-MM-DD'),
                status: 'completed',
                contents: planContents
            };

            setWeeklyPlans([newPlan, ...weeklyPlans]);
            setContentLibrary([...contentLibrary, ...planContents]);
            setPlanDrawerOpen(false);
            message.success('周计划生成完成！');
        } catch (error) {
            message.error('计划生成失败');
        } finally {
            setIsGeneratingPlan(false);
        }
    };

    // ==================== 复制与下载功能 ====================
    const handleCopyText = (item: ContentItem) => {
        const text = `${item.title}\n\n${item.content.replace(/<[^>]*>/g, '')}`;
        navigator.clipboard.writeText(text);
        message.success('已复制到剪贴板');
    };

    const handleCopyAllTexts = () => {
        const allText = results.map(r =>
            `【${r.platform.toUpperCase()}】\n标题: ${r.title}\n内容: ${r.content.replace(/<[^>]*>/g, '')}\n\n`
        ).join('--- ---\n');
        navigator.clipboard.writeText(allText);
        message.success('所有内容已复制');
    };

    // AI 生成图片经服务端导出路由下载，写入隐式 AI 标识元数据；
    // 本地 blob（用户上传素材）服务端取不到，仍走直接下载
    const downloadImageUrl = (url: string, filename: string) => {
        const href = /^https?:\/\//.test(url)
            ? `/api/ai/export-image?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`
            : url;
        const link = document.createElement('a');
        link.href = href;
        link.download = filename;
        link.click();
    };

    const handleDownloadImages = (item: ContentItem) => {
        item.images.forEach((url, i) => {
            downloadImageUrl(url, `${item.title}-${i + 1}.jpg`);
        });
        message.success('图片下载中...');
    };

    const handleDownloadAllImages = () => {
        results.forEach(item => {
            item.images.forEach((url, i) => {
                downloadImageUrl(url, `${item.title}-${i + 1}.jpg`);
            });
        });
        message.success('全部图片下载中...');
    };

    const handleBatchDownload = () => {
        results.forEach(item => {
            handleDownloadImages(item);
        });
    };

    // ==================== 素材库操作 ====================
    const handleUploadMaterial = (file: File) => {
        const newMaterial: Material = {
            id: Date.now().toString(),
            name: file.name,
            url: URL.createObjectURL(file),
            type: file.type.startsWith('image') ? 'image' : 'video',
            tags: ['未分类'],
            createdAt: dayjs().format()
        };
        setMaterials([newMaterial, ...materials]);
        message.success('素材上传成功');
    };

    // ==================== 渲染内容 ====================
    const currentResult = results[previewIndex] || {
        title: '等待生成...',
        content: '<p>输入主题，点击生成开始创作</p>',
        images: [],
        platform: selectedPlatforms[0] || 'xhs',
        status: 'draft',
        createdAt: dayjs().format()
    };

    const filteredMaterials = selectedTag === '全部'
        ? materials
        : materials.filter(m => m.tags.includes(selectedTag));

    return (
        <div className="min-h-screen bg-zinc-50">
            {/* 顶部导航 */}
            <div className="bg-white border-b border-zinc-200 px-6 py-4">
                <div className="flex items-center justify-between max-w-7xl mx-auto">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold text-zinc-900">创作中心</h1>
                        <div className="flex gap-1 bg-zinc-100 rounded-lg p-1">
                            {[
                                { key: 'create', icon: <ThunderboltFilled />, label: 'AI创作' },
                                { key: 'plan', icon: <CalendarOutlined />, label: '周计划' },
                                { key: 'library', icon: <FolderOutlined />, label: '内容库' },
                                { key: 'materials', icon: <FileImageOutlined />, label: '素材库' },
                            ].map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={clsx(
                                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                        activeTab === tab.key
                                            ? "bg-white text-indigo-600 shadow-sm"
                                            : "text-zinc-500 hover:text-zinc-700"
                                    )}
                                >
                                    {tab.icon}
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 快捷操作 */}
                    <div className="flex items-center gap-3">
                        <Button
                            icon={<SettingOutlined />}
                            onClick={() => setTemplateModalOpen(true)}
                        >
                            模板设置
                        </Button>
                    </div>
                </div>
            </div>

            {/* 主要内容区 */}
            <div className="max-w-7xl mx-auto p-6">
                <AnimatePresence mode="wait">
                    {/* ==================== AI创作 Tab ==================== */}
                    {activeTab === 'create' && (
                        <motion.div
                            key="create"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 xl:grid-cols-4 gap-6"
                        >
                            {/* 左侧：配置面板 */}
                            <div className="space-y-4">
                                {/* 主题输入 */}
                                <div className="bg-white rounded-xl p-5 border border-zinc-200">
                                    <label className="text-sm font-medium text-zinc-700 block mb-2">
                                        创作主题 <span className="text-red-500">*</span>
                                    </label>
                                    <TextArea
                                        rows={3}
                                        placeholder="想写什么？例如：AI工具推荐、职场技巧、旅行攻略"
                                        value={topic}
                                        onChange={e => setTopic(e.target.value)}
                                        className="!border-zinc-200 !rounded-lg"
                                    />
                                </div>

                                {/* 风格选择 */}
                                <div className="bg-white rounded-xl p-5 border border-zinc-200">
                                    <label className="text-sm font-medium text-zinc-700 block mb-3">风格基调</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {STYLE_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setStyle(opt.value)}
                                                className={clsx(
                                                    "p-3 rounded-lg border text-left transition-all",
                                                    style === opt.value
                                                        ? "border-indigo-500 bg-indigo-50"
                                                        : "border-zinc-200 hover:border-zinc-300"
                                                )}
                                            >
                                                <span className="text-lg">{opt.emoji}</span>
                                                <span className="text-sm font-medium ml-2">{opt.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 平台选择 */}
                                <div className="bg-white rounded-xl p-5 border border-zinc-200">
                                    <label className="text-sm font-medium text-zinc-700 block mb-3">分发平台</label>
                                    <div className="flex flex-wrap gap-2">
                                        {PLATFORMS.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => {
                                                    setSelectedPlatforms(prev =>
                                                        prev.includes(p.id)
                                                            ? prev.filter(id => id !== p.id)
                                                            : [...prev, p.id]
                                                    );
                                                }}
                                                className={clsx(
                                                    "px-3 py-1.5 rounded-full text-sm border transition-all flex items-center gap-1.5",
                                                    selectedPlatforms.includes(p.id)
                                                        ? "bg-zinc-900 text-white border-zinc-900"
                                                        : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                                                )}
                                            >
                                                <span>{p.icon}</span>
                                                {p.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 自动化设置 */}
                                <div className="bg-white rounded-xl p-5 border border-zinc-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <RobotOutlined className="text-indigo-600" />
                                        <label className="text-sm font-medium text-zinc-700">自动化设置</label>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-zinc-600">自动匹配最佳发布时间</span>
                                            <Checkbox
                                                checked={bestTimePublish}
                                                onChange={(e) => setBestTimePublish(e.target.checked)}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-zinc-600">生成后自动添加配图</span>
                                            <Checkbox
                                                checked={autoGenerateImages}
                                                onChange={(e) => setAutoGenerateImages(e.target.checked)}
                                            />
                                        </div>

                                        <div className="pt-2 border-t border-zinc-100">
                                            <label className="text-sm text-zinc-600 block mb-2">批量创作数量</label>
                                            <div className="flex items-center gap-3">
                                                <Button
                                                    size="small"
                                                    onClick={() => setBatchCount(Math.max(1, batchCount - 1))}
                                                >-</Button>
                                                <span className="font-bold text-lg w-8 text-center">{batchCount}</span>
                                                <Button
                                                    size="small"
                                                    onClick={() => setBatchCount(Math.min(30, batchCount + 1))}
                                                >+</Button>
                                                <span className="text-xs text-zinc-400">篇</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 生成按钮 */}
                                <Button
                                    type="primary"
                                    size="large"
                                    block
                                    onClick={handleGenerate}
                                    loading={isGenerating}
                                    icon={<ThunderboltFilled />}
                                    className="!h-14 !rounded-xl !text-lg !font-bold !bg-gradient-to-r from-indigo-600 to-purple-600"
                                >
                                    {isGenerating ? 'AI 思考中...' : '立即生成'}
                                </Button>
                            </div>

                            {/* 中间：编辑器 - 完整内容列表 */}
                            <div className="lg:col-span-2 bg-white rounded-xl border border-zinc-200 overflow-hidden">
                                <div className="border-b border-zinc-200 px-4 py-3 flex items-center justify-between bg-zinc-50">
                                    <div className="flex items-center gap-2">
                                        <FileTextOutlined className="text-indigo-600" />
                                        <span className="font-medium text-zinc-900">生成结果</span>
                                        {results.length > 0 && (
                                            <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full">
                                                {results.length} 篇内容
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="p-0 max-h-[calc(100vh-200px)] overflow-y-auto">
                                    {results.length === 0 ? (
                                        // 等待生成状态
                                        <div className="p-8 text-center text-zinc-400">
                                            <FileTextOutlined className="text-4xl mb-4" />
                                            <p>输入创作主题，点击「立即生成」开始创作</p>
                                        </div>
                                    ) : (
                                        // 内容列表 - 展示所有生成的完整内容
                                        <div className="divide-y divide-zinc-100">
                                            {results.map((item, idx) => (
                                                <div 
                                                    key={item.id} 
                                                    className={clsx(
                                                        "p-4 transition-all cursor-pointer",
                                                        previewIndex === idx 
                                                            ? "bg-indigo-50 border-l-4 border-indigo-600" 
                                                            : "hover:bg-zinc-50 border-l-4 border-transparent"
                                                    )}
                                                    onClick={() => setPreviewIndex(idx)}
                                                >
                                                    {/* 内容头部 */}
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-lg">{PLATFORMS.find(p => p.id === item.platform)?.icon}</span>
                                                            <span className="font-medium text-zinc-900">{item.title}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {item.scheduledDate && (
                                                                <span className="text-xs px-2 py-1 bg-green-100 text-green-600 rounded flex items-center gap-1">
                                                                    <CalendarOutlined />
                                                                    {item.scheduledDate} {item.scheduledTime}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* 完整正文内容 */}
                                                    <div className="text-sm text-zinc-600 leading-relaxed mb-3 line-clamp-6">
                                                        {item.content.replace(/<[^>]*>/g, '')}
                                                    </div>

                                                    {/* 配图展示 */}
                                                    {item.images.length > 0 && (
                                                        <div className="flex gap-2 mb-3">
                                                            {item.images.map((img, i) => (
                                                                <img
                                                                    key={i}
                                                                    src={img}
                                                                    alt={`配图 ${i + 1}`}
                                                                    className="w-20 h-20 rounded-lg object-cover border border-zinc-200"
                                                                />
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* 标签和统计 */}
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex flex-wrap gap-1">
                                                            {['#AI创作', '#分发侠'].map(tag => (
                                                                <span key={tag} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <span className="text-xs text-zinc-400">
                                                            {item.content.replace(/<[^>]*>/g, '').length} 字 · {item.images.length} 图
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 右侧：操作与导出 */}
                            <div className="space-y-4">
                                {/* 操作按钮 */}
                                <div className="bg-white rounded-xl p-5 border border-zinc-200">
                                    <h3 className="font-medium text-zinc-900 mb-4">快捷操作</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Button
                                            icon={<CopyOutlined />}
                                            onClick={() => handleCopyText(currentResult)}
                                            disabled={results.length === 0}
                                        >
                                            复制文本
                                        </Button>
                                        <Button
                                            icon={<DownloadOutlined />}
                                            onClick={() => handleDownloadImages(currentResult)}
                                            disabled={results.length === 0}
                                        >
                                            下载图片
                                        </Button>
                                        <Button
                                            icon={<CopyOutlined />}
                                            onClick={handleCopyAllTexts}
                                            disabled={results.length === 0}
                                        >
                                            复制全部
                                        </Button>
                                        <Button
                                            icon={<DownloadOutlined />}
                                            onClick={handleDownloadAllImages}
                                            disabled={results.length === 0}
                                        >
                                            下载全部
                                        </Button>
                                        <Button
                                            className="col-span-2 !bg-blue-600 !text-white hover:!bg-blue-500 border-none"
                                            icon={<VideoCameraOutlined />}
                                            onClick={() => {
                                                const url = `/traffic-sandwich?productName=${encodeURIComponent(currentResult.title)}&style=${encodeURIComponent(style === 'xhs_influencer' ? 'High Energy' : 'Professional')}`;
                                                window.location.href = url;
                                            }}
                                            disabled={results.length === 0}
                                        >
                                            生成引流三明治视频
                                        </Button>
                                    </div>
                                </div>

                                {/* 进度指示 */}
                                {results.length > 0 && (
                                    <div className="bg-white rounded-xl p-5 border border-zinc-200">
                                        <h3 className="font-medium text-zinc-900 mb-3">生成结果</h3>
                                        <div className="space-y-2">
                                            {results.map((r, i) => (
                                                <div
                                                    key={r.id}
                                                    className={clsx(
                                                        "p-3 rounded-lg border flex items-center justify-between",
                                                        previewIndex === i
                                                            ? "border-indigo-500 bg-indigo-50"
                                                            : "border-zinc-200"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span>{PLATFORMS.find(p => p.id === r.platform)?.icon}</span>
                                                        <span className="text-sm truncate max-w-[120px]">{r.title}</span>
                                                    </div>
                                                    <Button
                                                        type="text"
                                                        size="small"
                                                        icon={<EyeOutlined />}
                                                        onClick={() => setPreviewIndex(i)}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 一键发布 */}
                                <Button
                                    type="primary"
                                    size="large"
                                    block
                                    icon={<RocketOutlined />}
                                    disabled={results.length === 0}
                                    className="!h-12 !rounded-xl"
                                    onClick={() => message.info('跳转到分发中心...')}
                                >
                                    一键发布
                                </Button>
                            </div>

                            {/* 第4列：手机预览 */}
                            <div className="hidden xl:flex flex-col items-center sticky top-6 h-fit">
                                <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-widest">预览效果</h3>
                                <PhonePreview
                                    platform={currentResult.platform}
                                    title={currentResult.title}
                                    content={currentResult.content}
                                    images={currentResult.images}
                                />
                            </div>
                        </motion.div>
                    )}

                    {/* ==================== 手机预览（仅非AI创作Tab时显示）==================== */}
                    {activeTab !== 'create' && (
                        <div className="hidden xl:flex flex-col items-center justify-center sticky top-6 h-fit">
                            <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-widest">预览效果</h3>
                            <PhonePreview
                                platform="xhs"
                                title="选择内容查看预览"
                                content="<p>切换到 AI 创作或选择已有内容查看预览效果</p>"
                                images={[]}
                            />
                        </div>
                    )}

                    {/* ==================== 周计划 Tab ==================== */}
                    {activeTab === 'plan' && (
                        <motion.div
                            key="plan"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-zinc-900">智能周计划</h2>
                                    <p className="text-zinc-500 text-sm">输入本周主题，AI 自动规划发布节奏</p>
                                </div>
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={() => setPlanDrawerOpen(true)}
                                    className="!rounded-xl"
                                >
                                    新建周计划
                                </Button>
                            </div>

                            {/* 计划列表 */}
                            {weeklyPlans.length === 0 ? (
                                <Empty
                                    description="暂无周计划"
                                    className="py-16"
                                >
                                    <Button type="primary" onClick={() => setPlanDrawerOpen(true)}>
                                        创建第一个计划
                                    </Button>
                                </Empty>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {weeklyPlans.map(plan => (
                                        <div
                                            key={plan.id}
                                            className="bg-white rounded-xl border border-zinc-200 p-5 hover:shadow-md transition-shadow"
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <h3 className="font-medium text-zinc-900">{plan.title}</h3>
                                                    <p className="text-sm text-zinc-500">
                                                        {plan.topics.length} 个主题 · {plan.startDate}
                                                    </p>
                                                </div>
                                                <Badge
                                                    status={plan.status === 'completed' ? 'success' : 'processing'}
                                                    text={plan.status === 'completed' ? '已完成' : '生成中'}
                                                />
                                            </div>
                                            <div className="space-y-2 mb-4">
                                                {plan.topics.slice(0, 3).map((t, i) => (
                                                    <div key={i} className="text-sm text-zinc-600 flex items-center gap-2">
                                                        <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center">
                                                            {i + 1}
                                                        </span>
                                                        {t}
                                                    </div>
                                                ))}
                                                {plan.topics.length > 3 && (
                                                    <p className="text-xs text-zinc-400">+{plan.topics.length - 3} 个主题</p>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <Button size="small" onClick={() => message.info('编辑计划')}>
                                                    编辑
                                                </Button>
                                                <Button size="small" type="primary" onClick={() => message.info('查看详情')}>
                                                    查看内容
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ==================== 内容库 Tab ==================== */}
                    {activeTab === 'library' && (
                        <motion.div
                            key="library"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-zinc-900">内容库</h2>
                                <div className="flex items-center gap-3">
                                    <Select defaultValue="all" className="w-32">
                                        <Option value="all">全部平台</Option>
                                        {PLATFORMS.map(p => (
                                            <Option key={p.id} value={p.id}>{p.name}</Option>
                                        ))}
                                    </Select>
                                    <Button icon={<DownloadOutlined />} onClick={handleBatchDownload}>
                                        批量下载
                                    </Button>
                                </div>
                            </div>

                            {contentLibrary.length === 0 ? (
                                <Empty description="暂无内容，去 AI 创作或生成周计划吧" className="py-16" />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {contentLibrary.map(item => (
                                        <div key={item.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
                                            <div className="p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span>{PLATFORMS.find(p => p.id === item.platform)?.icon}</span>
                                                    <span className="text-xs px-2 py-0.5 bg-zinc-100 rounded text-zinc-600">
                                                        {item.status === 'scheduled' ? '待发布' : '草稿'}
                                                    </span>
                                                    {item.scheduledDate && (
                                                        <span className="text-xs text-zinc-400">
                                                            📅 {item.scheduledDate}
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="font-medium text-zinc-900 mb-2 line-clamp-2">{item.title}</h3>
                                                {item.images.length > 0 && (
                                                    <div className="flex gap-1 mb-3">
                                                        {item.images.slice(0, 3).map((img, i) => (
                                                            <img key={i} src={img} className="w-16 h-16 rounded object-cover" />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="border-t border-zinc-100 px-4 py-2 flex items-center justify-between bg-zinc-50">
                                                <span className="text-xs text-zinc-400">
                                                    {dayjs(item.createdAt).format('M月D日 H:mm')}
                                                </span>
                                                <div className="flex gap-1">
                                                    <Tooltip title="复制文本">
                                                        <Button
                                                            type="text"
                                                            size="small"
                                                            icon={<CopyOutlined />}
                                                            onClick={() => handleCopyText(item)}
                                                        />
                                                    </Tooltip>
                                                    <Tooltip title="生成引流视频">
                                                        <Button
                                                            type="text"
                                                            size="small"
                                                            icon={<VideoCameraOutlined />}
                                                            onClick={() => {
                                                                const url = `/traffic-sandwich?productName=${encodeURIComponent(item.title)}&style=${encodeURIComponent(style === 'xhs_influencer' ? 'High Energy' : 'Professional')}`;
                                                                window.location.href = url;
                                                            }}
                                                        />
                                                    </Tooltip>
                                                    <Tooltip title="下载图片">
                                                        <Button
                                                            type="text"
                                                            size="small"
                                                            icon={<DownloadOutlined />}
                                                            onClick={() => handleDownloadImages(item)}
                                                        />
                                                    </Tooltip>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ==================== 素材库 Tab ==================== */}
                    {activeTab === 'materials' && (
                        <motion.div
                            key="materials"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-zinc-900">素材库</h2>
                                <Upload
                                    showUploadList={false}
                                    beforeUpload={handleUploadMaterial}
                                    accept="image/*"
                                >
                                    <Button type="primary" icon={<Upload />}>
                                        上传素材
                                    </Button>
                                </Upload>
                            </div>

                            {/* 标签筛选 */}
                            <div className="flex gap-2 mb-6">
                                {materialTags.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => setSelectedTag(tag)}
                                        className={clsx(
                                            "px-4 py-1.5 rounded-full text-sm transition-all",
                                            selectedTag === tag
                                                ? "bg-indigo-600 text-white"
                                                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                                        )}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>

                            {/* 素材网格 */}
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {/* 上传按钮 */}
                                <label className="aspect-square rounded-xl border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 cursor-pointer transition-colors">
                                    <UploadOutlined className="text-2xl mb-2" />
                                    <span className="text-sm">上传图片</span>
                                    <input type="file" className="hidden" accept="image/*" onChange={e => {
                                        if (e.target.files?.[0]) handleUploadMaterial(e.target.files[0]);
                                    }} />
                                </label>

                                {filteredMaterials.map(material => (
                                    <div key={material.id} className="aspect-square rounded-xl overflow-hidden group relative">
                                        <img
                                            src={material.url}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <Button
                                                shape="circle"
                                                icon={<CopyOutlined />}
                                                onClick={() => {
                                                    navigator.clipboard.writeText(material.url);
                                                    message.success('链接已复制');
                                                }}
                                            />
                                            <Button
                                                shape="circle"
                                                icon={<DownloadOutlined />}
                                                onClick={() => {
                                                    const link = document.createElement('a');
                                                    link.href = material.url;
                                                    link.download = material.name;
                                                    link.click();
                                                }}
                                            />
                                            <Button
                                                shape="circle"
                                                icon={<VideoCameraOutlined />}
                                                title="视频包装"
                                                onClick={() => {
                                                    const url = `/traffic-sandwich?productName=${encodeURIComponent(material.name)}&videoUrl=${encodeURIComponent(material.url)}`;
                                                    window.location.href = url;
                                                }}
                                            />
                                            <Button
                                                shape="circle"
                                                danger
                                                icon={<DeleteOutlined />}
                                                onClick={() => {
                                                    setMaterials(materials.filter(m => m.id !== material.id));
                                                    message.success('已删除');
                                                }}
                                            />
                                        </div>
                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                                            <p className="text-white text-xs truncate">{material.name}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ==================== 周计划抽屉 ==================== */}
            <Drawer
                title="创建周计划"
                open={planDrawerOpen}
                onClose={() => setPlanDrawerOpen(false)}
                width={500}
                footer={
                    <div className="flex justify-end gap-3">
                        <Button onClick={() => setPlanDrawerOpen(false)}>取消</Button>
                        <Button
                            type="primary"
                            onClick={handleGenerateWeeklyPlan}
                            loading={isGeneratingPlan}
                            icon={<RobotOutlined />}
                        >
                            AI 智能生成
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-zinc-500">
                        输入本周想要创作的主题，AI 将自动规划发布时间和内容方向。
                    </p>

                    <div className="space-y-3">
                        {planTopics.map((topic, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-medium">
                                    {i + 1}
                                </div>
                                <Input
                                    placeholder={`周${['一', '二', '三', '四', '五', '六', '日'][i]}主题...`}
                                    value={topic}
                                    onChange={e => {
                                        const newTopics = [...planTopics];
                                        newTopics[i] = e.target.value;
                                        setPlanTopics(newTopics);
                                    }}
                                />
                            </div>
                        ))}
                    </div>

                    <div className="p-4 bg-indigo-50 rounded-xl">
                        <h4 className="text-sm font-medium text-indigo-900 mb-2">💡 AI 建议</h4>
                        <p className="text-xs text-indigo-600">
                            基于小红书最佳发布时间，建议安排在周一、周三、周五、周六的 10:00-12:00 或 20:00-22:00 发布。
                        </p>
                    </div>
                </div>
            </Drawer>

            {/* ==================== 模板设置弹窗 ==================== */}
            <Modal
                title="创作模板设置"
                open={templateModalOpen}
                onCancel={() => setTemplateModalOpen(false)}
                footer={null}
                width={600}
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-zinc-700 block mb-2">默认风格</label>
                            <Select
                                defaultValue="professional"
                                className="w-full"
                                onChange={val => {
                                    const template = { ...templates[0], style: val };
                                    setTemplates([template, ...templates.slice(1)]);
                                }}
                            >
                                {STYLE_OPTIONS.map(opt => (
                                    <Option key={opt.value} value={opt.value}>
                                        {opt.emoji} {opt.label}
                                    </Option>
                                ))}
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-zinc-700 block mb-2">图片风格</label>
                            <Select
                                defaultValue="warm"
                                className="w-full"
                            >
                                {IMAGE_STYLES.map(opt => (
                                    <Option key={opt.value} value={opt.value}>
                                        {opt.emoji} {opt.label}
                                    </Option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-zinc-700 block mb-2">常用标签</label>
                        <Input placeholder="用逗号分隔，如 #AI, #效率, #工具" />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-zinc-700 block mb-2">开头模板</label>
                        <TextArea
                            rows={2}
                            placeholder="例如：今天来聊聊{topic}这个话题..."
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-zinc-700 block mb-2">结尾模板</label>
                        <TextArea
                            rows={2}
                            placeholder="例如：以上就是今天的分享，有问题评论区见！"
                        />
                    </div>

                    <Checkbox defaultChecked>生成时自动添加 emoji</Checkbox>
                    <Checkbox defaultChecked>生成时自动添加话题标签</Checkbox>
                </div>
            </Modal>
        </div>
    );
}
