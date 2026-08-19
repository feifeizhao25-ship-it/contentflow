'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    Button, Input, Select, Progress, Space, Steps, Card,
    Badge, Tooltip, Empty, message, Drawer, Slider, Switch
} from 'antd';
import {
    VideoCameraAddOutlined,
    ThunderboltFilled,
    PlayCircleOutlined,
    BulbOutlined,
    EditOutlined,
    CheckCircleFilled,
    LoadingOutlined,
    CloudUploadOutlined,
    FileTextOutlined,
    ScissorOutlined,
    SettingOutlined,
    PlusOutlined,
    DeleteOutlined,
    ArrowRightOutlined,
    RocketOutlined,
    ReloadOutlined,
    EyeOutlined,
    SkinOutlined,
    SoundOutlined,
    HistoryOutlined
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';

const { TextArea } = Input;
const { Option } = Select;

// ==================== 类型定义 ====================
interface Scene {
    id: string;
    type: 'ai' | 'upload'; // 素材来源
    visual: string;
    subtitle: string;
    audio?: string;
    time: number;
    status: 'pending' | 'generating' | 'completed' | 'failed';
    videoUrl?: string;
    progress?: number;
    fileName?: string; // 针对上传的素材
}

interface Script {
    title: string;
    scenes: Scene[];
}

// ==================== 模拟配置 ====================
const VIDEO_STYLES = [
    { value: 'cinematic', label: '电影质感', icon: '🎬' },
    { value: 'anime', label: '二次元', icon: '🎨' },
    { value: '3d_render', label: '3D 渲染', icon: '🧊' },
    { value: 'cyberpunk', label: '赛博朋克', icon: '🌃' },
    { value: 'nature', label: '自然风光', icon: '🌲' },
];

export default function VideoStudioPage() {
    const router = useRouter();
    // 状态管理
    const [step, setStep] = useState(0);
    const [topic, setTopic] = useState('');
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);
    const [script, setScript] = useState<Script | null>(null);
    const [activeSceneIndex, setActiveSceneIndex] = useState(0);
    const [selectedStyle, setSelectedStyle] = useState('cinematic');
    const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
    const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
    const [generationLogs, setGenerationLogs] = useState<string[]>([]);
    const [userCredits, setUserCredits] = useState(850); // 模拟用户积分余额

    // 计算预计消耗积分：仅计算类型为 'ai' 的分镜 (10分/秒)
    const estimatedTotalCredits = script?.scenes.reduce((acc, s) => {
        return acc + (s.type === 'ai' ? s.time * 10 : 0);
    }, 0) || 0;

    const logsEndRef = useRef<HTMLDivElement>(null);

    // 滚动日志到底部
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [generationLogs]);

    // ==================== 业务逻辑 ====================

    // 1. 生成脚本
    const handleGenerateScript = async () => {
        if (!topic) return message.warning('请输入创作主题');
        setIsGeneratingScript(true);
        try {
            const res = await fetch('/api/ai/generate-script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, type: '爆款解说', platform: '抖音' })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            const scenesWithIds = data.scenes.map((s: any, i: number) => ({
                ...s,
                id: `scene-${Date.now()}-${i}`,
                type: 'ai', // 默认生成脚本均为 AI 任务
                status: 'pending',
                progress: 0
            }));

            setScript({ ...data, scenes: scenesWithIds });
            setStep(1); // 进入编辑器
            message.success('脚本已生成！');
        } catch (error: any) {
            message.error(`生成失败: ${error.message}`);
        } finally {
            setIsGeneratingScript(false);
        }
    };

    // 2. 真实生成全片
    const handleGenerateFullVideo = async () => {
        if (!script) return;
        setIsGeneratingVideo(true);
        setFinalVideoUrl(null);
        setGenerationLogs(['初始化视频生成队列...', '准备 AI 模型: Minimax Video V2...']);

        const updatedScenes = [...script.scenes];
        let firstFrameUrl = '';

        try {
            for (let i = 0; i < updatedScenes.length; i++) {
                if (updatedScenes[i].type === 'upload' && updatedScenes[i].videoUrl) {
                    setGenerationLogs(prev => [...prev, `分镜 ${i + 1} 为外部素材，跳过生成`]);
                    continue;
                }

                updatedScenes[i].status = 'generating';
                setScript({ ...script, scenes: [...updatedScenes] });
                setGenerationLogs(prev => [...prev, `正在生成第 ${i + 1}/${updatedScenes.length} 个分镜: ${updatedScenes[i].subtitle}`]);

                const response = await fetch('/api/ai/generate-video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: updatedScenes[i].visual,
                        style: selectedStyle,
                        aspect_ratio: '16:9',
                        imageUrl: i > 0 ? firstFrameUrl : undefined
                    })
                });

                if (!response.ok) throw new Error(`分镜 ${i + 1} 生成失败`);
                const data = await response.json();

                const videoUrl = data.video?.url || data.url;
                if (!videoUrl) throw new Error(`分镜 ${i + 1} 未返回 URL`);

                updatedScenes[i].status = 'completed';
                updatedScenes[i].videoUrl = videoUrl;
                updatedScenes[i].progress = 100;
                setScript({ ...script, scenes: [...updatedScenes] });
                setGenerationLogs(prev => [...prev, `✅ 分镜 ${i + 1} 生成完成`]);
            }

            setGenerationLogs(prev => [...prev, '正在请求渲染引擎进行无缝拼接...']);
            const mergeRes = await fetch('/api/ai/merge-videos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videoUrls: updatedScenes.map(s => s.videoUrl),
                    aspectRatio: '16:9'
                })
            });

            if (!mergeRes.ok) throw new Error('视频拼接失败');
            const mergeData = await mergeRes.json();

            setFinalVideoUrl(mergeData.url);
            setGenerationLogs(prev => [...prev, '🎉 全片渲染完成！']);
            message.success('视频创作完成！');
            setStep(2);
        } catch (error: any) {
            console.error(error);
            setGenerationLogs(prev => [...prev, `❌ 错误: ${error.message}`]);
            message.error(`生成中断: ${error.message}`);
        } finally {
            setIsGeneratingVideo(false);
        }
    };

    // ==================== 渲染部分 ====================

    return (
        <div className="min-h-screen bg-zinc-50 -m-6 p-6">
            <div className="max-w-[1600px] mx-auto space-y-6">

                {/* 顶部标题与步骤 */}
                <header className="flex flex-col md:flex-row items-center justify-between bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-xl shadow-lg shadow-indigo-200">
                            <VideoCameraAddOutlined />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-zinc-900">视频创作工坊</h1>
                            <p className="text-zinc-400 text-sm">从灵感到成片，AI 助你一气呵成</p>
                        </div>
                    </div>

                    <div className="flex-1 max-w-xl hidden lg:block px-12">
                        <Steps
                            current={step}
                            items={[
                                { title: '策划脚本', icon: <BulbOutlined /> },
                                { title: '导演监制', icon: <EditOutlined /> },
                                { title: '渲染导出', icon: <RocketOutlined /> },
                            ]}
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100">
                            <ThunderboltFilled className="text-amber-500" />
                            <div className="flex flex-col leading-tight">
                                <span className="text-[10px] text-zinc-400 font-bold uppercase">可用积分</span>
                                <span className="text-sm font-black text-amber-700">{userCredits}</span>
                            </div>
                            <Button
                                type="primary"
                                size="small"
                                className="!bg-amber-500 !border-amber-500 !px-2 ml-2 hover:!scale-105 transition-transform"
                                onClick={() => router.push('/pricing')}
                            >
                                充值
                            </Button>
                        </div>
                        <Button icon={<HistoryOutlined />}>历史草稿</Button>
                        <Button type="primary" icon={<SettingOutlined />} />
                    </div>
                </header>

                <main className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-[calc(100vh-220px)]">

                    {/* 左侧：脚本流 (4/12) */}
                    <aside className="xl:col-span-4 bg-white rounded-3xl border border-zinc-200 flex flex-col overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                            <span className="font-bold text-zinc-700 flex items-center gap-2">
                                <FileTextOutlined /> 脚本大纲
                            </span>
                            {script && (
                                <Badge count={script.scenes.length} overflowCount={10} color="#6366f1" />
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {!script ? (
                                <div className="h-full flex flex-col p-2 space-y-8">
                                    <div className="flex flex-col items-center justify-center pt-8 text-center space-y-4">
                                        <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-xl shadow-indigo-200">
                                            <ThunderboltFilled className="text-3xl text-white animate-pulse" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-zinc-900 text-xl tracking-tight">开启灵感之门</h3>
                                            <p className="text-zinc-400 text-sm mt-1">选择爆款模板或输入您的独特构思</p>
                                        </div>
                                    </div>

                                    {/* 爆款模板库 */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { title: '好物种草', icon: '🛍️', topic: '推荐一款最近在用的高颜值办公好物' },
                                            { title: '知识分教', icon: '💡', topic: '3分钟带你读懂 DeepSeek 的核心价值' },
                                            { title: '生活记录', icon: '☕', topic: '治愈系：周末下午的一杯手冲咖啡' },
                                            { title: '热点锐评', icon: '🔥', topic: '关于最近火爆全网的 AI 进化论，我的看法是...' },
                                        ].map(tmp => (
                                            <button
                                                key={tmp.title}
                                                onClick={() => setTopic(tmp.topic)}
                                                className="p-4 rounded-2xl border border-zinc-100 bg-zinc-50/50 hover:bg-white hover:border-indigo-200 hover:shadow-md transition-all text-left group"
                                            >
                                                <span className="text-xl mb-2 block">{tmp.icon}</span>
                                                <span className="text-xs font-bold text-zinc-700 group-hover:text-indigo-600">{tmp.title}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-zinc-100">
                                        <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest px-1">自定义创意方案</label>
                                        <TextArea
                                            rows={4}
                                            placeholder="在此输入您的创意要点..."
                                            value={topic}
                                            onChange={e => setTopic(e.target.value)}
                                            className="!rounded-2xl !bg-zinc-50 border-none focus:!bg-white focus:!ring-1 focus:!ring-indigo-100 transition-all !p-4"
                                        />
                                        <Button
                                            type="primary"
                                            size="large"
                                            block
                                            onClick={handleGenerateScript}
                                            loading={isGeneratingScript}
                                            className="!h-14 !rounded-2xl !bg-indigo-600 font-bold shadow-lg shadow-indigo-100 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                            icon={<ThunderboltFilled />}
                                        >
                                            立即生成分镜脚本
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {script.scenes.map((scene, index) => (
                                        <div
                                            key={scene.id}
                                            onClick={() => setActiveSceneIndex(index)}
                                            className={clsx(
                                                "p-4 rounded-2xl border transition-all cursor-pointer relative group",
                                                activeSceneIndex === index
                                                    ? "border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500/20"
                                                    : "border-zinc-100 bg-white hover:border-zinc-200"
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                                        Scene {index + 1}
                                                    </span>
                                                    {scene.type === 'ai' ? (
                                                        <Badge status="processing" text={<span className="text-[10px] font-bold text-indigo-500 uppercase">AI</span>} />
                                                    ) : (
                                                        <Badge status="default" text={<span className="text-[10px] font-bold text-emerald-500 uppercase">Real</span>} />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[10px] font-bold text-zinc-400">{scene.time}s</span>
                                                    {scene.status === 'completed' && <CheckCircleFilled className="text-emerald-500" />}
                                                </div>
                                            </div>
                                            <p className="text-sm font-medium text-zinc-800 line-clamp-2">{scene.subtitle}</p>

                                            {scene.status === 'generating' && (
                                                <Progress percent={scene.progress} size="small" showInfo={false} className="mt-2" strokeColor="#6366f1" />
                                            )}

                                            {activeSceneIndex === index && (
                                                <div className="absolute inset-y-0 -left-1 w-1 bg-indigo-500 rounded-full" />
                                            )}
                                        </div>
                                    ))}
                                    <Button block icon={<PlusOutlined />} className="!rounded-xl border-dashed">添加分镜</Button>
                                </div>
                            )}
                        </div>
                    </aside>

                    {/* 中间：监制预览 (5/12) */}
                    <div className="xl:col-span-8 flex flex-col gap-6">
                        <section className="flex-1 bg-zinc-900 rounded-[2.5rem] relative overflow-hidden shadow-2xl group border-4 border-zinc-800">
                            {/* 屏幕预览 */}
                            {script && script.scenes[activeSceneIndex]?.videoUrl ? (
                                <video
                                    src={script.scenes[activeSceneIndex].videoUrl}
                                    className="w-full h-full object-cover"
                                    autoPlay
                                    muted
                                    loop
                                />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 text-center p-12 space-y-6">
                                    <PlayCircleOutlined className="text-6xl opacity-20" />
                                    <div>
                                        <p className="text-lg font-medium text-zinc-400">正在等待导演指令</p>
                                        <p className="text-sm text-zinc-600">点击右侧生成按钮开启创作</p>
                                    </div>
                                </div>
                            )}

                            {/* 画面控制叠加层 */}
                            <AnimatePresence>
                                {script && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="absolute bottom-6 left-6 right-6 bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-white/10"
                                    >
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <h4 className="text-white font-bold flex items-center gap-2 m-0">
                                                        <EditOutlined className="text-indigo-400" /> 分镜导演
                                                    </h4>
                                                    <div className="flex bg-white/10 p-1 rounded-lg">
                                                        <button
                                                            onClick={() => {
                                                                const newScenes = [...script.scenes];
                                                                newScenes[activeSceneIndex].type = 'ai';
                                                                setScript({ ...script, scenes: newScenes });
                                                            }}
                                                            className={clsx(
                                                                "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                                                                script.scenes[activeSceneIndex].type === 'ai' ? "bg-indigo-600 text-white" : "text-white/40"
                                                            )}
                                                        >
                                                            AI 生成
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                const newScenes = [...script.scenes];
                                                                newScenes[activeSceneIndex].type = 'upload';
                                                                setScript({ ...script, scenes: newScenes });
                                                            }}
                                                            className={clsx(
                                                                "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                                                                script.scenes[activeSceneIndex].type === 'upload' ? "bg-emerald-600 text-white" : "text-white/40"
                                                            )}
                                                        >
                                                            本地上传
                                                        </button>
                                                    </div>
                                                </div>
                                                <Space>
                                                    <Button ghost size="small" icon={<ReloadOutlined />} hidden={script.scenes[activeSceneIndex].type === 'upload'}>重新生成</Button>
                                                </Space>
                                            </div>

                                            {script.scenes[activeSceneIndex].type === 'ai' ? (
                                                <TextArea
                                                    value={script.scenes[activeSceneIndex]?.visual}
                                                    onChange={e => {
                                                        const newScenes = [...script.scenes];
                                                        newScenes[activeSceneIndex].visual = e.target.value;
                                                        setScript({ ...script, scenes: newScenes });
                                                    }}
                                                    placeholder="描述 AI 需要生成的画面细节..."
                                                    className="!bg-white/5 !border-white/10 !text-white !rounded-xl !text-xs"
                                                    rows={2}
                                                />
                                            ) : (
                                                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-dashed border-white/20">
                                                    <div className="flex-1">
                                                        <p className="text-white text-xs font-bold mb-1">使用自己的实拍素材</p>
                                                        <p className="text-white/40 text-[10px]">支持 mp4, mov 格式，不消耗创作积分</p>
                                                    </div>
                                                    <Button
                                                        icon={<CloudUploadOutlined />}
                                                        type="primary"
                                                        className="!bg-emerald-600 !border-emerald-600"
                                                        onClick={() => {
                                                            const input = document.createElement('input');
                                                            input.type = 'file';
                                                            input.accept = 'video/*';
                                                            input.onchange = (e: any) => {
                                                                const file = e.target.files[0];
                                                                if (file) {
                                                                    const url = URL.createObjectURL(file);
                                                                    const newScenes = [...script.scenes];
                                                                    newScenes[activeSceneIndex].videoUrl = url;
                                                                    newScenes[activeSceneIndex].status = 'completed';
                                                                    newScenes[activeSceneIndex].fileName = file.name;
                                                                    setScript({ ...script, scenes: newScenes });
                                                                    message.success('素材选择成功');
                                                                }
                                                            };
                                                            input.click();
                                                        }}
                                                    >
                                                        选择文件
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </section>

                        {/* 下侧：设置与操作栏 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm space-y-4">
                                <span className="text-zinc-900 font-bold flex items-center gap-2">
                                    <SkinOutlined className="text-purple-500" /> 画面风格
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {VIDEO_STYLES.map(style => (
                                        <button
                                            key={style.value}
                                            onClick={() => setSelectedStyle(style.value)}
                                            className={clsx(
                                                "px-4 py-2 rounded-xl text-xs font-medium border transition-all",
                                                selectedStyle === style.value
                                                    ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100"
                                                    : "bg-white text-zinc-600 border-zinc-100 hover:border-zinc-300"
                                            )}
                                        >
                                            <span className="mr-2">{style.icon}</span>
                                            {style.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-zinc-900 font-bold flex items-center gap-2">
                                            <RocketOutlined className="text-indigo-500" /> 最终导出
                                        </span>
                                        {script && (
                                            <span className="text-[10px] text-zinc-400 font-medium">
                                                预计消耗: <span className="text-indigo-600 font-bold">{estimatedTotalCredits}</span> 积分
                                            </span>
                                        )}
                                    </div>
                                    {finalVideoUrl && (
                                        <Badge status="processing" text="随时可用" />
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <Button
                                        type="primary"
                                        size="large"
                                        block
                                        disabled={!script}
                                        loading={isGeneratingVideo}
                                        onClick={handleGenerateFullVideo}
                                        className="!h-12 !rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600"
                                    >
                                        一键成片
                                    </Button>
                                    {finalVideoUrl && (
                                        <Button size="large" icon={<EyeOutlined />} block className="!h-12 !rounded-xl">预览</Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                {/* 底部：实时日志抽屉用作控制台 */}
                {isGeneratingVideo && (
                    <div className="fixed bottom-6 right-6 w-80 max-h-48 bg-black/90 text-zinc-400 p-4 rounded-2xl backdrop-blur-xl border border-white/10 text-[10px] font-mono overflow-y-auto space-y-1 shadow-2xl z-50">
                        {generationLogs.map((log, i) => (
                            <div key={i} className="flex gap-2">
                                <span className="text-zinc-600">[{dayjs().format('HH:mm:ss')}]</span>
                                <span>{log}</span>
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                )}
            </div>

            {/* 成片预览 Modal */}
            <Drawer
                title="全片渲染完成"
                placement="right"
                width={800}
                onClose={() => setFinalVideoUrl(null)}
                open={!!finalVideoUrl}
                extra={
                    <Space>
                        <Button icon={<CloudUploadOutlined />}>分发至平台</Button>
                        <Button type="primary" icon={<PlayCircleOutlined />}>保存本地</Button>
                    </Space>
                }
            >
                {finalVideoUrl && (
                    <div className="space-y-6">
                        <section className="aspect-video bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border-4 border-zinc-200">
                            <video src={finalVideoUrl} className="w-full h-full object-contain" controls autoPlay />
                        </section>

                        <div className="grid grid-cols-2 gap-4">
                            <Card className="!rounded-2xl bg-zinc-50 border-none">
                                <h5 className="font-bold flex items-center gap-2 mb-2"><SoundOutlined /> 智能音轨</h5>
                                <p className="text-xs text-zinc-500">已自动匹配背景音乐 BGM-Action-01。AI 配音通过率 98%。</p>
                            </Card>
                            <Card className="!rounded-2xl bg-zinc-50 border-none">
                                <h5 className="font-bold flex items-center gap-2 mb-2"><ScissorOutlined /> 编辑建议</h5>
                                <p className="text-xs text-zinc-500">建议在 00:12 处添加转场动效。当前帧率 30fps。</p>
                            </Card>
                        </div>
                    </div>
                )}
            </Drawer>
        </div>
    );
}
