'use client';

import React, { useMemo, useState } from 'react';
import { Alert, Modal, message } from 'antd';
import { CopyOutlined, QqOutlined, WechatOutlined, WeiboOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { generateShareConfig, shareContent, type SharePlatform } from '@/lib/referral-service';

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  type?: 'app' | 'script' | 'video';
  content?: { title?: string; scriptId?: string; videoId?: string };
  onShareComplete?: (platform: SharePlatform) => void;
}

const SHARE_PLATFORMS = [
  { key: 'wechat', name: '微信', icon: <WechatOutlined />, color: '#07C160' },
  { key: 'weibo', name: '微博', icon: <WeiboOutlined />, color: '#E6162D' },
  { key: 'qq', name: 'QQ', icon: <QqOutlined />, color: '#12B7F5' },
  { key: 'copy_link', name: '复制链接', icon: <CopyOutlined />, color: '#1890FF' },
] satisfies Array<{ key: SharePlatform; name: string; icon: React.ReactNode; color: string }>;

export default function ShareModal({
  visible,
  onClose,
  type = 'app',
  content,
  onShareComplete,
}: ShareModalProps) {
  const [sharing, setSharing] = useState<SharePlatform | null>(null);
  const shareConfig = useMemo(() => generateShareConfig(type, content), [content, type]);

  const handleShare = async (platform: SharePlatform) => {
    setSharing(platform);
    try {
      const result = await shareContent(shareConfig, platform);
      if (result.success) {
        message.info(result.message);
        // 奖励类回调只接受服务端可验证的外部回执。
        if (result.verified) onShareComplete?.(platform);
      } else {
        message.warning(result.message);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '分享操作失败，请重试');
    } finally {
      setSharing(null);
    }
  };

  return (
    <Modal open={visible} onCancel={onClose} footer={null} closable width={440} title="分享内容">
      <div className="py-3">
        <div className="mb-4 rounded-xl bg-gray-50 p-4">
          <div className="mb-1 font-medium">{shareConfig.title}</div>
          <div className="text-sm text-gray-500">{shareConfig.description}</div>
        </div>

        <div className="mb-4 grid grid-cols-4 gap-3">
          {SHARE_PLATFORMS.map((platform) => (
            <motion.button
              key={platform.key}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => handleShare(platform.key)}
              disabled={sharing !== null}
              aria-busy={sharing === platform.key}
              className="flex flex-col items-center gap-2 rounded-xl bg-gray-50 p-3 transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full text-xl text-white"
                style={{ backgroundColor: platform.color }}
              >
                {platform.icon}
              </span>
              <span className="text-xs text-gray-600">{platform.name}</span>
            </motion.button>
          ))}
        </div>

        {shareConfig.hashtags?.length ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {shareConfig.hashtags.map((tag) => (
              <span key={tag} className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-600">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <Alert
          type="info"
          showIcon
          message="分享结果说明"
          description="系统只能确认已打开分享面板或已复制链接，不会在没有平台回执时声称分享成功或发放奖励。邀请奖励将在服务端验证功能上线后开放。"
        />
      </div>
    </Modal>
  );
}
