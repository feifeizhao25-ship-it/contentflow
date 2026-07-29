'use client';

import React, { useState, useEffect } from 'react';
import { Button, Card, Tag, Modal, Form, Input, Select, message, Empty, Steps, Divider, Space, Badge, Tooltip, Avatar, Alert, Statistic, Typography, Tabs } from 'antd';
import { ThunderboltFilled, PictureOutlined, CalendarOutlined, SaveOutlined, SettingOutlined, UserOutlined, ClockCircleOutlined, GlobalOutlined, EyeOutlined, RocketOutlined, LoadingOutlined, CheckCircleOutlined, DeleteOutlined, InfoCircleOutlined, WalletOutlined, FileTextOutlined, AppstoreOutlined, EditOutlined, ExperimentOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { TiptapEditor } from '@/components/editor/TiptapEditor';
import { aiService, falImageService } from '@/lib/ai-service';
import { usePointsStore } from '@/store/pointsStore';
import { useRouter, useSearchParams } from 'next/navigation';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import clsx from 'clsx';
import { ApiClientError } from '@/lib/api-client';
import type { AIGenerationResult } from '@/lib/ai-service';

dayjs.extend(relativeTime);

const { Title } = Typography;
const { TextArea } = Input;

const PLATFORMS = [
    { id: 'xhs', name: '小红书', icon: '📕', color: '#ff2442' },
    { id: 'douyin', name: '抖音', icon: '🎵', color: '#1a1a1a' },
    { id: 'weixin', name: '视频号', icon: '💬', color: '#07c160' },
];

export default function CreateCenterPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { balance, addPoints, spendPoints } = usePointsStore();

    // Tab state based on query param
    const initialTab = searchParams.get('tab') || 'create';
    const [activeTab, setActiveTab] = useState(initialTab);

    // Business Logic State
    const [topic, setTopic] = useState('');
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['xhs']);
    const [selectedPersona, setSelectedPersona] = useState<any>(null);

    // Result State
    const [mainTitle, setMainTitle] = useState('');
    const [script, setScript] = useState('');
    const [coverUrl, setCoverUrl] = useState('');
    const [titles, setTitles] = useState<string[]>([]);
    const [generationMeta, setGenerationMeta] = useState<Pick<
        AIGenerationResult,
        'provenance' | 'sources' | 'quality' | 'disclaimer'
    > | null>(null);

    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && tab !== activeTab) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    useEffect(() => {
        const stored = localStorage.getItem('selected_persona');
        if (stored) {
            setSelectedPersona(JSON.parse(stored));
        }
    }, []);

    const handleGenerateContent = async () => {
        if (!topic) return message.warning('请输入您的选题灵感');
        if (balance < 5) return message.error('积分不足，建议生成需要 5 积分');

        setIsLoading(true);
        try {
            const res = await aiService.generateArticle({
                prompt: topic,
                style: selectedPersona?.tone_of_voice,
                personaId: selectedPersona?.id
            });

            setScript(res.content);
            setGenerationMeta(res);
            setMainTitle(topic);

            const titlesRes = await aiService.generateTitles(topic);
            setTitles(titlesRes);
            if (titlesRes.length > 0) setMainTitle(titlesRes[0]);

            spendPoints(5, 'content_generation', `生成关于 ${topic} 的内容`);
            message.success('创作成功，已扣除 5 积分');
        } catch (e: any) {
            if (e instanceof ApiClientError && e.status === 429) {
                Modal.confirm({
                    title: '今日生成额度已用完',
                    content: e.details.reason || '升级专业版可获得更多生成次数和高级能力。',
                    okText: '查看套餐',
                    cancelText: '稍后再说',
                    onOk: () => router.push(e.details.upgrade_url || '/billing/plans'),
                });
            } else {
                message.error(e.message || '生成内容失败，请稍后重试');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateImage = async () => {
        if (balance < 10) return message.error('积分不足，生图需要 10 积分');
        setIsGeneratingImage(true);
        try {
            const res = await falImageService.generateImage({
                prompt: `${topic}, for ${selectedPlatforms[0]} visual cover`,
                style: selectedPersona?.category === 'lifestyle' ? 'aesthetic' : 'professional'
            });
            setCoverUrl(res.url);
            spendPoints(10, 'image_generation', `为 ${topic} 生成封面`);
            message.success('封面已生成！');
        } catch (e) {
            message.error('封面生成失败');
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const handleSaveDraft = () => {
        if (!topic && !script) {
            message.warning('请先输入内容再保存草稿');
            return;
        }
        message.loading('正在保存草稿...');
        const currentTitle = mainTitle || '未命名草稿';

        const draft = {
            id: Date.now().toString(),
            title: currentTitle,
            content: script,
            topic,
            platforms: selectedPlatforms,
            coverUrl,
            savedAt: new Date().toISOString(),
        };
        const existingDrafts = JSON.parse(localStorage.getItem('content_drafts') || '[]');
        existingDrafts.unshift(draft);
        localStorage.setItem('content_drafts', JSON.stringify(existingDrafts));
        setTimeout(() => {
            message.success('草稿已保存！');
        }, 500);
    };

    const handleFinalPublish = () => {
        message.loading('正在同步到云端并进入分发队列...');
        setTimeout(() => {
            message.success('发布计划创建成功！');
            router.push('/publish');
        }, 1500);
    };

    // --- Renders ---

    const renderDraftsTab = () => {
        const drafts = JSON.parse(localStorage.getItem('content_drafts') || '[]');
        return (
            <div className="max-w-5xl mx-auto py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {drafts.length > 0 ? drafts.map((draft: any, index: number) => (
                        <div key={draft.id || index}
                            onClick={() => {
                                setTopic(draft.topic || '');
                                setMainTitle(draft.title || '');
                                setScript(draft.content || '');
                                setSelectedPlatforms(draft.platforms || ['xhs']);
                                setCoverUrl(draft.coverUrl || '');
                                setActiveTab('create');
                            }}
                            className="group relative bg-white dark:bg-zinc-900 rounded-3xl p-4 border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden"
                        >
                            <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 rounded-2xl mb-4 overflow-hidden relative">
                                {draft.coverUrl ? (
                                    <img src={draft.coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-300">
                                        <PictureOutlined className="text-3xl" />
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-bold shadow-sm">
                                    {dayjs(draft.savedAt).fromNow()}
                                </div>
                            </div>
                            <h3 className="font-bold text-lg mb-2 line-clamp-1 group-hover:text-indigo-500 transition-colors">{draft.title || '无标题'}</h3>
                            <p className="text-zinc-500 text-sm line-clamp-2 mb-4 h-10">{draft.content || '暂无内容...'}</p>
                            <div className="flex gap-2">
                                {draft.platforms?.map((p: string) => (
                                    <span key={p} className="text-xs px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">{PLATFORMS.find(x => x.id === p)?.name}</span>
                                ))}
                            </div>
                        </div>
                    )) : (
                        <div className="col-span-full py-20 text-center">
                            <Empty description="暂无草稿" />
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderTemplatesTab = () => (
        <div className="max-w-6xl mx-auto py-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {['小红书爆款', '抖音带货', '公众号文章', '朋友圈文案', '视频脚本', '产品测评', '干货分享', '情感共鸣'].map((name, i) => (
                    <div key={i}
                        onClick={() => {
                            setTopic(name);
                            setActiveTab('create');
                            message.info(`已载入模版: ${name}`);
                        }}
                        className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 hover:border-indigo-500/50 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                            {['📕', '🎵', '📝', '💭', '🎬', '⚖️', '🧠', '❤️'][i]}
                        </div>
                        <h3 className="font-bold text-lg mb-1">{name}</h3>
                        <p className="text-zinc-400 text-sm">点击快速使用</p>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderCreateTab = () => (
        <div className="max-w-[1800px] mx-auto grid grid-cols-12 gap-8 pb-20">
            {/* Left Column: Wizard Input */}
            <div className="col-span-12 lg:col-span-3 space-y-6">
                <div className="glass-card p-6 space-y-6 sticky top-24">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">1</div>
                            <span className="font-bold text-sm">关于什么？</span>
                        </div>
                        <TextArea
                            placeholder="输入你的灵感..."
                            value={topic}
                            onChange={e => setTopic(e.target.value)}
                            autoSize={{ minRows: 3, maxRows: 6 }}
                            className="!bg-zinc-50 dark:!bg-zinc-800/50 !border-none !rounded-xl text-base p-4 focus:ring-2 ring-indigo-500/20"
                        />
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">2</div>
                            <span className="font-bold text-sm">发到哪里？</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {PLATFORMS.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => setSelectedPlatforms(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                                    className={clsx(
                                        "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border",
                                        selectedPlatforms.includes(p.id)
                                            ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-500/30"
                                            : "bg-white dark:bg-zinc-800 border-transparent hover:bg-zinc-50"
                                    )}
                                >
                                    <span className="text-xl">{p.icon}</span>
                                    <span className={clsx("font-medium text-sm", selectedPlatforms.includes(p.id) ? "text-indigo-700 dark:text-indigo-300" : "text-zinc-600")}>{p.name}</span>
                                    {selectedPlatforms.includes(p.id) && <CheckCircleOutlined className="ml-auto text-indigo-500" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    <Button
                        type="primary"
                        block
                        size="large"
                        icon={<ExperimentOutlined />}
                        loading={isLoading}
                        onClick={handleGenerateContent}
                        className="h-12 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 border-none shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
                    >
                        AI 灵感生成 (5分)
                    </Button>
                </div>
            </div>

            {/* Middle Column: Editor (Focus) */}
            <div className="col-span-12 lg:col-span-6">
                <div className="glass-card min-h-[80vh] flex flex-col relative overflow-hidden">
                    {/* Editor Header */}
                    <div className="px-8 py-6 border-b border-zinc-100 dark:border-zinc-800/50 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur z-10">
                        <Input
                            value={mainTitle}
                            onChange={(e) => setMainTitle(e.target.value)}
                            placeholder="输入标题..."
                            className="text-2xl font-bold bg-transparent border-none p-0 focus:shadow-none placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
                        />
                        <div className="flex items-center gap-2">
                            <Tag color="green" className="border-0 bg-green-50 text-green-600 dark:bg-green-900/20">已保存</Tag>
                        </div>
                    </div>

                    {/* Editor Body */}
                    <div className="flex-1 p-8">
                        <TiptapEditor content={script} onChange={setScript} />
                    </div>

                    {/* Bottom Actions */}
                    <div className="p-4 border-t border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-between items-center backdrop-blur">
                        <div className="text-xs text-zinc-400">
                            字数统计: {script ? script.replace(/<[^>]+>/g, '').length : 0}
                        </div>
                        <div className="flex gap-3">
                            <Button onClick={handleSaveDraft} className="rounded-full px-6">存草稿</Button>
                            <Button type="primary" onClick={handleFinalPublish} className="rounded-full px-6 bg-black dark:bg-white dark:text-black">发布</Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Visuals & Tools */}
            <div className="col-span-12 lg:col-span-3 space-y-6">
                {/* Visual Cover Card */}
                <div className="glass-card p-4 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm">视觉封面</span>
                        <Button type="link" size="small" icon={<ThunderboltFilled />} onClick={handleGenerateImage} loading={isGeneratingImage}>AI 生成</Button>
                    </div>

                    <div className="aspect-[3/4] rounded-2xl bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden group border border-zinc-200 dark:border-zinc-700 border-dashed hover:border-solid hover:border-indigo-500 transition-all">
                        {coverUrl ? (
                            <>
                                <img src={coverUrl} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                                    <Button shape="circle" icon={<EyeOutlined />} className="border-none bg-white/20 text-white hover:bg-white hover:text-black" />
                                    <Button shape="circle" icon={<DeleteOutlined />} onClick={() => setCoverUrl('')} className="border-none bg-white/20 text-white hover:bg-red-500" />
                                </div>
                            </>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 gap-2 cursor-pointer" onClick={handleGenerateImage}>
                                <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xl">📸</div>
                                <span className="text-xs font-medium">点击生成封面</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* AI Suggestions */}
                {generationMeta?.quality && (
                    <div className="glass-card p-4" data-testid="quality-breakdown">
                        <div className="flex items-center justify-between mb-3">
                            <span className="font-bold text-sm">质量评分</span>
                            <span className="text-2xl font-black text-indigo-600">{generationMeta.quality.total}/100</span>
                        </div>
                        {[
                            ['准确性', generationMeta.quality.accuracy, 30],
                            ['专业性', generationMeta.quality.professionalism, 25],
                            ['平台适配', generationMeta.quality.platformFit, 20],
                            ['引用', generationMeta.quality.citation, 15],
                            ['安全合规', generationMeta.quality.safety, 10],
                        ].map(([label, value, max]) => (
                            <div key={String(label)} className="mb-2">
                                <div className="flex justify-between text-xs mb-1">
                                    <span>{label}</span><span>{value}/{max}</span>
                                </div>
                                <div className="h-1.5 rounded bg-zinc-200 overflow-hidden">
                                    <div className="h-full bg-indigo-500" style={{ width: `${Number(value) / Number(max) * 100}%` }} />
                                </div>
                            </div>
                        ))}
                        {generationMeta.quality.suggestions.length > 0 && (
                            <ul className="mt-3 text-xs text-amber-700 list-disc pl-4">
                                {generationMeta.quality.suggestions.map(item => <li key={item}>{item}</li>)}
                            </ul>
                        )}
                    </div>
                )}

                {generationMeta && (
                    <div className="glass-card p-4" data-testid="provenance-panel">
                        <Tag color={generationMeta.provenance === 'knowledge-assisted' ? 'blue' : 'gold'}>
                            {generationMeta.provenance === 'knowledge-assisted' ? '知识库辅助生成' : 'AI 生成内容'}
                        </Tag>
                        <p className="text-xs text-zinc-500 mt-3">{generationMeta.disclaimer}</p>
                        {(generationMeta.sources || []).map(source => (
                            <a key={source.url} href={source.url} target="_blank" rel="noreferrer"
                                className="block mt-2 text-xs text-indigo-600 hover:underline">
                                {source.publisher} · {source.title} · 核验于 {source.verifiedAt}
                            </a>
                        ))}
                    </div>
                )}

                {titles.length > 0 && (
                    <div className="glass-card p-4">
                        <div className="font-bold text-sm mb-4 flex items-center gap-2">
                            <RocketOutlined className="text-indigo-500" />
                            AI 标题建议
                        </div>
                        <div className="space-y-2">
                            {titles.map((t, i) => (
                                <div
                                    key={i}
                                    onClick={() => setMainTitle(t)}
                                    className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer text-sm text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 transition-colors"
                                >
                                    {t}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen p-6">
            <div className="max-w-[1800px] mx-auto mb-8 flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-black mb-1">
                        创作实验室 <Badge count="AI V2.0" style={{ backgroundColor: '#6366f1' }} />
                    </h1>
                    <p className="text-zinc-500 font-medium">从灵感到爆款，只需几秒钟</p>
                </div>
                <div className="flex gap-4">
                    <Tabs
                        activeKey={activeTab}
                        onChange={(k) => {
                            setActiveTab(k);
                            router.push(`/create${k !== 'create' ? `?tab=${k}` : ''}`);
                        }}
                        items={[
                            { label: '编辑器', key: 'create' },
                            { label: '草稿箱', key: 'drafts' },
                            { label: '模板库', key: 'templates' },
                        ]}
                        className="custom-tabs"
                    />
                </div>
            </div>

            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                {activeTab === 'create' && renderCreateTab()}
                {activeTab === 'drafts' && renderDraftsTab()}
                {activeTab === 'templates' && renderTemplatesTab()}
            </motion.div>

            <style jsx global>{`
                .custom-tabs .ant-tabs-nav::before { border-bottom: none !important; }
                .custom-tabs .ant-tabs-tab { 
                    padding: 8px 16px !important; 
                    background: transparent;
                    border-radius: 999px;
                    transition: all 0.3s;
                }
                .custom-tabs .ant-tabs-tab-active { 
                    background: #fff !important; 
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                }
                .dark .custom-tabs .ant-tabs-tab-active {
                    background: #27272a !important; /* Zinc 800 */
                }
                .custom-tabs .ant-tabs-ink-bar { display: none; }
                
                .ProseMirror { min-height: 400px; outline: none; font-size: 1.1rem; line-height: 1.75; color: inherit; }
                .ProseMirror p.is-editor-empty:first-child::before {
                    color: #adb5bd;
                    content: attr(data-placeholder);
                    float: left;
                    height: 0;
                    pointer-events: none;
                }
            `}</style>
        </div>
    );
}
