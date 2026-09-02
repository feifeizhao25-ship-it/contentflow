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

interface FirstVideoGuideProps {
  onVideoGenerated?: (videoId: string) => void;
  isGenerating?: boolean;
}

export default function FirstVideoGuide({ onVideoGenerated, isGenerating }: FirstVideoGuideProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [generatedVideo, setGeneratedVideo] = useState<{
    title: string;
    duration: string;
    url: string;
  } | null>(null);

  // 生成视频
  const handleGenerate = async () => {
    setIsCreating(true);
    setProgressValue(0);

    try {
      const stored = sessionStorage.getItem('contentflow:onboarding-script');
      const script = stored ? JSON.parse(stored) : null;
      const firstScene = Array.isArray(script?.scenes) ? script.scenes[0] : null;
      if (!firstScene?.visual) {
        throw new Error('请先完成上一步的真实脚本生成');
      }

      const response = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          segments: [{ prompt: String(firstScene.visual), duration: Number(firstScene.time) || 6 }],
          aspectRatio: '9:16',
        }),
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || payload?.error || '视频生成服务暂不可用');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      let resultUrl = '';
      const consumeEvent = (block: string) => {
        const line = block.split('\n').find((item) => item.startsWith('data: '));
        if (!line) return;
        const event = JSON.parse(line.slice(6));
        if (event.error) throw new Error(String(event.error));
        if (Number.isFinite(Number(event.progress))) setProgressValue(Number(event.progress));
        if (event.message) message.info({ content: String(event.message), duration: 1 });
        if (event.done && event.url) resultUrl = String(event.url);
      };
      while (true) {
        const { value, done } = await reader.read();
        pending += decoder.decode(value, { stream: !done });
        const blocks = pending.split('\n\n');
        pending = blocks.pop() || '';
        for (const block of blocks) {
          consumeEvent(block);
        }
        if (done) {
          if (pending.trim()) consumeEvent(pending);
          break;
        }
      }
      if (!resultUrl) throw new Error('视频服务未返回可播放文件');

      const videoId = `video_${Date.now()}`;
      setGeneratedVideo({
        title: String(script.title || '首个 AI 视频片段'),
        duration: `${Number(firstScene.time) || 6} 秒`,
        url: resultUrl,
      });
      setProgressValue(100);
      onVideoGenerated?.(videoId);
      message.success({ content: '🎬 首个视频片段生成成功！', duration: 3 });
    } catch (error) {
      message.error(error instanceof Error ? error.message : '视频生成失败，请重试');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 提示文字 */}
      <div className="text-center mb-4">
        <p className="text-gray-600 dark:text-gray-400">
          基于上一步脚本，生成一个真实视频片段供你预览
        </p>
      </div>

      {/* 视频预览占位 */}
      <div className="relative aspect-video bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl overflow-hidden flex items-center justify-center">
        {generatedVideo ? (
          <video
            src={generatedVideo.url}
            controls
            playsInline
            className="h-full w-full object-contain"
            aria-label={`${generatedVideo.title}预览`}
          />
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
            <span className="font-medium">真实视频片段生成成功</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <ClockCircleOutlined /> {generatedVideo.duration}
            </span>
            <span>实际画质以服务返回文件为准</span>
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
        {isCreating ? '视频生成中...' : '🎬 生成首个视频片段'}
      </Button>

      {/* 视频特色说明 */}
      {!generatedVideo && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-lg">🎨</div>
            <p className="text-xs text-gray-600 dark:text-gray-400">真实生成</p>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-lg">🎵</div>
            <p className="text-xs text-gray-600 dark:text-gray-400">失败不伪造</p>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-lg">💬</div>
            <p className="text-xs text-gray-600 dark:text-gray-400">可直接预览</p>
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
            href={generatedVideo.url}
            target="_blank"
            rel="noreferrer"
          >
            下载视频
          </Button>
          <Button 
            type="primary"
            icon={<PlayCircleOutlined />} 
            className="flex-1 h-10"
            onClick={() => window.open(generatedVideo.url, '_blank', 'noopener,noreferrer')}
          >
            预览效果
          </Button>
        </motion.div>
      )}

      {/* 底部提示 */}
      <div className="text-center text-sm text-gray-400">
        💡 完整字幕、配乐与多片段合成请在工作室继续完成
      </div>
    </div>
  );
}
