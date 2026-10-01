'use client';

import React, { useEffect, useState } from 'react';
import { Button, Input, Space, message } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { isValidChinaMobile, type SmsSendResult } from '@/lib/auth-service';
import { safeErrorText } from '@/lib/api-error';

/**
 * 验证码输入框 + 「获取验证码」按钮（发送后倒计时，倒计时内不能再点）。
 * 作为 antd Form.Item 的子控件使用（value / onChange 由 Form.Item 注入）。
 * 后端没配短信服务时，发送会失败并显示后端的中文原因（「短信服务未配置……」），不会假装已发送。
 */
export function SmsCodeInput({
  value,
  onChange,
  getPhone,
  send,
}: {
  value?: string;
  onChange?: (value: string) => void;
  getPhone: () => string;
  send: (phone: string) => Promise<SmsSendResult>;
}) {
  const [left, setLeft] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (left <= 0) return undefined;
    const timer = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  const request = async () => {
    const phone = getPhone();
    if (!isValidChinaMobile(phone)) {
      message.error('请先输入正确的 11 位手机号');
      return;
    }
    setSending(true);
    try {
      const result = await send(phone);
      setLeft(result.resendAfterSeconds);
      message.success('验证码已发送，请注意查收短信');
    } catch (error) {
      message.error(safeErrorText(error, '验证码发送失败，请稍后重试'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Space.Compact style={{ width: '100%' }}>
      <Input
        prefix={<SafetyCertificateOutlined />}
        placeholder="6 位验证码"
        inputMode="numeric"
        maxLength={6}
        autoComplete="one-time-code"
        value={value}
        onChange={(event) => onChange?.(event.target.value.replace(/\D/g, ''))}
      />
      <Button onClick={request} loading={sending} disabled={left > 0} style={{ minWidth: 112 }}>
        {left > 0 ? `${left} 秒后重发` : '获取验证码'}
      </Button>
    </Space.Compact>
  );
}
