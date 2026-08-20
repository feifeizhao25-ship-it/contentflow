'use client';

import React, { useState } from 'react';
import { Modal, Button, message, Input, Tabs, Alert } from 'antd';
import { 
  WechatOutlined, 
  WeiboOutlined, 
  QqOutlined, 
  CopyOutlined, 
  GiftOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { 
  generateShareConfig, 
  shareContent, 
  type SharePlatform 
} from '@/lib/referral-service';

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  type?: 'app' | 'script' | 'video';
  content?: {
    title?: string;
    scriptId?: string;
    videoId?: string;
  };
  onShareComplete?: (platform: SharePlatform) => void;
}

export default function ShareModal({ 
  visible, 
  onClose, 
  type = 'app',
  content,
  onShareComplete 
}: ShareModalProps) {
  const [activeTab, setActiveTab] = useState('share');
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState<SharePlatform | null>(null);

  const shareConfig = generateShareConfig(type, content);

  // 分享平台配置
  const sharePlatforms = [
    { key: 'wechat', name: '微信', icon: <WechatOutlined />, color: '#07C160', desc: '分享给微信好友' },
    { key: 'weibo', name: '微博', icon: <WeiboOutlined />, color: '#E6162D', desc: '分享到微博' },
    { key: 'qq', name: 'QQ', icon: <QqOutlined />, color: '#12B7F5', desc: '分享给QQ好友' },
    { key: 'copy_link', name: '复制链接', icon: <CopyOutlined />, color: '#1890FF', desc: '复制链接后分享' },
  ];

  // 处理分享
  const handleShare = async (platform: SharePlatform) => {
    setSharing(platform);
    
    const result = await shareContent(shareConfig, platform);
    
    if (result.success) {
      message.success(result.message || '分享操作已完成');
      onShareComplete?.(platform);
    } else {
      message.warning(result.message || '分享未完成');
    }
    
    setSharing(null);
  };

  // 复制链接
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareConfig.url);
      setCopied(true);
      message.success('链接已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      message.error('复制失败，请手动复制');
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      closable
      width={420}
      className="share-modal"
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        centered
        items={[
          {
            key: 'share',
            label: '分享内容',
            children: (
              <div className="py-4">
                {/* 分享预览 */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <div className="font-medium mb-1">{shareConfig.title}</div>
                  <div className="text-sm text-gray-500">{shareConfig.description}</div>
                </div>

                {/* 分享平台 */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {sharePlatforms.map((platform) => (
                    <motion.button
                      key={platform.key}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleShare(platform.key as SharePlatform)}
                      disabled={sharing !== null}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl"
                        style={{ backgroundColor: platform.color }}
                      >
                        {platform.icon}
                      </div>
                      <span className="text-xs text-gray-600">{platform.name}</span>
                    </motion.button>
                  ))}
                </div>

                {/* 话题标签 */}
                {shareConfig.hashtags && shareConfig.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {shareConfig.hashtags.map((tag, index) => (
                      <span 
                        key={index}
                        className="text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'invite',
            label: '邀请好友',
            children: (
              <div className="py-4">
                <Alert
                  type="info"
                  showIcon
                  icon={<GiftOutlined />}
                  message="邀请奖励功能正在接入"
                  description="奖励与邀请统计将在服务端完成核验后开放。当前不会展示模拟邀请码、虚构人数或未兑现的会员权益。"
                  className="mb-4"
                />

                {/* 邀请链接 */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <div className="text-xs text-gray-500 mb-2">邀请链接</div>
                  <div className="flex items-center gap-2">
                    <Input 
                      value={shareConfig.url}
                      readOnly
                      size="small"
                      className="flex-1"
                    />
                    <Button
                      type="primary"
                      icon={copied ? <CheckCircleOutlined /> : <CopyOutlined />}
                      onClick={handleCopyLink}
                    >
                      {copied ? '已复制' : '复制'}
                    </Button>
                  </div>
                </div>

              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
}
