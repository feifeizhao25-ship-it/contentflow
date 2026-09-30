'use client';

import React, { useState, useEffect } from 'react';
import { FireFilled, ThunderboltFilled, ArrowRightOutlined, SearchOutlined, ClockCircleOutlined, RiseOutlined, LoadingOutlined, AreaChartOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Input, Button, Tag, Empty, Card, Modal, Row, Col, Space, message, Typography, List, Divider } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/lib/api-client';
import { parseHotTopics } from '@/lib/page-data';
import { safeErrorText } from '@/lib/api-error';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

interface HotTopic {
    id: string;
    title: string;
    heat: number;
    platform: string;
    prediction: 'rising' | 'stable' | 'falling';
    tags: string[];
}

export default function HotPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('all');
    const [hotTopics, setHotTopics] = useState<HotTopic[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showAnalyzer, setShowAnalyzer] = useState(false);
    const [analysisInput, setAnalysisInput] = useState('');
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        fetchHotTopics();
    }, [activeTab]);

    const [notice, setNotice] = useState('');

    const fetchHotTopics = async () => {
        setIsLoading(true);
        try {
            // 真实路由是 GET /hot/list。没有数据源就如实显示原因，不再用写死的「热点」兜底。
            const query = activeTab === 'all' ? '' : `?platform=${encodeURIComponent(activeTab)}`;
            const res = await apiClient.get<any>(`/hot/list${query}`);
            const parsed = parseHotTopics(res);
            setHotTopics(parsed.topics);
            setNotice(parsed.notice);
        } catch (error) {
            setHotTopics([]);
            setNotice(safeErrorText(error, '热点加载失败，请稍后重试'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnalyze = async () => {
        if (!analysisInput) return;
        setIsAnalyzing(true);
        try {
            const res = await apiClient.post<any>('/ai/analyze/viral', { content: analysisInput });
            // 同上：需先解包 TransformInterceptor 的信封
            setAnalysisResult(res?.data?.analysis ?? res?.analysis);
        } catch (e) {
            message.error(safeErrorText(e, '分析失败，请稍后重试'));
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-12">
            <div className="bg-zinc-900 rounded-[40px] p-10 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
                <div className="max-w-2xl relative z-10">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <Tag color="orange" className="mb-4 bg-orange-600 border-none font-bold px-3">BETA 爆款预测 V2.0</Tag>
                        <h1 className="text-4xl md:text-5xl font-black mb-4">捕捉风口，让每一条内容都有成为爆款的潜力</h1>
                        <p className="text-zinc-400 text-lg mb-8">接入合规授权的热点数据后，为您提供有据可依的选题灵感；目前可以用「AI 爆款拆解」分析您手上的爆款内容。</p>
                        <div className="flex gap-4">
                            <Button size="large" icon={<ThunderboltOutlined />} onClick={() => setShowAnalyzer(true)} className="h-14 px-8 rounded-2xl bg-white text-zinc-900 border-none font-bold hover:scale-105 transition-all">AI 爆款拆解</Button>
                        </div>
                    </motion.div>
                </div>
            </div>

            {!isLoading && hotTopics.length === 0 && (
                <div className="rounded-3xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500">
                    {notice || '暂时没有可用的热点数据'}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {isLoading ? [1, 2, 3, 4].map(i => <div key={i} className="h-64 bg-zinc-100 animate-pulse rounded-3xl" />) :
                    hotTopics.map((topic, idx) => (
                        <motion.div key={topic.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.1 }}>
                            <Card className="rounded-[32px] border-none shadow-sm hover:shadow-xl transition-all cursor-pointer group hover:-translate-y-2 bg-gradient-to-br from-white to-zinc-50" styles={{ body: { padding: '24px' } }}>
                                <div className="flex justify-between mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-xl">
                                        {topic.platform === 'xhs' ? '📕' : topic.platform === 'douyin' ? '🎵' : '💬'}
                                    </div>
                                    <Tag color={topic.prediction === 'rising' ? 'red' : 'blue'} className="m-0 border-none font-bold px-2 rounded-lg">{topic.prediction === 'rising' ? '🔥 飙升' : '⚡ 推荐'}</Tag>
                                </div>
                                <h3 className="text-lg font-black text-zinc-800 mb-4 line-clamp-2 h-14">{topic.title}</h3>
                                <div className="flex items-center justify-between mt-auto">
                                    <div className="text-zinc-400 text-xs font-bold"><AreaChartOutlined /> {Math.round(topic.heat / 1000)}k 指数</div>
                                    <Button shape="circle" icon={<ArrowRightOutlined />} onClick={() => router.push(`/create?topic=${encodeURIComponent(topic.title)}`)} className="bg-zinc-900 border-none text-white transition-transform" />
                                </div>
                            </Card>
                        </motion.div>
                    ))}
            </div>

            <Modal title={null} open={showAnalyzer} footer={null} onCancel={() => { setShowAnalyzer(false); setAnalysisResult(null); }} width={800} centered>
                <div className="p-4 space-y-6">
                    <Title level={3}>AI 爆款内容拆解</Title>
                    <TextArea rows={6} value={analysisInput} onChange={e => setAnalysisInput(e.target.value)} placeholder="粘贴爆款内容原文..." className="rounded-2xl border-zinc-200 bg-zinc-50 p-4 focus:bg-white transition-all text-lg" />
                    <Button type="primary" block size="large" onClick={handleAnalyze} loading={isAnalyzing} icon={<ThunderboltFilled />} className="h-16 rounded-2xl bg-indigo-600 font-bold text-lg">一键拆解</Button>
                    <AnimatePresence>
                        {analysisResult && (
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 bg-indigo-50/50 rounded-[32px] p-8 border border-indigo-100">
                                <Title level={4}><RiseOutlined /> 深度解构报告</Title>
                                <Divider />
                                <div className="flex gap-4">
                                    <Button type="primary" onClick={() => router.push(`/create?source_analysis=${encodeURIComponent(JSON.stringify(analysisResult))}`)} className="h-12 px-8 rounded-xl bg-indigo-600">按此模板创作</Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </Modal>
        </div>
    );
}
