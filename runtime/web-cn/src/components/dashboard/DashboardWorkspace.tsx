'use client';

import React, { useState, useEffect } from 'react';
import {
    Card,
    Button,
    Row,
    Col,
    Progress,
    List,
    Tag,
    Avatar,
    Badge,
    Space,
} from 'antd';
import { message } from '@/lib/antd-app';
import { 
  FileTextOutlined,
  ThunderboltOutlined,
  GiftOutlined,
  FireOutlined,
  UserOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
  CalendarOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useOnboardingStore } from '@/store/onboardingStore';
import { usePointsStore } from '@/store/pointsStore';
import CheckInModal from '@/components/checkin/CheckInModal';
import ShareModal from '@/components/share/ShareModal';

const { Meta } = Card;

// 快捷操作
const quickActions = [
  { icon: <FileTextOutlined />, label: '去创作', path: '/studio', color: '#722ed1' },
  { icon: <CalendarOutlined />, label: '发布日历', path: '/calendar', color: '#eb2f96' },
  { icon: <BarChartOutlined />, label: '已保存的数据', path: '/analytics', color: '#13c2c2' },
];

export default function DashboardWorkspace() {
  const { progress, currentStep } = useOnboardingStore();
  const { balance, consecutiveDays, getTodayStatus } = usePointsStore();
  
  const [checkInVisible, setCheckInVisible] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [todayStatus, setTodayStatus] = useState(getTodayStatus());

  useEffect(() => {
    setTodayStatus(getTodayStatus());
  }, [getTodayStatus]);

  // 欢迎消息
  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    if (hour < 6) return '深夜好，注意休息哦~';
    if (hour < 12) return '上午好，创作从现在开始！';
    if (hour < 14) return '午安，午后来点灵感~';
    if (hour < 18) return '下午好，继续加油！';
    return '晚上好，夜猫子创作时间！';
  };

  // 进度动画
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-6 max-w-7xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">
              {getWelcomeMessage()} 👋
            </h1>
            <p className="text-gray-500">
              {progress.selectedDomain ? `${progress.selectedDomain}领域创作者` : '开始你的创作之旅'}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* 签到按钮 */}
            <Badge dot={!todayStatus.checkedIn}>
              <Button
                type="default"
                icon={<GiftOutlined />}
                onClick={() => setCheckInVisible(true)}
                className="border-orange-300 text-orange-500 hover:bg-orange-50"
              >
                签到
              </Button>
            </Badge>
            
            {/* 分享按钮 */}
            <Button
              type="primary"
              icon={<FireOutlined />}
              onClick={() => setShareVisible(true)}
              className="bg-gradient-to-r from-purple-500 to-pink-500 border-none"
            >
              分享有礼
            </Button>
          </div>
        </div>
      </motion.div>

      {/* 积分展示 */}
      <motion.div variants={itemVariants} className="mb-6">
        <Card className="bg-gradient-to-r from-amber-100 to-orange-100 border-amber-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-400 rounded-full flex items-center justify-center text-white text-xl">
                💰
              </div>
              <div>
                <div className="text-sm text-gray-600">当前积分</div>
                <div className="text-3xl font-bold text-orange-600">{balance}</div>
              </div>
            </div>
            
            {consecutiveDays > 1 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-white/50 rounded-full">
                <FireOutlined className="text-red-500" />
                <span className="font-medium">连续签到 {consecutiveDays} 天</span>
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants} className="mb-6">
        <Card>
          <p className="m-0 text-sm text-zinc-600">这里不展示示例创作数、爆款率或热度。发布和生成次数以「数据」页里已经保存的记录为准；没有记录就显示为空，不会编造。</p>
        </Card>
      </motion.div>

      {/* 快捷操作 & 今日任务 */}
      <motion.div variants={itemVariants} className="mb-6">
        <Row gutter={[16, 16]}>
          {/* 快捷操作 */}
          <Col xs={24} lg={14}>
            <Card title="快捷操作" className="h-full">
              <Row gutter={[12, 12]}>
                {quickActions.map((action, index) => (
                  <Col xs={12} sm={6} key={index}>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                    >
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl"
                        style={{ backgroundColor: action.color }}
                      >
                        {action.icon}
                      </div>
                      <span className="text-sm text-gray-600">{action.label}</span>
                    </motion.div>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>

          {/* 今日任务 */}
          <Col xs={24} lg={10}>
            <Card title="今日任务" className="h-full">
              <List
                dataSource={[
                  { icon: '📝', title: '生成3个脚本', progress: 1, total: 3, reward: 15 },
                  { icon: '🎬', title: '生成1个视频', progress: 0, total: 1, reward: 20 },
                  { icon: '✅', title: '每日签到', progress: todayStatus.checkedIn ? 1 : 0, total: 1, reward: 10 },
                  { icon: '📢', title: '分享内容', progress: 0, total: 1, reward: 5 },
                ]}
                renderItem={(item) => (
                  <List.Item>
                    <div className="flex items-center gap-3 w-full">
                      <span className="text-2xl">{item.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium">{item.title}</div>
                        <Progress 
                          percent={(item.progress / item.total) * 100} 
                          size="small"
                          strokeColor={item.progress >= item.total ? '#52c41a' : '#1890ff'}
                        />
                      </div>
                      <Tag color={item.progress >= item.total ? 'success' : 'default'}>
                        +{item.reward}积分
                      </Tag>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>
      </motion.div>

      {/* 最近活动 & 引导进度 */}
      <motion.div variants={itemVariants}>
        <Row gutter={[16, 16]}>
          {/* 最近活动 */}
          <Col xs={24} lg={14}>
            <Card title="最近活动">
              <p className="m-0 text-sm text-zinc-500">没有从你的账号读取活动记录。这里不会列出示例脚本、示例视频或编造的热度。</p>
            </Card>
          </Col>

          {/* 引导进度 */}
          <Col xs={24} lg={10}>
            <Card title="新手引导">
              {progress.step5Completed === false ? (
                <>
                  <div className="mb-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-500">
                        第 {currentStep + 1}/5 步
                      </span>
                      <span className="text-sm font-medium">
                        {Math.round(((currentStep + 1) / 5) * 100)}%
                      </span>
                    </div>
                    <Progress 
                      percent={((currentStep + 1) / 5) * 100} 
                      strokeColor="linear-gradient(to right, #722ed1, #eb2f96)"
                    />
                  </div>
                  
                  <List
                    size="small"
                    dataSource={[
                      '选择创作领域',
                      '选择发布平台',
                      '生成第一个脚本',
                      '生成第一个视频',
                      '领取新手奖励',
                    ]}
                    renderItem={(item, index) => (
                      <List.Item>
                        <Space>
                          <Badge 
                            status={
                              index < currentStep ? 'success' :
                              index === currentStep ? 'processing' : 'default'
                            }
                          />
                          <span className={
                            index < currentStep ? 'text-gray-400' :
                            index === currentStep ? 'font-medium' : 'text-gray-400'
                          }>
                            {item}
                          </span>
                        </Space>
                      </List.Item>
                    )}
                  />
                  
                  <Button 
                    type="primary" 
                    block 
                    className="mt-4"
                    onClick={() => message.info('继续引导...')}
                  >
                    继续引导
                  </Button>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">🎉</div>
                  <div className="text-lg font-medium mb-1">引导已完成！</div>
                  <div className="text-sm text-gray-500">
                    你已解锁全部功能
                  </div>
                  <Tag color="success" className="mt-2">
                    <CheckCircleOutlined /> 新手礼包已领取
                  </Tag>
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </motion.div>

      {/* Modals */}
      <CheckInModal 
        visible={checkInVisible} 
        onClose={() => setCheckInVisible(false)} 
      />
      
      <ShareModal
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        type="app"
      />
    </motion.div>
  );
}
