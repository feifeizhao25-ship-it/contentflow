'use client';

import { CrownOutlined, SafetyOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Avatar, Card, Empty, Skeleton, Table, Tag } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface TeamMember {
  id: string;
  name?: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

function unwrapMembers(payload: any): TeamMember[] {
  const value = payload?.data ?? payload;
  return Array.isArray(value) ? value : Array.isArray(value?.members) ? value.members : [];
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setMembers(unwrapMembers(await apiClient.get('/team/members')));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '团队成员加载失败');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const columns = [
    {
      title: '成员',
      key: 'member',
      render: (_: unknown, member: TeamMember) => (
        <div className="flex items-center gap-3"><Avatar icon={<UserOutlined />} /><div><div className="font-medium">{member.name || '未设置姓名'}</div><div className="text-xs text-zinc-500">{member.email}</div></div></div>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      render: (role: string) => <Tag icon={role === 'owner' ? <CrownOutlined /> : <SafetyOutlined />} color={role === 'owner' ? 'gold' : 'blue'}>{role}</Tag>,
    },
    { title: '状态', dataIndex: 'status', render: (status: string) => <Tag color={status === 'active' ? 'green' : 'default'}>{status}</Tag> },
    { title: '加入时间', dataIndex: 'created_at', render: (value: string) => new Date(value).toLocaleDateString('zh-CN') },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div><h1 className="text-3xl font-bold">团队协作</h1><p className="text-zinc-500 mt-1">成员列表严格限定在当前租户。</p></div>
      <Alert
        type="info"
        showIcon
        message="成员邀请暂未开放"
        description="签名邀请邮件、一次性接受令牌、角色授权和审计记录完整上线前，系统不会直接创建一个无法登录的成员账号。"
      />
      {error && <Alert type="error" showIcon message="成员加载失败" description={error} action={<a onClick={() => void load()}>重试</a>} />}
      <Card>{loading ? <Skeleton active /> : members.length === 0 ? <Empty description="当前工作区暂无成员" /> : <Table rowKey="id" columns={columns} dataSource={members} pagination={false} />}</Card>
    </div>
  );
}
