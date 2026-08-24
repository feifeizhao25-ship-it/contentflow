'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button, message, Progress } from 'antd';
import { 
  CheckCircleOutlined, 
  FireOutlined, 
  GiftOutlined,
  CloseOutlined 
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { usePointsStore } from '@/store/pointsStore';
import clsx from 'clsx';

interface CheckInModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function CheckInModal({ visible, onClose }: CheckInModalProps) {
  const { 
    balance, 
    consecutiveDays, 
    checkIn, 
    getTodayStatus,
    checkInRecords 
  } = usePointsStore();
  
  const [isAnimating, setIsAnimating] = useState(false);
  const [checkInResult, setCheckInResult] = useState<{
    success: boolean;
    bonus?: number;
    streak?: number;
  } | null>(null);
  const [status, setStatus] = useState(getTodayStatus());

  useEffect(() => {
    setStatus(getTodayStatus());
  }, [getTodayStatus, visible]);

  // 签到奖励阶梯
  const streakMilestones = [
    { days: 1, bonus: 10, label: '首签' },
    { days: 7, bonus: 10, label: '7天' },
    { days: 14, bonus: 20, label: '14天' },
    { days: 30, bonus: 50, label: '30天' },
    { days: 60, bonus: 100, label: '60天' },
  ];

  // 处理签到
  const handleCheckIn = async () => {
    if (status.checkedIn || isAnimating) return;
    
    setIsAnimating(true);
    
    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const result = checkIn();
    setCheckInResult(result);
    
    if (result.success) {
      message.success({
        content: `🎉 签到成功！+${result.bonus}积分`,
        duration: 3,
      });
      
      // 3秒后关闭或显示庆祝动画
      setTimeout(() => {
        setIsAnimating(false);
        setStatus(getTodayStatus());
      }, 2000);
    } else {
      setIsAnimating(false);
    }
  };

  // 获取最近7天的签到状态
  const getWeekCheckInStatus = () => {
    const today = new Date();
    const weekStatus = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const isCheckedIn = checkInRecords.some(r => r.date === dateStr);
      weekStatus.push({
        date: date,
        day: date.toLocaleDateString('zh-CN', { weekday: 'short' }),
        isCheckedIn,
        isToday: i === 0,
      });
    }
    
    return weekStatus;
  };

  const weekStatus = getWeekCheckInStatus();

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={400}
      className="checkin-modal"
      styles={{ 
        body: { padding: 0, overflow: 'hidden' },
        mask: { backdropFilter: 'blur(4px)' }
      }}
    >
      {/* 头部 */}
      <div className="relative bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 p-6 text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/80 hover:text-white"
        >
          <CloseOutlined className="text-lg" />
        </button>

        <div className="text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-2"
          >
            <GiftOutlined className="text-4xl" />
          </motion.div>
          
          <h2 className="text-xl font-bold mb-1">每日签到</h2>
          <p className="text-white/80 text-sm">连续签到，奖励翻倍！</p>
        </div>

        {/* 当前积分显示 */}
        <div className="mt-4 flex items-center justify-center gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold">{balance}</div>
            <div className="text-xs text-white/70">当前积分</div>
          </div>
          
          {consecutiveDays > 1 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full"
            >
              <FireOutlined className="text-red-300" />
              <span className="text-sm font-medium">{consecutiveDays}天连签</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* 本周签到记录 */}
      <div className="p-4 bg-white">
        <div className="flex justify-between mb-4">
          <span className="text-sm text-gray-500">本周签到</span>
          <span className="text-sm text-orange-500">
            {weekStatus.filter(d => d.isCheckedIn).length}/7天
          </span>
        </div>
        
        <div className="flex justify-between mb-6">
          {weekStatus.map((day, index) => (
            <div
              key={index}
              className={clsx(
                "flex flex-col items-center gap-1",
                day.isToday && "scale-110"
              )}
            >
              <motion.div
                initial={false}
                animate={{
                  scale: day.isCheckedIn ? 1 : day.isToday ? [1, 1.1, 1] : 1,
                  backgroundColor: day.isCheckedIn 
                    ? '#22c55e' 
                    : day.isToday 
                      ? '#f59e0b' 
                      : '#f3f4f6',
                }}
                className={clsx(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  day.isCheckedIn ? 'text-white' : 'text-gray-400',
                  day.isToday && !day.isCheckedIn && 'text-white'
                )}
              >
                {day.isCheckedIn ? (
                  <CheckCircleOutlined />
                ) : (
                  day.date.getDate()
                )}
              </motion.div>
              <span className={clsx(
                "text-xs",
                day.isCheckedIn ? 'text-green-500' : 'text-gray-400'
              )}>
                {day.day}
              </span>
            </div>
          ))}
        </div>

        {/* 签到奖励阶梯 */}
        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-2">签到奖励</div>
          <div className="flex items-center gap-2">
            {streakMilestones.map((milestone, index) => (
              <React.Fragment key={milestone.days}>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ 
                    scale: consecutiveDays >= milestone.days ? 1.1 : 1,
                    opacity: consecutiveDays >= milestone.days ? 1 : 0.5,
                  }}
                  className={clsx(
                    "flex-1 py-2 px-1 rounded-lg text-center transition-all",
                    consecutiveDays >= milestone.days
                      ? 'bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-200'
                      : 'bg-gray-50'
                  )}
                >
                  <div className={clsx(
                    "text-lg font-bold",
                    consecutiveDays >= milestone.days ? 'text-orange-500' : 'text-gray-400'
                  )}>
                    +{milestone.bonus}
                  </div>
                  <div className="text-xs text-gray-500">{milestone.label}</div>
                </motion.div>
                {index < streakMilestones.length - 1 && (
                  <div className="w-2" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* 签到进度 */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">距离下次奖励</span>
            <span className="text-orange-500 font-medium">
              {7 - (consecutiveDays % 7)}天
            </span>
          </div>
          <Progress 
            percent={((consecutiveDays % 7) / 7) * 100} 
            showInfo={false}
            strokeColor="#f59e0b"
            trailColor="#f3f4f6"
            size="small"
          />
        </div>

        {/* 签到按钮 */}
        <AnimatePresence mode="wait">
          {checkInResult?.success ? (
            <motion.div
              key="success"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="text-center py-4"
            >
              <div className="text-4xl mb-2">🎉</div>
              <div className="text-xl font-bold text-green-500">
                +{checkInResult.bonus}积分
              </div>
              <div className="text-sm text-gray-500">
                已连续签到 {checkInResult.streak} 天
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Button
                type="primary"
                onClick={handleCheckIn}
                loading={isAnimating}
                disabled={status.checkedIn}
                className={clsx(
                  "w-full h-12 rounded-xl font-medium text-lg",
                  status.checkedIn
                    ? 'bg-gray-100 text-gray-400 border-none'
                    : 'bg-gradient-to-r from-amber-400 to-orange-500 border-none'
                )}
                icon={status.checkedIn ? <CheckCircleOutlined /> : <GiftOutlined />}
              >
                {isAnimating 
                  ? '签到中...' 
                  : status.checkedIn 
                    ? '今日已签到' 
                    : '立即签到'}
              </Button>
              
              {status.checkedIn && (
                <p className="text-center text-sm text-gray-400 mt-2">
                  明天再来领取更多积分吧！
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}
