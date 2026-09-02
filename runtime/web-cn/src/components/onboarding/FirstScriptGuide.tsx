'use client';

import React, { useState } from 'react';
import { Button, Input, message } from 'antd';
import { ThunderboltOutlined, CopyOutlined, CheckCircleOutlined, StarOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore, DOMAIN_NAMES } from '@/store/onboardingStore';

interface FirstScriptGuideProps {
  onScriptGenerated?: (scriptId: string) => void;
  isGenerating?: boolean;
}

export default function FirstScriptGuide({ onScriptGenerated, isGenerating }: FirstScriptGuideProps) {
  const { progress, platforms } = useOnboardingStore();
  const [topic, setTopic] = useState('');
  const [generatedScript, setGeneratedScript] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedDomain = progress.selectedDomain;
  const domainName = selectedDomain ? DOMAIN_NAMES[selectedDomain] : '创作';

  // 通过受鉴权的服务端路由生成真实分镜；上游不可用时明确失败。
  const handleGenerate = async () => {
    if (!topic.trim()) {
      message.warning('请输入一个创作主题');
      return;
    }

    setIsCreating(true);
    
    try {
      const response = await fetch('/api/ai/generate-script', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          type: domainName,
          platform:
            platforms.find((item) => item.id === progress.selectedPlatforms[0])?.name || '抖音',
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || '脚本生成服务暂不可用');
      }
      const scenes = Array.isArray(payload?.scenes) ? payload.scenes : [];
      if (scenes.length === 0) throw new Error('生成结果没有有效分镜');
      const content = scenes
        .map(
          (scene: { subtitle?: unknown; visual?: unknown; time?: unknown }, index: number) =>
            `【分镜 ${index + 1}】\n${String(scene.subtitle || '')}\n画面：${String(scene.visual || '')}（${Number(scene.time) || 0}秒）`,
        )
        .join('\n\n');
      const scriptId = `script_${Date.now()}`;
      sessionStorage.setItem(
        'contentflow:onboarding-script',
        JSON.stringify({ id: scriptId, title: String(payload?.title || topic), scenes }),
      );

      setGeneratedScript({
        title: String(payload?.title || topic),
        content,
      });

      onScriptGenerated?.(scriptId);
      message.success({ content: '✨ 脚本生成成功！', duration: 3 });
    } catch (error) {
      message.error(error instanceof Error ? error.message : '脚本生成失败，请重试');
    } finally {
      setIsCreating(false);
    }
  };

  // 复制脚本
  const handleCopy = async () => {
    if (generatedScript) {
      await navigator.clipboard.writeText(`# ${generatedScript.title}\n\n${generatedScript.content}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      message.success('已复制到剪贴板');
    }
  };

  return (
    <div className="space-y-4">
      {/* 提示文字 */}
      <div className="text-center mb-4">
        <p className="text-gray-600 dark:text-gray-400">
          输入一个你感兴趣的主题，AI将为你生成一个爆款脚本
        </p>
      </div>

      {/* 主题输入 */}
      <div className="space-y-3">
        <Input.TextArea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={`例如：${domainName}领域的热门话题、你感兴趣的内容方向...`}
          rows={3}
          className="rounded-xl"
        />

        {/* 快捷话题选项 */}
        {selectedDomain && (
          <div className="flex flex-wrap gap-2">
            {getQuickTopics(selectedDomain).map((quickTopic, index) => (
              <button
                key={index}
                onClick={() => setTopic(quickTopic)}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-indigo-100 
                          dark:hover:bg-indigo-900/30 text-gray-600 dark:text-gray-300 
                          hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full transition-colors"
              >
                {quickTopic}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 生成按钮 */}
      <Button
        type="primary"
        onClick={handleGenerate}
        loading={isCreating || isGenerating}
        disabled={!topic.trim() || isCreating}
        className="w-full h-12 rounded-xl font-medium bg-gradient-to-r from-indigo-600 to-purple-600 border-none"
        icon={<ThunderboltOutlined />}
      >
        {isCreating ? 'AI正在创作中...' : '✨ 一键生成脚本'}
      </Button>

      {/* 生成结果 */}
      <AnimatePresence>
        {generatedScript && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mt-4 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                <StarOutlined /> 生成结果
              </h4>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">
                已由真实服务生成
              </span>
            </div>

            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">
              {generatedScript.title}
            </h3>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400 max-h-40 overflow-y-auto">
              {generatedScript.content.length > 200 ? generatedScript.content.substring(0, 200) + '...' : generatedScript.content}
            </div>

            <div className="flex gap-2 mt-3">
              <Button onClick={handleCopy} icon={copied ? <CheckCircleOutlined /> : <CopyOutlined />} className="flex-1">
                {copied ? '已复制' : '复制脚本'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!generatedScript && (
        <div className="text-center text-sm text-gray-400">
          💡 输入越具体，生成的脚本越精准
        </div>
      )}
    </div>
  );
}

function getQuickTopics(domain: string): string[] {
  const year = new Date().getFullYear();
  const topics: Record<string, string[]> = {
    beauty: [`${year}流行妆容`, '平价好物推荐', '新手化妆教程', '护肤品测评'],
    fashion: ['穿搭技巧', '一周穿搭', '平价替代', '显瘦穿搭'],
    food: ['懒人食谱', '减脂餐', '网红美食', '一人食'],
    tech: ['数码好物', '性价比手机', 'APP推荐'],
    gaming: ['游戏攻略', '上分技巧', '新游推荐'],
    movie: ['电影解说', '剧荒推荐', '经典重温'],
    career: ['职场技巧', '面试攻略', '自我提升'],
    emotional: ['情感故事', '治愈系', '励志语录'],
    knowledge: ['科普知识', '冷知识', '技能教程'],
    lifestyle: ['生活好物', '独居生活', '时间管理'],
    pets: ['萌宠日常', '养宠攻略', '猫咪行为'],
    travel: ['旅行攻略', '小众景点', '省钱技巧'],
  };
  return topics[domain] || ['热门话题', '技巧分享'];
}
