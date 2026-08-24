'use client';

import React, { useState, useEffect } from 'react';
import { Button, Modal, Steps, message } from 'antd';
import {
    ThunderboltOutlined,
    EditOutlined,
    RocketOutlined,
    GiftOutlined,
    CheckCircleOutlined,
    CloseOutlined,
    ArrowRightOutlined,
    SmileOutlined
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useThemeStore } from '@/store/themeStore';
import { usePointsStore } from '@/store/pointsStore';
import confetti from 'canvas-confetti';
import clsx from 'clsx';

interface OnboardingGuideProps {
    onComplete?: () => void;
}

const steps = [
    {
        title: '欢迎使用分发侠',
        description: '您的AI创作助手',
        icon: <SmileOutlined className="text-4xl text-indigo-500" />,
        content: '让AI帮您创作高质量内容，一键分发到全平台',
    },
    {
        title: '极速创作',
        description: '输入主题一键生成',
        icon: <ThunderboltOutlined className="text-4xl text-indigo-500" />,
        content: '输入一个选题，AI将自动为您匹配爆款标题、脚本、封面图。',
    },
    {
        title: '平台适配',
        description: '千人千面分发同步',
        icon: <RocketOutlined className="text-4xl text-purple-500" />,
        content: '根据小红书、抖音、视频号等不同平台的规则，智能优化内容版本。',
    },
    {
        title: '任务中心',
        description: '掌控全局发布进度',
        icon: <GiftOutlined className="text-4xl text-orange-500" />,
        content: '排期发布与任务监控，让您的内容分发万无一失。',
    },
];

export default function OnboardingGuide({ onComplete }: OnboardingGuideProps) {
    const router = useRouter();
    const { isDark, toggleTheme } = useThemeStore();
    const { addPoints } = usePointsStore();

    const [open, setOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [isCompleting, setIsCompleting] = useState(false);

    // 检查是否首次使用
    useEffect(() => {
        const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
        if (!hasSeenOnboarding) {
            // 延迟显示，让页面先加载完成
            const timer = setTimeout(() => {
                setOpen(true);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleComplete = async () => {
        setIsCompleting(true);

        // 触发烟花效果
        confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.5 },
            colors: ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#f59e0b'],
        });

        // 发放新手礼包积分
        addPoints(100, 'onboarding', '完成新手引导');

        // 标记已看过引导
        localStorage.setItem('hasSeenOnboarding', 'true');

        await new Promise(resolve => setTimeout(resolve, 1000));

        setIsCompleting(false);
        setOpen(false);

        message.success({
            content: '🎉 新手礼包已发放！+100 积分',
            icon: <GiftOutlined style={{ color: '#f59e0b' }} />,
            duration: 4,
        });

        onComplete?.();
    };

    const handleSkip = () => {
        Modal.confirm({
            title: '确定跳过引导？',
            content: '您可以稍后在帮助中心查看功能介绍',
            onOk: () => {
                localStorage.setItem('hasSeenOnboarding', 'true');
                setOpen(false);
            },
            okText: '确定跳过',
            cancelText: '继续引导',
        });
    };

    const currentStepData = steps[currentStep];

    return (
        <Modal
            open={open}
            footer={null}
            closable={false}
            maskClosable={false}
            width={520}
            className="onboarding-modal"
            styles={{
                body: { padding: 0, overflow: 'hidden' },
                mask: { backdropFilter: 'blur(8px)' }
            }}
            zIndex={9999}
        >
            {/* 进度指示器 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                    {steps.map((_, index) => (
                        <motion.div
                            key={index}
                            initial={{ scale: 0.8 }}
                            animate={{
                                scale: index === currentStep ? 1 : 0.8,
                                opacity: index <= currentStep ? 1 : 0.3
                            }}
                            className={clsx(
                                "w-3 h-3 rounded-full transition-colors",
                                index === currentStep
                                    ? "bg-indigo-500"
                                    : index < currentStep
                                        ? "bg-green-500"
                                        : "bg-zinc-300 dark:bg-zinc-700"
                            )}
                        />
                    ))}
                </div>
                <button
                    onClick={handleSkip}
                    className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                >
                    跳过引导
                </button>
            </div>

            <div className="p-8">
                {/* 步骤图标 */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="text-center mb-8"
                    >
                        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center mb-4">
                            {currentStepData.icon}
                        </div>

                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
                            {currentStepData.title}
                        </h2>
                        <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mb-4">
                            {currentStepData.description}
                        </p>
                        <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                            {currentStepData.content}
                        </p>
                    </motion.div>
                </AnimatePresence>

                {/* 功能预览图/动画 */}
                <div className={clsx(
                    "h-32 rounded-xl mb-6 flex items-center justify-center overflow-hidden",
                    isDark ? "bg-zinc-800" : "bg-gradient-to-br from-indigo-100 to-purple-100"
                )}>
                    {currentStep === 0 && (
                        <div className="text-center">
                            <div className="text-4xl mb-2">👋</div>
                            <p className="text-sm text-zinc-500">欢迎加入分发侠</p>
                        </div>
                    )}
                    {currentStep === 1 && (
                        <div className="flex items-center gap-4">
                            <div className="px-4 py-2 bg-white dark:bg-zinc-700 rounded-lg shadow-sm">
                                <EditOutlined className="text-indigo-500 mr-2" />
                                输入创作主题
                            </div>
                            <ArrowRightOutlined className="text-zinc-400" />
                            <div className="px-4 py-2 bg-white dark:bg-zinc-700 rounded-lg shadow-sm">
                                <ThunderboltOutlined className="text-amber-500 mr-2" />
                                AI 自动生成
                            </div>
                        </div>
                    )}
                    {currentStep === 2 && (
                        <div className="flex gap-4">
                            {['📕', '🎵', '💬', '👁️'].map((emoji, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="w-12 h-12 bg-white dark:bg-zinc-700 rounded-xl flex items-center justify-center text-2xl shadow-sm"
                                >
                                    {emoji}
                                </motion.div>
                            ))}
                        </div>
                    )}
                    {currentStep === 3 && (
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-700 rounded-lg">
                                <CheckCircleOutlined className="text-green-500" />
                                每日签到
                            </div>
                            <ArrowRightOutlined className="text-zinc-400" />
                            <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                <GiftOutlined className="text-amber-500" />
                                +100 积分
                            </div>
                        </div>
                    )}
                </div>

                {/* 底部按钮 */}
                <div className="flex items-center justify-between">
                    <Button
                        onClick={handlePrev}
                        disabled={currentStep === 0}
                        className={clsx(
                            "px-6",
                            currentStep === 0 ? 'opacity-0' : ''
                        )}
                    >
                        上一步
                    </Button>

                    <Button
                        type="primary"
                        onClick={handleNext}
                        loading={isCompleting}
                        className={clsx(
                            "px-8 h-12 rounded-xl font-medium",
                            "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500",
                            "border-none shadow-lg shadow-indigo-500/20"
                        )}
                        icon={currentStep === steps.length - 1 ? <CheckCircleOutlined /> : undefined}
                    >
                        {currentStep === steps.length - 1 ? '开始使用' : '下一步'}
                    </Button>
                </div>
            </div>

            {/* 新手礼包提示 */}
            <AnimatePresence>
                {currentStep === steps.length - 1 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-t border-amber-100 dark:border-amber-900/30"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                    <GiftOutlined className="text-lg text-amber-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                        🎁 完成引导即可获得
                                    </p>
                                    <p className="text-xs text-zinc-500">
                                        新手礼包：100 积分
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Modal>
    );
}
