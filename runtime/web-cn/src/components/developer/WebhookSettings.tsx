'use client';

import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Checkbox, Input, Tag } from 'antd';
import { apiClient, FriendlyApiError } from '@/lib/api-client';
import { safeErrorText } from '@/lib/api-error';

const EVENTS = [
  { id: 'content.generated', label: '内容已生成' },
  { id: 'publish.task.success', label: '人工发布已确认' },
];

interface Subscription {
  id: string;
  url: string;
  events: string[];
  status: string;
}

/**
 * 对外通知只对 Business 开放，走已有的订阅接口。
 * API 密钥仍未对外开放，这里不提供创建密钥的入口。
 */
export function WebhookSettings() {
  const [gate, setGate] = useState<'loading' | 'closed' | 'open'>('loading');
  const [gateMessage, setGateMessage] = useState('正在确认当前套餐是否可以设置对外通知');
  const [rows, setRows] = useState<Subscription[]>([]);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>(['content.generated']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [secret, setSecret] = useState('');

  const load = async () => {
    try {
      const data = await apiClient.get<Subscription[]>('/developer/webhooks', { redirectOn401: false });
      setRows(Array.isArray(data) ? data : []);
      setGate('open');
    } catch (err) {
      const text = safeErrorText(err, '暂时无法读取对外通知设置');
      if (err instanceof FriendlyApiError && (err.status === 403 || /Business/.test(text))) {
        setGate('closed');
        setGateMessage(text);
        return;
      }
      setGate('closed');
      setGateMessage(text);
    }
  };

  useEffect(() => { void load(); }, []);

  const create = async () => {
    setSaving(true);
    setError('');
    setSecret('');
    try {
      const created = await apiClient.post<{ secret?: string; secret_note?: string }>('/developer/webhooks', { url, events });
      setSecret(typeof created?.secret === 'string' ? created.secret : '');
      setUrl('');
      await load();
    } catch (err) {
      setError(safeErrorText(err, '没有保存成功，请检查地址后重试'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-black text-zinc-900">对外通知</h1>
        <p className="mt-2 text-sm text-zinc-500">内容生成或人工确认发布后，向你填写的公网地址发送通知。API 密钥与其它对外接口仍未开放。</p>
      </div>
      <Alert type="info" showIcon message="API 密钥暂未对外开放" description="这里只能设置对外通知地址，不能创建接口密钥。" />
      {gate === 'loading' && <p className="text-sm text-zinc-500">{gateMessage}</p>}
      {gate === 'closed' && (
        <Alert data-testid="webhook-gate" type="warning" showIcon message="当前套餐不能设置对外通知" description={gateMessage} />
      )}
      {gate === 'open' && (
        <Card data-testid="webhook-form">
          <p className="mb-3 text-sm text-zinc-600">仅 Business 档可以保存。地址必须是公网 https，签名密钥只在创建时显示一次。</p>
          <label className="mb-1 block text-sm text-zinc-600" htmlFor="webhook-url">通知地址</label>
          <Input id="webhook-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/hooks" />
          <div className="mt-3">
            <Checkbox.Group
              value={events}
              onChange={(value) => setEvents(value as string[])}
              options={EVENTS.map((item) => ({ label: item.label, value: item.id }))}
            />
          </div>
          <Button className="mt-4" type="primary" loading={saving} disabled={!url.trim() || events.length === 0} onClick={() => void create()}>
            保存通知地址
          </Button>
          {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
          {secret && (
            <Alert
              className="mt-4"
              type="success"
              showIcon
              message="签名密钥只显示这一次"
              description={<span data-testid="webhook-secret">{secret}</span>}
            />
          )}
          <div className="mt-6 space-y-2">
            {rows.length === 0 && <p className="text-sm text-zinc-500">还没有通知地址。</p>}
            {rows.map((row) => (
              <div key={row.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
                <div className="break-all font-medium">{row.url}</div>
                <div className="mt-1 text-zinc-500">{(row.events || []).map((id) => EVENTS.find((item) => item.id === id)?.label || id).join('、')}</div>
                <Tag className="mt-2">{row.status === 'active' ? '启用' : row.status}</Tag>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
