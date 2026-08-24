'use client';

import React, { useState } from 'react';
import { Button, Input, message } from 'antd';
import { ThunderboltOutlined, CopyOutlined, CheckCircleOutlined, StarOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore, DOMAIN_NAMES } from '@/store/onboardingStore';
import clsx from 'clsx';

interface FirstScriptGuideProps {
  onScriptGenerated?: (scriptId: string) => void;
  isGenerating?: boolean;
}

export default function FirstScriptGuide({ onScriptGenerated, isGenerating }: FirstScriptGuideProps) {
  const { progress } = useOnboardingStore();
  const [topic, setTopic] = useState('');
  const [generatedScript, setGeneratedScript] = useState<{
    title: string;
    content: string;
    viralScore: number;
  } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedDomain = progress.selectedDomain;
  const domainName = selectedDomain ? DOMAIN_NAMES[selectedDomain] : '创作';

  // 生成脚本（模拟）
  const handleGenerate = async () => {
    if (!topic.trim()) {
      message.warning('请输入一个创作主题');
      return;
    }

    setIsCreating(true);
    
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockTitles: Record<string, string[]> = {
        beauty: ['必学的减龄妆容技巧', '这款粉底液真的绝了', '新手必看的化妆顺序'],
        fashion: ['一周穿搭不重样', '显瘦显高穿搭技巧', '平价替代品推荐'],
        food: ['懒人必学的快手菜', '减脂期吃什么', '5分钟早餐食谱'],
        tech: ['性价比手机推荐', '必装的APP清单', '数码小白入门指南'],
        gaming: ['王者荣耀上分技巧', '新版本最强英雄', '游戏充值避坑指南'],
        movie: ['近期必看影单', '电影解说技巧', '明星八卦合集'],
        career: ['面试必问的问题', '职场新人避坑指南', '副业赚钱思路'],
        emotional: ['治愈系的文案', '情感共鸣话题', '励志正能量语录'],
        knowledge: ['冷知识大全', '必学的技能教程', '干货分享合集'],
        lifestyle: ['租房好物推荐', '独居生活技巧', '时间管理方法'],
        pets: ['猫咪行为大解析', '养宠必买清单', '宠物零食测评'],
        travel: ['小众旅行地推荐', '旅行省钱攻略', '出行必备清单'],
      };

      const titles = mockTitles[selectedDomain || 'lifestyle'] || mockTitles.lifestyle;
      const randomTitle = titles[Math.floor(Math.random() * titles.length)];
      const viralScore = Math.floor(Math.random() * 20) + 75;

      const mockScript = `${topic}是一个非常热门的话题。

【开头】
你是否也有类似的经历？今天就来聊聊这个话题！

【正文】
1. 第一点分享...
2. 第二点分享...
3. 第三点分享...

【结尾】
以上就是今天的分享，如果对你有帮助，记得点赞收藏哦！`;

      setGeneratedScript({
        title: randomTitle,
        content: mockScript,
        viralScore,
      });

      onScriptGenerated?.(`script_${Date.now()}`);
      message.success({ content: '✨ 脚本生成成功！', duration: 3 });
    } catch (error) {
      message.error('脚本生成失败，请重试');
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
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500">爆款指数</span>
                <span className={clsx(
                  "px-2 py-0.5 rounded-full text-sm font-bold",
                  generatedScript.viralScore >= 80 
                    ? "bg-green-100 dark:bg-green-900/30 text-green-600" : "bg-amber-100 text-amber-600"
                )}>
                  {generatedScript.viralScore}分
                </span>
              </div>
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
  const topics: Record<string, string[]> = {
    beauty: ['2024流行妆容', '平价好物推荐', '新手化妆教程', '护肤品测评'],
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
