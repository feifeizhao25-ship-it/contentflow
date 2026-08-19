'use client';

import React, { useState } from 'react';
import { Modal, Button, message, Input, Space, Tabs, List, Avatar, Progress } from 'antd';
import { 
  WechatOutlined, 
  WeiboOutlined, 
  QqOutlined, 
  CopyOutlined, 
  LinkOutlined,
  GiftOutlined,
  UserOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  generateShareConfig, 
  shareContent, 
  getReferralStats, 
  generateInviteLink,
  SHARE_REWARDS,
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
  const [inviteCode, setInviteCode] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState<SharePlatform | null>(null);
  const [stats, setStats] = useState({
    totalInvites: 0,
    completedInvites: 0,
    earnedPoints: 0,
    earnedVipDays: 0,
  });

  React.useEffect(() => {
    if (visible) {
      // 加载邀请数据
      setInviteCode('FENFA' + Math.random().toString(36).substr(2, 6).toUpperCase());
      setInviteLink(`https://fenfa.ai?ref=${inviteCode}`);
      
      // 模拟统计数据
      setStats({
        totalInvites: Math.floor(Math.random() * 20),
        completedInvites: Math.floor(Math.random() * 10),
        earnedPoints: Math.floor(Math.random() * 500),
        earnedVipDays: Math.floor(Math.random() * 5),
      });
    }
  }, [visible, inviteCode]);

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
      message.success('分享成功！');
      onShareComplete?.(platform);
    }
    
    setSharing(null);
  };

  // 复制链接
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      message.success('链接已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      message.error('复制失败，请手动复制');
    }
  };

  // 邀请奖励说明
  const rewardItems = [
    { icon: '🎁', title: '被邀请人奖励', desc: `${SHARE_REWARDS.invitee.vipDays}天VIP + ${SHARE_REWARDS.invitee.points}积分` },
    { icon: '💰', title: '邀请人奖励', desc: `${SHARE_REWARDS.inviter.vipDays}天VIP + ${SHARE_REWARDS.inviter.points}积分` },
    { icon: '🎯', title: '阶梯奖励', desc: '邀请3人额外50积分，10人再得200积分' },
  ];

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
                {/* 邀请奖励卡片 */}
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-4 text-white mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <GiftOutlined className="text-xl" />
                    <span className="font-medium">邀请奖励</span>
                  </div>
                  <div className="text-2xl font-bold mb-1">
                    最高可获 {SHARE_REWARDS.milestones[3].bonus.points} 积分
                  </div>
                  <div className="text-sm opacity-80">
                    + {SHARE_REWARDS.milestones[3].bonus.vipDays}天VIP会员
                  </div>
                </div>

                {/* 奖励明细 */}
                <List
                  size="small"
                  dataSource={rewardItems}
                  renderItem={(item) => (
                    <List.Item>
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{item.icon}</span>
                        <div>
                          <div className="font-medium text-sm">{item.title}</div>
                          <div className="text-xs text-gray-500">{item.desc}</div>
                        </div>
                      </div>
                    </List.Item>
                  )}
                  className="mb-4"
                />

                {/* 邀请链接 */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <div className="text-xs text-gray-500 mb-2">邀请链接</div>
                  <div className="flex items-center gap-2">
                    <Input 
                      value={inviteLink}
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

                {/* 邀请码 */}
                <div className="text-center mb-4">
                  <div className="text-xs text-gray-500 mb-1">或分享邀请码</div>
                  <div className="inline-flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg">
                    <span className="font-mono font-bold text-lg text-blue-600">
                      {inviteCode}
                    </span>
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => {
                        navigator.clipboard.writeText(inviteCode);
                        message.success('邀请码已复制');
                      }}
                    />
                  </div>
                </div>

                {/* 邀请统计 */}
                <div className="border-t pt-4">
                  <div className="text-sm font-medium mb-3">邀请成果</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-xl font-bold text-purple-600">
                        {stats.totalInvites}
                      </div>
                      <div className="text-xs text-gray-500">已邀请</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-xl font-bold text-green-600">
                        {stats.completedInvites}
                      </div>
                      <div className="text-xs text-gray-500">已完成</div>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-center gap-6 text-center">
                    <div>
                      <div className="text-lg font-bold text-orange-500">{stats.earnedPoints}</div>
                      <div className="text-xs text-gray-500">获得积分</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-500">{stats.earnedVipDays}</div>
                      <div className="text-xs text-gray-500">获得VIP(天)</div>
                    </div>
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
