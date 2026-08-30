'use client';

import React, { useState, useEffect } from 'react';
import { Button, Modal, Progress, message, Spin } from 'antd';
import {
  CloseOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  CrownOutlined,
  ThunderboltOutlined,
  RocketOutlined,
  GiftOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useOnboardingStore, ContentDomain, TargetPlatform } from '@/store/onboardingStore';
import { usePointsStore } from '@/store/pointsStore';
import DomainSelector from './DomainSelector';
import PlatformSelector from './PlatformSelector';
import FirstScriptGuide from './FirstScriptGuide';
import FirstVideoGuide from './FirstVideoGuide';
import CompletionGuide from './CompletionGuide';
import clsx from 'clsx';

const STEP_CONFIG = [
  { id: 1, title: '选择领域', icon: '🎯', duration: '30秒', description: '告诉AI你创作什么类型的内容' },
  { id: 2, title: '选择平台', icon: '📱', duration: '30秒', description: '选择你的目标发布平台' },
  { id: 3, title: '生成脚本', icon: '✨', duration: '60秒', description: 'AI帮你生成第一个爆款脚本' },
  { id: 4, title: '生成视频', icon: '🎬', duration: '2分钟', description: '一键生成你的第一个视频' },
  { id: 5, title: '完成', icon: '🎉', duration: '60秒', description: '预览发布，获得新手大礼包' },
];

export default function EnhancedOnboardingGuide() {
  const {
    isActive,
    currentStep,
    progress,
    startOnboarding,
    closeOnboarding,
    completeStep1,
    completeStep2,
    completeStep3,
    completeStep4,
    completeStep5,
  } = useOnboardingStore();
  
  const { addPoints } = usePointsStore();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedScriptId, setGeneratedScriptId] = useState<string>('');
  const [generatedVideoId, setGeneratedVideoId] = useState<string>('');

  // 首次访问时启动引导
  useEffect(() => {
    const timer = setTimeout(() => {
      startOnboarding();
    }, 2000);
    return () => clearTimeout(timer);
  }, [startOnboarding]);

  // 打开时设置isActive为true
  useEffect(() => {
    if (progress.startedAt && !progress.completedAt) {
      const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
      if (!hasSeenOnboarding || progress.step1Completed) {
        // 如果已经开始过，标记为活跃
        if (progress.step1Completed && !progress.completedAt) {
          useOnboardingStore.setState({ isActive: true });
        }
      }
    }
  }, [progress]);

  // 发放奖励
  const claimReward = async (step: number) => {
    switch (step) {
      case 3:
        // 发放50积分
        await addPoints(50, '完成首次脚本生成');
        message.success({ content: '🎁 奖励已发放！+50 积分', duration: 3 });
        break;
      case 4:
        // 发放3天VIP
        message.success({ content: '🎁 奖励已发放！+3天 VIP会员', duration: 3 });
        break;
      case 5:
        // 发放100积分 + 徽章
        await addPoints(100, '完成新手引导');
        message.success({ 
          content: '🎉 恭喜完成新手引导！+100 积分 + 新星徽章', 
          duration: 4,
          icon: <CrownOutlined style={{ color: '#f59e0b' }} />,
        });
        break;
    }
  };

  // 处理步骤完成
  const handleStepComplete = async (step: number) => {
    setIsGenerating(true);
    
    try {
      switch (step) {
        case 1:
          completeStep1();
          break;
        case 2:
          completeStep2();
          break;
        case 3:
          completeStep3(generatedScriptId || `script_${Date.now()}`);
          await claimReward(3);
          // 烟花效果
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#6366f1', '#8b5cf6', '#a855f7'],
          });
          break;
        case 4:
          completeStep4(generatedVideoId || `video_${Date.now()}`);
          await claimReward(4);
          // 烟花效果
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#f59e0b', '#ef4444', '#22c55e'],
          });
          break;
        case 5:
          completeStep5();
          await claimReward(5);
          // 盛大烟花效果
          confetti({
            particleCount: 200,
            spread: 100,
            origin: { y: 0.5 },
            colors: ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#f59e0b', '#ef4444'],
          });
          break;
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // 跳过引导
  const handleSkip = () => {
    Modal.confirm({
      title: '确定跳过引导？',
      content: '你可以稍后在创作中心重新启动引导，完成引导可获得丰厚奖励！',
      onOk: () => {
        localStorage.setItem('hasSeenOnboarding', 'true');
        closeOnboarding();
      },
      okText: '确定跳过',
      cancelText: '继续引导',
    });
  };

  // 跳转到下一步
  const handleNext = () => {
    if (currentStep < 5) {
      handleStepComplete(currentStep + 1);
    }
  };

  // 返回上一步
  const handlePrev = () => {
    if (currentStep > 0) {
      useOnboardingStore.setState({ currentStep: currentStep - 1 });
    }
  };

  if (!isActive) return null;

  const currentConfig = STEP_CONFIG[currentStep - 1] || STEP_CONFIG[0];
  const progressPercent = (currentStep / 5) * 100;

  return (
    <Modal
      open={isActive}
      footer={null}
      closable={false}
      maskClosable={false}
      width={720}
      className="enhanced-onboarding-modal"
      styles={{ 
        body: { padding: 0, overflow: 'hidden' },
        mask: { backdropFilter: 'blur(10px)', backgroundColor: 'rgba(0,0,0,0.5)' }
      }}
      zIndex={10000}
    >
      {/* 顶部进度条 */}
      <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 px-6 py-4">
        {/* 关闭按钮 */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
        >
          <CloseOutlined className="text-lg" />
        </button>

        {/* 步骤指示器 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {STEP_CONFIG.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ scale: 0.8 }}
                animate={{ 
                  scale: index + 1 === currentStep ? 1.1 : 1,
                  opacity: index + 1 <= currentStep ? 1 : 0.5
                }}
                className={clsx(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                  index + 1 < currentStep 
                    ? "bg-green-500 text-white" 
                    : index + 1 === currentStep
                      ? "bg-white text-indigo-600 shadow-lg"
                      : "bg-white/30 text-white"
                )}
              >
                {index + 1 < currentStep ? (
                  <CheckCircleOutlined />
                ) : (
                  step.id
                )}
              </motion.div>
            ))}
          </div>
          
          {/* 进度文字 */}
          <div className="text-white/80 text-sm">
            步骤 {currentStep} / 5 · 预计{currentConfig.duration}
          </div>
        </div>

        {/* 当前步骤标题 */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="text-3xl mb-1">{currentConfig.icon}</div>
          <h2 className="text-xl font-bold text-white">{currentConfig.title}</h2>
          <p className="text-white/70 text-sm">{currentConfig.description}</p>
        </motion.div>
      </div>

      {/* 进度条 */}
      <div className="h-1 bg-gray-100 dark:bg-gray-800">
        <motion.div
          className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* 内容区域 */}
      <div className="p-6 min-h-[400px] max-h-[500px] overflow-y-auto">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <DomainSelector onSelect={(domain) => {
                useOnboardingStore.getState().selectDomain(domain);
              }} />
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <PlatformSelector />
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <FirstScriptGuide 
                onScriptGenerated={(scriptId) => {
                  setGeneratedScriptId(scriptId);
                }}
                isGenerating={isGenerating}
              />
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <FirstVideoGuide 
                onVideoGenerated={(videoId) => {
                  setGeneratedVideoId(videoId);
                }}
                isGenerating={isGenerating}
              />
            </motion.div>
          )}

          {currentStep === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <CompletionGuide />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 底部操作栏 */}
      <div className="border-t border-gray-100 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center justify-between">
          {/* 上一步 */}
          <Button
            onClick={handlePrev}
            disabled={currentStep === 1 || isGenerating}
            className={clsx(
              "px-6",
              currentStep === 1 ? 'invisible' : ''
            )}
          >
            <ArrowLeftOutlined /> 上一步
          </Button>

          {/* 中间奖励提示 */}
          <div className="text-center">
            {currentStep === 3 && (
              <span className="text-sm text-amber-600 dark:text-amber-400">
                🎁 完成此步 +50 积分
              </span>
            )}
            {currentStep === 4 && (
              <span className="text-sm text-purple-600 dark:text-purple-400">
                🎁 完成此步 +3天 VIP
              </span>
            )}
            {currentStep === 5 && (
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                🎉 全部完成 +100积分 + 徽章
              </span>
            )}
          </div>

          {/* 下一步/完成按钮 */}
          <Button
            type="primary"
            onClick={handleNext}
            loading={isGenerating}
            disabled={
              (currentStep === 1 && !progress.selectedDomain) ||
              (currentStep === 2 && progress.selectedPlatforms.length === 0)
            }
            className={clsx(
              "px-8 h-12 rounded-xl font-medium min-w-[140px]",
              "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500",
              "border-none shadow-lg shadow-indigo-500/20"
            )}
            icon={currentStep === 5 ? <CrownOutlined /> : <ArrowRightOutlined />}
          >
            {currentStep === 5 ? '领取奖励' : 
             currentStep === 4 ? '生成视频' :
             currentStep === 3 ? '生成脚本' : '继续'}
          </Button>
        </div>
      </div>

      {/* 快捷跳过提示 */}
      <div className="text-center pb-3">
        <button
          onClick={handleSkip}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          暂时跳过，稍后可以随时在帮助中心重启引导
        </button>
      </div>
    </Modal>
  );
}
