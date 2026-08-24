'use client';

import React from 'react';
import { Button, Card, message } from 'antd';
import { 
  CrownOutlined, 
  GiftOutlined, 
  StarOutlined,
  ThunderboltOutlined,
  BookOutlined,
  ShareAltOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useOnboardingStore, DOMAIN_NAMES, PLATFORM_NAMES } from '@/store/onboardingStore';
import confetti from 'canvas-confetti';
import clsx from 'clsx';

export default function CompletionGuide() {
  const { progress, completeOnboarding, closeOnboarding } = useOnboardingStore();

  // 播放完成动画
  React.useEffect(() => {
    const timer = setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#8b5cf6', '#a855f7', '#f59e0b'],
      });
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // 领取奖励
  const handleClaimRewards = () => {
    message.success({
      content: '🎉 恭喜完成新手引导！奖励已发放',
      duration: 4,
    });
    completeOnboarding();
  };

  // 前往创作
  const handleStartCreating = () => {
    closeOnboarding();
    window.location.href = '/ai-create';
  };

  // 分享
  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: '我刚刚完成了分发光子AI新手引导！',
        text: '使用分发光子AI，我轻松生成了第一个爆款脚本和视频，你也来试试吧！',
        url: window.location.origin,
      });
    } else {
      await navigator.clipboard.writeText('我刚刚完成了分发光子AI新手引导！使用分发光子AI，我轻松生成了第一个爆款脚本和视频，你也来试试吧！');
      message.success('链接已复制到剪贴板');
    }
  };

  const selectedDomain = progress.selectedDomain;
  const domainName = selectedDomain ? DOMAIN_NAMES[selectedDomain] : '创作';
  const selectedPlatforms = progress.selectedPlatforms.map(p => PLATFORM_NAMES[p] || p);

  return (
    <div className="space-y-6">
      {/* 庆祝头部 */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 mb-4">
          <CrownOutlined className="text-4xl text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          🎉 恭喜完成新手引导！
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          你已经掌握了分发光子AI的核心功能
        </p>
      </motion.div>

      {/* 你的选择 */}
      <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
        <h3 className="font-medium text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-2">
          <StarOutlined /> 你的创作配置
        </h3>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">领域：</span>
            <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded-lg text-sm font-medium">
              {domainName}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">平台：</span>
            <div className="flex flex-wrap gap-1">
              {selectedPlatforms.map((platform, index) => (
                <span 
                  key={index}
                  className="px-2 py-1 bg-white dark:bg-gray-800 rounded-lg text-sm"
                >
                  {platform}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 获得奖励 */}
      <Card className="border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <GiftOutlined className="text-2xl text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-amber-700 dark:text-amber-400 mb-2">
              🎁 新手专属奖励包
            </h3>
            <ul className="space-y-1 text-sm text-amber-600 dark:text-amber-300">
              <li className="flex items-center gap-2">
                <ThunderboltOutlined className="text-green-500" />
                +150 积分（已到账）
              </li>
              <li className="flex items-center gap-2">
                <StarOutlined className="text-yellow-500" />
                🌟 新星创作者徽章
              </li>
              <li className="flex items-center gap-2">
                <BookOutlined className="text-blue-500" />
                免费使用3天VIP会员
              </li>
            </ul>
          </div>
        </div>
      </Card>

      {/* 下一步行动 */}
      <div className="space-y-3">
        <Button
          type="primary"
          onClick={handleClaimRewards}
          className="w-full h-12 rounded-xl font-medium bg-gradient-to-r from-indigo-600 to-purple-600 border-none"
          icon={<CrownOutlined />}
        >
          领取奖励并开始创作
        </Button>
        
        <Button
          onClick={handleStartCreating}
          className="w-full h-12 rounded-xl font-medium"
        >
          暂不领取，直接开始创作
        </Button>
        
        <Button
          onClick={handleShare}
          className="w-full h-10 rounded-xl"
          icon={<ShareAltOutlined />}
        >
          分享给好友（获得额外积分）
        </Button>
      </div>

      {/* 提示 */}
      <div className="text-center text-sm text-gray-400">
        <p>📚 遇到问题？前往 <a href="/help" className="text-indigo-500">帮助中心</a></p>
        <p className="mt-1">你可以在设置中随时查看新手任务进度</p>
      </div>
    </div>
  );
}
