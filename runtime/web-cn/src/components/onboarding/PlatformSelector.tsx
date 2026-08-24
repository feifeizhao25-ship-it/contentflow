'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useOnboardingStore, TargetPlatform, PlatformOption } from '@/store/onboardingStore';
import clsx from 'clsx';

export default function PlatformSelector() {
  const { platforms, progress, selectPlatform, deselectPlatform } = useOnboardingStore();
  const selectedPlatforms = progress.selectedPlatforms;

  const handleToggle = (platform: PlatformOption) => {
    if (selectedPlatforms.includes(platform.id)) {
      deselectPlatform(platform.id);
    } else {
      selectPlatform(platform.id);
    }
  };

  return (
    <div className="space-y-4">
      {/* 提示文字 */}
      <div className="text-center mb-6">
        <p className="text-gray-600 dark:text-gray-400">
          选择你想要发布内容的平台（可多选）
        </p>
        {selectedPlatforms.length > 0 && (
          <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-1">
            已选择 {selectedPlatforms.length} 个平台
          </p>
        )}
      </div>

      {/* 平台列表 */}
      <div className="space-y-3">
        {platforms.map((platform, index) => {
          const isSelected = selectedPlatforms.includes(platform.id);
          
          return (
            <motion.button
              key={platform.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08 }}
              onClick={() => handleToggle(platform)}
              className={clsx(
                "w-full relative p-4 rounded-xl border-2 transition-all duration-200 text-left",
                "hover:shadow-md hover:scale-[1.01]",
                isSelected
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                  : "border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-gray-800"
              )}
            >
              <div className="flex items-center gap-4">
                {/* 图标 */}
                <div 
                  className="text-2xl"
                  style={{ 
                    filter: isSelected 
                      ? `drop-shadow(0 0 8px ${platform.color}60)` 
                      : 'none'
                  }}
                >
                  {platform.icon}
                </div>

                {/* 平台信息 */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      "font-medium",
                      isSelected
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-gray-700 dark:text-gray-300"
                    )}>
                      {platform.name}
                    </span>
                    {platform.recommended && (
                      <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">
                        推荐
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {platform.description}
                  </p>
                </div>

                {/* 选中状态 */}
                <div className={clsx(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                  isSelected
                    ? "border-green-500 bg-green-500"
                    : "border-gray-300 dark:border-gray-600"
                )}>
                  {isSelected && (
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>

              {/* 选中时的底部装饰 */}
              {isSelected && (
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* 多平台优势提示 */}
      {selectedPlatforms.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800"
        >
          <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
            <span className="text-lg">🚀</span>
            <span className="text-sm font-medium">
              一键多发 {selectedPlatforms.length} 个平台，曝光量翻倍！
            </span>
          </div>
        </motion.div>
      )}

      {/* 推荐组合 */}
      {selectedPlatforms.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
        >
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            💡 <strong>推荐组合：</strong>
            <br />
            抖音 + 小红书 = 最大化曝光
          </p>
        </motion.div>
      )}
    </div>
  );
}
