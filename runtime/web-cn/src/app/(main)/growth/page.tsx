'use client';
import { useCallback, useEffect, useState } from 'react';
import { AimOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, List, Progress, Skeleton, Space, Tag, Typography } from 'antd';
import { apiClient } from '@/lib/api-client';
type Goal = { id:string; targetType:string; targetValue:number; currentValue:number; periodType:string; endDate:string; progress:number };
type Plan = { goals:Goal[]; hasGoals:boolean };
const { Title, Text } = Typography;
export default function GrowthPage() {
  const [plan,setPlan]=useState<Plan|null>(null), [loading,setLoading]=useState(true), [error,setError]=useState('');
  const load=useCallback(async()=>{ setLoading(true); setError(''); try{setPlan(await apiClient.get<Plan>('/growth/plan'));}catch(e){setError(e instanceof Error?e.message:'增长目标加载失败');}finally{setLoading(false);}},[]);
  useEffect(()=>{void load();},[load]);
  return <div style={{maxWidth:960,margin:'0 auto'}}><Space direction="vertical" size={20} style={{width:'100%'}}>
    <div><Title level={2}><AimOutlined /> 增长目标</Title><Text type="secondary">仅展示已保存的真实目标；系统不会用行业样例冒充您的数据。</Text></div>
    <Alert showIcon type="info" message="数据口径" description="进度来自您账户中的目标记录。平台曝光、互动和收入尚未接入时不会生成推测值。" />
    {loading?<Card><Skeleton active/></Card>:error?<Alert showIcon type="error" message="暂时无法读取数据" description={error} action={<Button icon={<ReloadOutlined/>} onClick={()=>void load()}>重试</Button>}/>:!plan?.hasGoals?<Card><Empty description="尚未设置增长目标。请先完成账号绑定和数据授权，再创建可追踪的目标。"/></Card>:
      <List dataSource={plan.goals} renderItem={g=><Card style={{marginBottom:12}}><Space direction="vertical" style={{width:'100%'}}><Space><Text strong>{g.targetType}</Text><Tag>{g.periodType}</Tag><Text type="secondary">截止 {new Date(g.endDate).toLocaleDateString('zh-CN')}</Text></Space><Progress percent={Math.round(g.progress*100)}/><Text>{g.currentValue.toLocaleString('zh-CN')} / {g.targetValue.toLocaleString('zh-CN')}</Text></Space></Card>}/>}
  </Space></div>;
}
