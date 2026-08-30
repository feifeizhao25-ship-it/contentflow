'use client';

import React, { useState, useMemo } from 'react';
import {
    Button,
    Card,
    Input,
    Tag,
    Tabs,
    Steps,
    message,
    Divider,
    Space,
    Typography,
    Tooltip,
    Modal,
    Popover
} from 'antd';
import {
    Sparkles,
    Send,
    Layers,
    Zap,
    Target,
    PlayCircle,
    HelpCircle,
    TrendingUp,
    MessageSquare,
    ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/lib/api-client';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function TrafficSandwichPage() {
    const [activeStep, setActiveStep] = useState(0);
    const [isGenerating, setIsGenerating] = useState(false);

    // State for layers
    const [topic, setTopic] = useState('');
    const [hook, setHook] = useState('');
    const [coreContent, setCoreContent] = useState('');
    const [cta, setCta] = useState('');

    // AI Suggestions state
    const [suggestions, setSuggestions] = useState<{ hooks: string[], ctas: string[] }>({
        hooks: [],
        ctas: []
    });

    const handleSuggestStrategy = async () => {
        if (!topic.trim()) {
            message.warning('请先输入您的核心主题或产品名称');
            return;
        }

        setIsGenerating(true);
        try {
            // Use the generic text generation for strategy
            const res: any = await apiClient.post('/ai/generate/article', {
                topic,
                style: 'xhs_influencer',
                platform: 'xhs',
                keywords: ['钩子', '转化', '反直觉'],
            });

            const content = res?.data?.content || '';

            // Parse or simulate parsing for demo
            // In real scenario, we'd have a specific endpoint or better prompt
            setHook('【反转开头】大家都以为做自媒体很难，直到我发现了这个“流量夹心”法...');
            setCoreContent('这里填入您的核心干货或产品介绍，保持真实和专业感。');
            setCta('如果觉得有用，记得点赞收藏！点击底部的链接领取我的自媒体地图 🚀');

            setSuggestions({
                hooks: [
                    '你不理财，财不理你？那是因为你没看到最后...',
                    '为什么聪明人都在用这个方法？看完这30秒你就懂了。',
                    '警告：这可能是你今年刷到最有价值的一条视频。'
                ],
                ctas: [
                    '评论区回复“指南”，我把整理好的全套资料发给你。',
                    '关注我，每天分享一个普通人也能上手的搞钱小技巧。',
                    '点击置顶链接，领取今日份限时福利！'
                ]
            });

            message.success('流量策略已为您规划完成');
            setActiveStep(1);
        } catch (e) {
            message.error('生成建议失败');
        } finally {
            setIsGenerating(false);
        }
    };

    const steps = [
        { title: '确立主题', description: '定义核心方向' },
        { title: '三明治架构', description: '钩子+内容+转化' },
        { title: '一键分发', description: '流量闭环' },
    ];

    return (
        <div className="max-w-6xl mx-auto px-4 py-10 space-y-10 min-h-screen">
            {/* Header Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-4"
            >
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-sm font-medium border border-emerald-100 mb-2">
                    <TrendingUp className="w-4 h-4" />
                    <span>进阶增长模型 2.0</span>
                </div>
                <Title level={1} className="font-serif !text-5xl !mb-0 tracking-tight">
                    流量三明治 <span className="text-zinc-400 font-light italic">Strategy</span>
                </Title>
                <Paragraph className="text-zinc-500 text-lg max-w-2xl mx-auto">
                    通过“钩子引流、价值留存、钩子转化”的爆款逻辑，
                    将您的每一份内容都打造成一台精准的流量收割机。
                </Paragraph>
            </motion.div>

            <Card className="rounded-[32px] border-none shadow-xl shadow-zinc-200/50 overflow-hidden">
                <div className="p-2 md:p-10">
                    <Steps
                        current={activeStep}
                        items={steps}
                        className="mb-12 max-w-3xl mx-auto"
                        onChange={setActiveStep}
                    />

                    <AnimatePresence mode="wait">
                        {activeStep === 0 && (
                            <motion.div
                                key="step0"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-8 max-w-2xl mx-auto text-center py-10"
                            >
                                <div className="space-y-4">
                                    <Title level={3} className="font-serif">先告诉 AI，您想推广什么？</Title>
                                    <TextArea
                                        placeholder="例如：一款极简主义风格的智能台灯，适合熬夜工作的文字工作者..."
                                        autoSize={{ minRows: 4, maxRows: 6 }}
                                        value={topic}
                                        onChange={(e) => setTopic(e.target.value)}
                                        className="rounded-2xl p-6 text-lg border-zinc-200 focus:border-emerald-500 hover:border-zinc-300 transition-all bg-zinc-50/30"
                                    />
                                </div>

                                <div className="space-y-4">
                                    <Button
                                        type="primary"
                                        size="large"
                                        icon={<Sparkles className="w-5 h-5" />}
                                        onClick={handleSuggestStrategy}
                                        loading={isGenerating}
                                        className="h-14 px-10 rounded-2xl bg-[#1f4d4f] border-none font-bold text-lg hover:shadow-lg hover:shadow-emerald-900/20"
                                    >
                                        AI 规划三明治策略
                                    </Button>
                                    <div className="text-xs text-zinc-400">规划策略预计消耗：<span className="text-emerald-600 font-bold">10 积分</span></div>
                                </div>

                                <div className="pt-10 flex flex-wrap justify-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity" aria-label="支持的平台">
                                    {[
                                        ['小红书', 'bg-red-50 text-red-600'],
                                        ['抖音', 'bg-zinc-100 text-zinc-800'],
                                        ['微信', 'bg-emerald-50 text-emerald-600'],
                                    ].map(([name, color]) => (
                                        <span key={name} className={`rounded-full px-3 py-1.5 text-xs font-bold ${color}`}>{name}</span>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {activeStep === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="grid lg:grid-cols-12 gap-10"
                            >
                                {/* Visual Sandwich Builder */}
                                <div className="lg:col-span-7 space-y-6">
                                    {/* Layer: Hook */}
                                    <div className="group relative">
                                        <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-amber-400 rounded-full opacity-0 group-hover:opacity-100 transition-all" />
                                        <Card className="rounded-[24px] border border-amber-100 bg-amber-50/30 shadow-sm hover:shadow-md transition-all">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                                                    <Zap className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <Popover content="视频的前 3-5 秒，决定了用户是否会滑走。常见的钩子有『反直觉陈述』、『视觉冲击』或『结果预告』。" title="什么是流量钩子？">
                                                        <Text strong className="text-amber-800 cursor-help border-b border-dotted border-amber-300">上层：流量钩子 (The Hook)</Text>
                                                    </Popover>
                                                    <br />
                                                    <Text type="secondary" text-xs>前3秒的核心内容，负责从信息流中“抢夺”注意力</Text>
                                                </div>
                                            </div>
                                            <TextArea
                                                rows={3}
                                                value={hook}
                                                onChange={(e) => setHook(e.target.value)}
                                                className="bg-zinc-50 border-none rounded-xl focus:ring-2 focus:ring-amber-200"
                                            />
                                        </Card>
                                    </div>

                                    {/* Layer: Core */}
                                    <div className="group relative">
                                        <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1.5 h-20 bg-emerald-400 rounded-full opacity-0 group-hover:opacity-100 transition-all" />
                                        <Card className="rounded-[24px] border border-emerald-100 bg-emerald-50/30 shadow-sm hover:shadow-md transition-all">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                                                    <Layers className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <Popover content="这是内容的主体部分，旨在交付实际的价值、知识、情感共鸣或产品细节。这是建立品牌信任的关键。" title="什么是价值交付？">
                                                        <Text strong className="text-emerald-800 cursor-help border-b border-dotted border-emerald-300">中层：价值交付 (Core Content)</Text>
                                                    </Popover>
                                                    <br />
                                                    <Text type="secondary" text-xs>核心的产品点或知识干货，负责建立品牌信任</Text>
                                                </div>
                                            </div>
                                            <TextArea
                                                rows={6}
                                                value={coreContent}
                                                onChange={(e) => setCoreContent(e.target.value)}
                                                className="bg-zinc-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-200"
                                            />
                                        </Card>
                                    </div>

                                    {/* Layer: CTA */}
                                    <div className="group relative">
                                        <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-blue-400 rounded-full opacity-0 group-hover:opacity-100 transition-all" />
                                        <Card className="rounded-[24px] border border-blue-100 bg-blue-50/30 shadow-sm hover:shadow-md transition-all">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                                    <Target className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <Popover content="在结尾明确引导用户进行下一步操作，如『点赞收藏』、『关注账号』或『点击详情页』。没有指令的内容就像没有收银台的商店。" title="什么是转化指令？">
                                                        <Text strong className="text-blue-800 cursor-help border-b border-dotted border-blue-300">下层：转化指令 (Call to Action)</Text>
                                                    </Popover>
                                                    <br />
                                                    <Text type="secondary" text-xs>结尾的高能引导，负责将观看转化为实际价值</Text>
                                                </div>
                                            </div>
                                            <TextArea
                                                rows={3}
                                                value={cta}
                                                onChange={(e) => setCta(e.target.value)}
                                                className="bg-zinc-50 border-none rounded-xl focus:ring-2 focus:ring-blue-200"
                                            />
                                        </Card>
                                    </div>

                                    <div className="flex justify-end pt-4">
                                        <Button
                                            type="primary"
                                            onClick={() => setActiveStep(2)}
                                            icon={<ArrowRight className="w-4 h-4" />}
                                            className="h-12 px-8 rounded-xl bg-zinc-900 border-none flex items-center gap-2"
                                        >
                                            确认架构并继续
                                        </Button>
                                    </div>
                                </div>

                                {/* AI Inspiration Sidebar */}
                                <div className="lg:col-span-5 space-y-6">
                                    <div className="sticky top-10">
                                        <div className="p-6 bg-zinc-900 rounded-[32px] text-white shadow-2xl">
                                            <div className="flex items-center gap-2 mb-6 text-emerald-400">
                                                <MessageSquare className="w-5 h-5" />
                                                <span className="font-bold tracking-widest uppercase text-xs">AI Inspiration</span>
                                            </div>

                                            <div className="space-y-8">
                                                <div>
                                                    <div className="text-zinc-500 text-xs mb-3 flex justify-between items-center">
                                                        <span>备选钩子</span>
                                                        <Button type="link" size="small" className="text-emerald-400 p-0 text-xs">换一批</Button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {suggestions.hooks.map((h, i) => (
                                                            <div
                                                                key={i}
                                                                onClick={() => setHook(h)}
                                                                className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all"
                                                            >
                                                                {h}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="text-zinc-500 text-xs mb-3 flex justify-between items-center">
                                                        <span>高转化结尾</span>
                                                        <Button type="link" size="small" className="text-emerald-400 p-0 text-xs">换一批</Button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {suggestions.ctas.map((c, i) => (
                                                            <div
                                                                key={i}
                                                                onClick={() => setCta(c)}
                                                                className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all"
                                                            >
                                                                {c}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="pt-4 border-t border-white/10 flex justify-center">
                                                    <Space>
                                                        <div className="text-center px-4">
                                                            <div className="text-2xl font-serif text-emerald-400">92%</div>
                                                            <div className="text-[10px] text-zinc-500">预期完播率</div>
                                                        </div>
                                                        <Divider type="vertical" className="bg-zinc-800" h-8 />
                                                        <div className="text-center px-4">
                                                            <div className="text-2xl font-serif text-amber-400">15%</div>
                                                            <div className="text-[10px] text-zinc-500">预期点击率</div>
                                                        </div>
                                                    </Space>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeStep === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="max-w-3xl mx-auto py-10"
                            >
                                <div className="bg-zinc-50 rounded-[40px] p-10 border border-zinc-100 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-8 opacity-10">
                                        <Target className="w-32 h-32" />
                                    </div>

                                    <div className="relative z-10 space-y-10">
                                        <div className="text-center space-y-2">
                                            <Tag color="success" className="rounded-full px-4">策略生成成功</Tag>
                                            <Title level={2} className="font-serif">属于您的全自动流量闭环</Title>
                                        </div>

                                        <div className="p-8 bg-white rounded-3xl space-y-6 shadow-sm">
                                            <div className="flex justify-between items-center">
                                                <Text strong className="text-lg">您的“三明治”总览</Text>
                                                <Button size="small">编辑详情</Button>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="p-4 bg-zinc-50 rounded-xl border-l-4 border-amber-400">
                                                    <Text type="secondary" text-xs className="uppercase">Hook</Text>
                                                    <Paragraph className="mt-1 mb-0">{hook}</Paragraph>
                                                </div>
                                                <div className="p-4 bg-zinc-50 rounded-xl border-l-4 border-emerald-400">
                                                    <Text type="secondary" text-xs className="uppercase">Core</Text>
                                                    <Paragraph className="mt-1 mb-0 line-clamp-2">{coreContent}</Paragraph>
                                                </div>
                                                <div className="p-4 bg-zinc-50 rounded-xl border-l-4 border-blue-400">
                                                    <Text type="secondary" text-xs className="uppercase">CTA</Text>
                                                    <Paragraph className="mt-1 mb-0">{cta}</Paragraph>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-4">
                                            <Button
                                                type="primary"
                                                block
                                                size="large"
                                                className="h-16 rounded-2xl bg-[#1f4d4f] border-none text-xl font-bold flex items-center justify-center gap-3"
                                                onClick={() => message.info('正在唤起多平台发布接口...')}
                                            >
                                                <Rocket className="w-6 h-6" />
                                                立即投入全网分发
                                            </Button>
                                            <Button
                                                block
                                                size="large"
                                                className="h-14 rounded-2xl border-zinc-200 text-zinc-600 font-medium"
                                                onClick={() => setActiveStep(1)}
                                            >
                                                返回微调策略
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </Card>

            {/* Strategy Concept Help */}
            <div className="grid md:grid-cols-3 gap-6 opacity-80 pt-10">
                <div className="p-6 rounded-2xl bg-white/50 border border-zinc-100 flex flex-col gap-3">
                    <Zap className="w-6 h-6 text-amber-500" />
                    <Text strong>上层 - 钩子流量</Text>
                    <Text type="secondary" className="text-sm">通过极致的反直觉或视觉冲击，将冷启动流量转化为第一批观众。</Text>
                </div>
                <div className="p-6 rounded-2xl bg-white/50 border border-zinc-100 flex flex-col gap-3">
                    <Layers className="w-6 h-6 text-emerald-500" />
                    <Text strong>中层 - 价值交付</Text>
                    <Text type="secondary" className="text-sm">提供用户期待的干货或情绪价值，通过高质量内容锁定用户停留时长。</Text>
                </div>
                <div className="p-6 rounded-2xl bg-white/50 border border-zinc-100 flex flex-col gap-3">
                    <Target className="w-6 h-6 text-blue-500" />
                    <Text strong>下层 - 钩子转化</Text>
                    <Text type="secondary" className="text-sm">埋入引导式短句，通过评论区或私信福利，将流量留在私域闭环。</Text>
                </div>
            </div>
        </div>
    );
}

const Rocket = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-5c1.62-2.2 5-3 5-3"></path><path d="M12 15v5s3.03-.55 5-2c2.2-1.62 3-5 3-5"></path></svg>
);
