'use client';

import React, { useState } from 'react';
import { Alert, Button, Form, Input, Space, Tag, Typography } from 'antd';
import { message } from '@/lib/antd-app';
import { MobileOutlined } from '@ant-design/icons';
import { bindPhone, isValidChinaMobile, sendBindCode } from '@/lib/auth-service';
import { safeErrorText } from '@/lib/api-error';
import { SmsCodeInput } from './SmsCodeInput';

/**
 * 设置页「手机号与实名」：已绑定显示脱敏手机号；未绑定给「手机号 + 验证码」表单。
 * 发布信息类服务需要实名：实名认证（公安 / 运营商二要素）服务尚未接入，这里如实写「暂未开通」，
 * 不提供任何「假装已认证」的入口。
 */
export function PhoneBinding({
  phone,
  phoneVerified,
  realNameVerified,
  onBound,
}: {
  phone?: string;
  phoneVerified?: boolean;
  realNameVerified?: boolean;
  onBound: (maskedPhone: string) => void;
}) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const bound = !!phone && !!phoneVerified;

  const submit = async (values: { phone: string; code: string }) => {
    setSubmitting(true);
    try {
      const result = await bindPhone({ phone: values.phone, code: values.code });
      message.success('手机号已绑定');
      form.resetFields();
      onBound(result.phone);
    } catch (error) {
      message.error(safeErrorText(error, '绑定失败，请稍后重试'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <Typography.Text strong>手机号：</Typography.Text>{' '}
          {bound ? (
            <>
              <Typography.Text>{phone}</Typography.Text> <Tag color="green">已验证</Tag>
            </>
          ) : (
            <Tag>未绑定</Tag>
          )}
        </div>
        <div>
          <Typography.Text strong>实名认证：</Typography.Text>{' '}
          {realNameVerified ? <Tag color="green">已实名</Tag> : <Tag color="gold">未认证</Tag>}
          {!realNameVerified && (
            <Typography.Text type="secondary">实名认证服务暂未开通，开通后会在这里通知并引导完成。</Typography.Text>
          )}
        </div>
      </Space>

      {!bound && (
        <Form form={form} layout="vertical" onFinish={submit} style={{ marginTop: 16 }} autoComplete="off">
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="绑定手机号后，可使用手机验证码登录。验证码短信发送至该号码，仅用于验证本人。"
          />
          <Form.Item
            label="手机号"
            name="phone"
            rules={[
              { required: true, message: '请输入手机号' },
              { validator: (_, value) => (!value || isValidChinaMobile(value) ? Promise.resolve() : Promise.reject(new Error('请输入正确的 11 位手机号'))) },
            ]}
          >
            <Input prefix={<MobileOutlined />} placeholder="11 位手机号" inputMode="tel" maxLength={16} />
          </Form.Item>
          <Form.Item label="验证码" name="code" rules={[{ required: true, message: '请输入验证码' }, { pattern: /^\d{6}$/, message: '验证码为 6 位数字' }]}>
            <SmsCodeInput
              getPhone={() => String(form.getFieldValue('phone') ?? '')}
              send={(p) => sendBindCode({ phone: p })}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>
            绑定手机号
          </Button>
        </Form>
      )}
    </div>
  );
}
