'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useOnboardingStore, ContentDomain, DomainOption } from '@/store/onboardingStore';
import clsx from 'clsx';

interface DomainSelectorProps {
  onSelect?: (domain: ContentDomain) => void;
}

export default function DomainSelector({ onSelect }: DomainSelectorProps) {
  const { domains, progress, selectDomain } = useOnboardingStore();
  const selectedDomain = progress.selectedDomain;

  const handleSelect = (domain: DomainOption) => {
    selectDomain(domain.id);
    onSelect?.(domain.id);
  };

  // 将领域分成两行显示
  const firstRow = domains.slice(0, 6);
  const secondRow = domains.slice(6, 12);

  return (
    <div className="space-y-4">
      {/* 提示文字 */}
      <div className="text-center mb-6">
        <p className="text-gray-600 dark:text-gray-400">
          选择你最常创作的内容类型，AI将为你定制专属风格
        </p>
      </div>

      {/* 第一行 */}
      <div className="grid grid-cols-3 gap-3">
        {firstRow.map((domain, index) => (
          <motion.button
            key={domain.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => handleSelect(domain)}
            className={clsx(
              "relative p-4 rounded-xl border-2 transition-all duration-200",
              "hover:shadow-lg hover:scale-[1.02]",
              selectedDomain === domain.id
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                : "border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-gray-800"
            )}
          >
            {/* 选中标记 */}
            {selectedDomain === domain.id && (
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}

            {/* 图标 */}
            <div 
              className="text-3xl mb-2"
              style={{ 
                filter: selectedDomain === domain.id 
                  ? `drop-shadow(0 0 8px ${domain.color}40)` 
                  : 'none'
              }}
            >
              {domain.icon}
            </div>

            {/* 名称 */}
            <div className={clsx(
              "text-sm font-medium",
              selectedDomain === domain.id
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-gray-700 dark:text-gray-300"
            )}>
              {domain.name}
            </div>

            {/* 描述 */}
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              {domain.description}
            </div>
          </motion.button>
        ))}
      </div>

      {/* 第二行 */}
      <div className="grid grid-cols-3 gap-3">
        {secondRow.map((domain, index) => (
          <motion.button
            key={domain.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (index + 6) * 0.05 }}
            onClick={() => handleSelect(domain)}
            className={clsx(
              "relative p-4 rounded-xl border-2 transition-all duration-200",
              "hover:shadow-lg hover:scale-[1.02]",
              selectedDomain === domain.id
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                : "border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-gray-800"
            )}
          >
            {/* 选中标记 */}
            {selectedDomain === domain.id && (
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}

            {/* 图标 */}
            <div 
              className="text-3xl mb-2"
              style={{ 
                filter: selectedDomain === domain.id 
                  ? `drop-shadow(0 0 8px ${domain.color}40)` 
                  : 'none'
              }}
            >
              {domain.icon}
            </div>

            {/* 名称 */}
            <div className={clsx(
              "text-sm font-medium",
              selectedDomain === domain.id
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-gray-700 dark:text-gray-300"
            )}>
              {domain.name}
            </div>

            {/* 描述 */}
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              {domain.description}
            </div>
          </motion.button>
        ))}
      </div>

      {/* 已选择提示 */}
      {selectedDomain && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
        >
          <span className="text-green-700 dark:text-green-400">
            ✅ 已选择「
            {domains.find(d => d.id === selectedDomain)?.name}
            」，点击继续开始创作之旅！
          </span>
        </motion.div>
      )}
    </div>
  );
}
