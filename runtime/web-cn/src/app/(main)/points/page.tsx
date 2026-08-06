'use client';

import React, { useState } from 'react';
import { Button, Card, Tag, Modal, message, Empty, Badge } from 'antd';
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
    const { balance: points, spendPoints, addPoints, getLevelProgress } = usePointsStore();
    const subtractPoints = (amount: number, description: string) =>
        spendPoints(amount, 'reward_exchange', description);
    const { isDark } = useThemeStore();
    const [selectedReward, setSelectedReward] = useState<typeof REWARDS[0] | null>(null);
    const [exchanging, setExchanging] = useState(false);

    const levelProgress = getLevelProgress();

    const getRewardIcon = (type: string) => {
        switch (type) {
            case 'coupon':
                return <ThunderboltOutlined className="text-2xl text-amber-500" />;
            case 'subscription':
                return <CrownOutlined className="text-2xl text-purple-500" />;
            case 'storage':
                return <CloudOutlined className="text-2xl text-blue-500" />;
            default:
                return <GiftOutlined className="text-2xl text-indigo-500" />;
        }
    };

    const getRewardColor = (type: string) => {
        switch (type) {
            case 'coupon':
                return 'from-amber-500 to-orange-500';
            case 'subscription':
                return 'from-purple-500 to-pink-500';
            case 'storage':
                return 'from-blue-500 to-cyan-500';
            default:
                return 'from-indigo-500 to-purple-500';
        }
    };

    const handleExchange = async () => {
        if (!selectedReward) return;
        
        if (points < selectedReward.points) {
            message.warning('积分不足');
            return;
        }
        
        setExchanging(true);
        
        // 模拟兑换过程
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const success = subtractPoints(selectedReward.points, `兑换${selectedReward.name}`);
        
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
        <div className="min-h-screen">
            {/* Header */}
            <div className="mb-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={clsx(
                        "rounded-3xl p-8 relative overflow-hidden",
                        isDark ? "bg-zinc-900" : "bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700"
                    )}
                >
                    {/* 装饰 */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
                    
                    <div className="relative flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="text-center md:text-left">
                            <h1 className="text-3xl font-bold text-white mb-2">积分商城</h1>
                            <p className="text-white/70">签到、创作、分享均可获得积分，兑换丰厚奖品</p>
                        </div>
                        
                        <div className="flex items-center gap-6">
                            {/* 当前积分 */}
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-2 mb-1">
                                    <GiftOutlined className="text-2xl text-amber-400" />
                                    <span className="text-4xl font-bold text-white">{points}</span>
                                </div>
                                <p className="text-white/60 text-sm">当前积分</p>
                            </div>
                            
                            {/* 分割线 */}
                            <div className={clsx("w-px h-16", isDark ? "bg-zinc-700" : "bg-white/20")} />
                            
                            {/* 等级 */}
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-2 mb-1">
                                    <CrownOutlined className="text-2xl text-amber-400" />
                                    <span className="text-2xl font-bold text-white">Lv.{Math.floor(levelProgress.currentXP / 1000) + 1}</span>
                                </div>
                                <p className="text-white/60 text-sm">当前等级</p>
                            </div>
                        </div>
                    </div>
                    
                    {/* 积分获取说明 */}
                    <div className="relative mt-6 flex flex-wrap justify-center gap-4">
                        <Badge.Ribbon text="获取积分" color="#6366f1">
                            <div className={clsx(
                                "px-4 py-2 rounded-lg text-sm",
                                isDark ? "bg-zinc-800 text-zinc-300" : "bg-white/20 text-white"
                            )}>
                                📅 每日签到 +10~45
                            </div>
                        </Badge.Ribbon>
                        <div className={clsx(
                            "px-4 py-2 rounded-lg text-sm",
                            isDark ? "bg-zinc-800 text-zinc-300" : "bg-white/20 text-white"
                        )}>
                            ✨ 创建内容 +20
                        </div>
                        <div className={clsx(
                            "px-4 py-2 rounded-lg text-sm",
                            isDark ? "bg-zinc-800 text-zinc-300" : "bg-white/20 text-white"
                        )}>
                            🚀 发布内容 +30
                        </div>
                        <div className={clsx(
                            "px-4 py-2 rounded-lg text-sm",
                            isDark ? "bg-zinc-800 text-zinc-300" : "bg-white/20 text-white"
                        )}>
                            👥 邀请好友 +100
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Rewards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {REWARDS.map((reward, index) => {
                    const canAfford = points >= reward.points;
                    
                    return (
                        <motion.div
                            key={reward.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Card
                                className={clsx(
                                    "h-full rounded-2xl overflow-hidden transition-all hover:-translate-y-1",
                                    isDark 
                                        ? "bg-zinc-900 border-zinc-800 hover:shadow-lg hover:shadow-indigo-500/10" 
                                        : "bg-white border-zinc-200 hover:shadow-xl hover:shadow-indigo-500/10"
                                )}
                                styles={{ body: { padding: 0 } }}
                            >
                                {/* 顶部图片区域 */}
                                <div className={clsx(
                                    "h-32 flex items-center justify-center bg-gradient-to-br",
                                    getRewardColor(reward.type)
                                )}>
                                    {getRewardIcon(reward.type)}
                                </div>
                                
                                {/* 内容区域 */}
                                <div className="p-5">
                                    <h3 className={clsx(
                                        "text-lg font-bold mb-2",
                                        isDark ? "text-white" : "text-zinc-900"
                                    )}>
                                        {reward.name}
                                    </h3>
                                    
                                    <div className="flex items-center gap-2 mb-4">
                                        <Tag color={canAfford ? "green" : "red"}>
                                            {canAfford ? '可兑换' : '积分不足'}
                                        </Tag>
                                        <span className="text-xs text-zinc-500">
                                            剩余: 无限
                                        </span>
                                    </div>
                                    
                                    {/* 积分价格 */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1">
                                            <GiftOutlined className="text-amber-500" />
                                            <span className="text-xl font-bold text-amber-500">
                                                {reward.points}
                                            </span>
                                            <span className="text-sm text-zinc-500">积分</span>
                                        </div>
                                        
                                        <Button
                                            type="primary"
                                            size="small"
                                            onClick={() => setSelectedReward(reward)}
                                            disabled={!canAfford}
                                            className={clsx(
                                                "rounded-lg",
                                                canAfford 
                                                    ? "bg-indigo-600 hover:bg-indigo-500" 
                                                    : "bg-zinc-300 cursor-not-allowed"
                                            )}
                                        >
                                            兑换
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    );
                })}
            </div>

            {/* Empty State (if no rewards) */}
            {REWARDS.length === 0 && (
                <Empty
                    description="暂无兑换商品"
                    className="py-16"
                >
                    <Button type="primary" icon={<GiftOutlined />}>
                        敬请期待更多商品
                    </Button>
                </Empty>
            )}

            {/* Exchange Confirmation Modal */}
            <Modal
                title={null}
                open={!!selectedReward}
                onCancel={() => setSelectedReward(null)}
                footer={null}
                closable={false}
                width={400}
                styles={{ body: { padding: 0, overflow: 'hidden' } }}
            >
                {selectedReward && (
                    <div>
                        {/* 顶部 */}
                        <div className={clsx(
                            "h-24 flex items-center justify-center bg-gradient-to-br",
                            getRewardColor(selectedReward.type)
                        )}>
                            {getRewardIcon(selectedReward.type)}
                        </div>
                        
                        {/* 内容 */}
                        <div className="p-6 text-center">
                            <h3 className={clsx(
                                "text-xl font-bold mb-2",
                                isDark ? "text-white" : "text-zinc-900"
                            )}>
                                {selectedReward.name}
                            </h3>
                            
                            <p className="text-zinc-500 mb-6">
                                确认使用 {selectedReward.points} 积分兑换此商品？
                            </p>
                            
                            {/* 积分对比 */}
                            <div className="flex justify-center items-center gap-4 mb-6">
                                <div className="text-center">
                                    <p className="text-sm text-zinc-500">当前积分</p>
                                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                                        {points}
                                    </p>
                                </div>
                                <CloseOutlined className="text-zinc-400" />
                                <div className="text-center">
                                    <p className="text-sm text-zinc-500">消耗积分</p>
                                    <p className="text-2xl font-bold text-amber-500">
                                        -{selectedReward.points}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex gap-3">
                                <Button
                                    block
                                    onClick={() => setSelectedReward(null)}
                                    className="h-12 rounded-xl"
                                >
                                    取消
                                </Button>
                                <Button
                                    type="primary"
                                    block
                                    onClick={handleExchange}
                                    loading={exchanging}
                                    disabled={points < selectedReward.points}
                                    className="h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500"
                                >
                                    确认兑换
                                </Button>
                            </div>
                            
                            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-zinc-400">
                                <InfoCircleOutlined />
                                兑换后积分将立即扣除，商品将发送至您的账户
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
