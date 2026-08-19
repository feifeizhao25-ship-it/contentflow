'use client';

import React, { useState } from 'react';
import { Button, Card, Tag, Modal, message, Empty, Badge, Progress } from 'antd';
import {
    GiftOutlined,
    ThunderboltOutlined,
    CloudOutlined,
    CrownOutlined,
    CheckCircleOutlined,
    CloseOutlined,
    InfoCircleOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { usePointsStore, REWARDS } from '@/store/pointsStore';
import { useThemeStore } from '@/store/themeStore';
import clsx from 'clsx';

export default function PointsPage() {
    const { balance, spendPoints, addPoints, getLevelProgress } = usePointsStore();
    const { isDark } = useThemeStore();
    const [selectedReward, setSelectedReward] = useState<typeof REWARDS[0] | null>(null);
    const [exchanging, setExchanging] = useState(false);

    const levelProgress = getLevelProgress();

    const getRewardIcon = (type: string) => {
        switch (type) {
            case 'coupon': return <ThunderboltOutlined className="text-2xl text-amber-500" />;
            case 'subscription': return <CrownOutlined className="text-2xl text-purple-500" />;
            case 'storage': return <CloudOutlined className="text-2xl text-blue-500" />;
            default: return <GiftOutlined className="text-2xl text-indigo-500" />;
        }
    };

    const getRewardColor = (type: string) => {
        switch (type) {
            case 'coupon': return 'from-amber-500 to-orange-500';
            case 'subscription': return 'from-purple-500 to-pink-500';
            case 'storage': return 'from-blue-500 to-cyan-500';
            default: return 'from-indigo-500 to-purple-500';
        }
    };

    const handleExchange = async () => {
        if (!selectedReward) return;
        if (balance < selectedReward.points) {
            message.warning('积分不足');
            return;
        }
        setExchanging(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        const success = spendPoints(selectedReward.points, 'exchange', `兑换${selectedReward.name}`);
        if (success) {
            message.success({
                content: `兑换成功！${selectedReward.name} 已发放`,
                icon: <CheckCircleOutlined style={{ color: '#10b981' }} />,
            });
        }
        setExchanging(false);
        setSelectedReward(null);
    };

    return (
        <div className="min-h-screen max-w-7xl mx-auto pb-12">
            {/* Header Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={clsx("rounded-3xl p-8 relative overflow-hidden mb-8 shadow-xl", isDark ? "bg-zinc-900 border border-zinc-800" : "bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700")}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                <div className="relative flex flex-col md:flex-row justify-between items-center gap-6 text-white">
                    <div className="text-center md:text-left">
                        <h1 className="text-3xl font-bold mb-2">积分商城</h1>
                        <p className="text-white/70">签到、创作、分享均可获得积分，兑换丰厚奖品</p>
                    </div>
                    <div className="flex items-center gap-8">
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-2 mb-1">
                                <GiftOutlined className="text-2xl text-amber-400" />
                                <span className="text-4xl font-bold">{balance}</span>
                            </div>
                            <p className="text-white/60 text-sm">可用积分</p>
                        </div>
                        <div className="w-px h-12 bg-white/20" />
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-2 mb-1">
                                <CrownOutlined className="text-2xl text-amber-400" />
                                <span className="text-2xl font-bold">Lv.{levelProgress.level}</span>
                            </div>
                            <p className="text-white/60 text-sm">会员等级</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Rewards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {(REWARDS || []).map((reward, index) => {
                    const canAfford = balance >= reward.points;
                    return (
                        <motion.div key={reward.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                            <Card className="h-full rounded-2xl overflow-hidden hover:shadow-lg transition-all" bodyStyle={{ padding: 0 }}>
                                <div className={clsx("h-28 flex items-center justify-center bg-gradient-to-br", getRewardColor(reward.type))}>
                                    {getRewardIcon(reward.type)}
                                </div>
                                <div className="p-5 flex flex-col h-[calc(100%-112px)]">
                                    <h3 className="font-bold text-lg mb-4">{reward.name}</h3>
                                    <div className="mt-auto flex items-center justify-between">
                                        <div className="font-bold text-amber-500 text-lg">{reward.points} <span className="text-xs text-zinc-400">积分</span></div>
                                        <Button type="primary" size="small" disabled={!canAfford} onClick={() => setSelectedReward(reward)} className="rounded-lg">兑换</Button>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    );
                })}
            </div>

            {/* Modal */}
            <Modal open={!!selectedReward} onCancel={() => setSelectedReward(null)} footer={null} width={400} bodyStyle={{ padding: 0 }} closable={false}>
                {selectedReward && (
                    <div className="overflow-hidden rounded-2xl">
                        <div className={clsx("h-24 flex items-center justify-center bg-gradient-to-br", getRewardColor(selectedReward.type))}>
                            {getRewardIcon(selectedReward.type)}
                        </div>
                        <div className="p-8 text-center">
                            <h3 className="text-xl font-bold mb-2">{selectedReward.name}</h3>
                            <p className="text-zinc-500 mb-6 text-sm">确认使用 {selectedReward.points} 积分兑换？</p>
                            <div className="flex gap-3">
                                <Button block onClick={() => setSelectedReward(null)} className="h-11 rounded-xl">取消</Button>
                                <Button type="primary" block loading={exchanging} onClick={handleExchange} className="h-11 rounded-xl bg-indigo-600">确定</Button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
