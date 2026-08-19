'use client';

import React, { useState } from 'react';
import { Button, Progress, message } from 'antd';
import { 
  ThunderboltOutlined, 
  PlayCircleOutlined, 
  DownloadOutlined, 
  CheckCircleOutlined,
  RocketOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useOnboardingStore } from '@/store/onboardingStore';
import clsx from 'clsx';

interface FirstVideoGuideProps {
  onVideoGenerated?: (videoId: string) => void;
  isGenerating?: boolean;
}

export default function FirstVideoGuide({ onVideoGenerated, isGenerating }: FirstVideoGuideProps) {
  const { progress } = useOnboardingStore();
  const [isCreating, setIsCreating] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [generatedVideo, setGeneratedVideo] = useState<{
    title: string;
    duration: string;
    thumbnail: string;
  } | null>(null);

  // 生成视频
  const handleGenerate = async () => {
    setIsCreating(true);
    setProgressValue(0);

    try {
      // 模拟视频生成进度
      const progressSteps = [
        { value: 20, message: '正在分析脚本...' },
        { value: 40, message: '生成画面素材...' },
        { value: 60, message: '合成背景音乐...' },
        { value: 80, message: '添加字幕效果...' },
        { value: 100, message: '视频生成完成！' },
      ];

      for (const step of progressSteps) {
        await new Promise(resolve => setTimeout(resolve, 800));
        setProgressValue(step.value);
        if (step.value < 100) {
          message.info({ content: step.message, duration: 1 });
        }
      }

      setGeneratedVideo({
        title: '我的第一个AI视频',
        duration: '00:45',
        thumbnail: 'https://via.placeholder.com/400x225/6366f1/ffffff?text=Video+Preview',
      });

      onVideoGenerated?.(`video_${Date.now()}`);
      message.success({ content: '🎬 视频生成成功！', duration: 3 });
    } catch (error) {
      message.error('视频生成失败，请重试');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 提示文字 */}
      <div className="text-center mb-4">
        <p className="text-gray-600 dark:text-gray-400">
          基于你的脚本，一键生成完整的视频作品
        </p>
      </div>

      {/* 视频预览占位 */}
      <div className="relative aspect-video bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl overflow-hidden flex items-center justify-center">
        {generatedVideo ? (
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
              <PlayCircleOutlined className="text-4xl text-white" />
            </div>
            <p className="text-white font-medium">{generatedVideo.title}</p>
            <p className="text-white/60 text-sm">{generatedVideo.duration}</p>
          </div>
        ) : (
          <div className="text-center text-white/60">
            <RocketOutlined className="text-4xl mb-2" />
            <p>视频预览将在这里显示</p>
          </div>
        )}

        {/* 生成中覆盖层 */}
        {isCreating && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mb-4" />
            <p className="text-white font-medium">AI正在创作中...</p>
            <Progress 
              percent={progressValue} 
              showInfo={false}
              strokeColor="#6366f1"
              className="w-48 mt-4"
            />
          </div>
        )}
      </div>

      {/* 视频信息 */}
      {generatedVideo && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800"
        >
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-2">
            <CheckCircleOutlined />
            <span className="font-medium">视频生成成功！</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <ClockCircleOutlined /> {generatedVideo.duration}
            </span>
            <span>高清画质 1080P</span>
          </div>
        </motion.div>
      )}

      {/* 生成按钮 */}
      <Button
        type="primary"
        onClick={handleGenerate}
        loading={isCreating || isGenerating}
        disabled={isCreating}
        className="w-full h-12 rounded-xl font-medium bg-gradient-to-r from-purple-600 to-pink-600 border-none"
        icon={<ThunderboltOutlined />}
      >
        {isCreating ? '视频生成中...' : '🎬 一键生成视频'}
      </Button>

      {/* 视频特色说明 */}
      {!generatedVideo && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-lg">🎨</div>
            <p className="text-xs text-gray-600 dark:text-gray-400">AI配图</p>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-lg">🎵</div>
            <p className="text-xs text-gray-600 dark:text-gray-400">自动配乐</p>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-lg">💬</div>
            <p className="text-xs text-gray-600 dark:text-gray-400">字幕特效</p>
          </div>
        </div>
      )}

      {/* 下载按钮 */}
      {generatedVideo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex gap-2"
        >
          <Button 
            icon={<DownloadOutlined />} 
            className="flex-1 h-10"
          >
            下载视频
          </Button>
          <Button 
            type="primary"
            icon={<PlayCircleOutlined />} 
            className="flex-1 h-10"
          >
            预览效果
          </Button>
        </motion.div>
      )}

      {/* 底部提示 */}
      <div className="text-center text-sm text-gray-400">
        💡 生成后可自由编辑字幕、配乐、时长
      </div>
    </div>
  );
}
