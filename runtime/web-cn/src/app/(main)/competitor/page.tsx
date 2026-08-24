'use client';
import { useCallback, useEffect, useState } from 'react';
import { ReloadOutlined, TeamOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, List, Skeleton, Space, Statistic, Tag, Typography } from 'antd';
import { apiClient } from '@/lib/api-client';
type Competitor={id:string;name:string;platform:string;accountUrl:string;lastCheckedAt:string|null;followers:number|null;engagementRate:number|null;contentCount:number|null};
const {Title,Text,Link}=Typography;
export default function CompetitorPage(){
 const [items,setItems]=useState<Competitor[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=useCallback(async()=>{setLoading(true);setError('');try{setItems(await apiClient.get<Competitor[]>('/competitor'));}catch(e){setError(e instanceof Error?e.message:'竞品数据加载失败');}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 return <div style={{maxWidth:1080,margin:'0 auto'}}><Space direction="vertical" size={20} style={{width:'100%'}}>
  <div><Title level={2}><TeamOutlined/> 竞品监控</Title><Text type="secondary">所有指标均来自已授权或公开来源，并显示最近采集时间。</Text></div>
  <Alert showIcon type="info" message="避免误判" description="未完成采集的指标显示“暂无数据”，不会以 0 或样例数字代替。请遵守平台规则及个人信息保护要求。"/>
  {loading?<Card><Skeleton active/></Card>:error?<Alert showIcon type="error" message="暂时无法读取数据" description={error} action={<Button icon={<ReloadOutlined/>} onClick={()=>void load()}>重试</Button>}/>:items.length===0?<Card><Empty description="尚未添加竞品监控。添加公开账号并完成合规授权后，数据会显示在这里。"/></Card>:
   <List grid={{gutter:16,xs:1,md:2}} dataSource={items} renderItem={i=><List.Item><Card title={<Space><span>{i.name}</span><Tag>{i.platform}</Tag></Space>} extra={i.accountUrl?<Link href={i.accountUrl} target="_blank">来源</Link>:null}><Space size="large"><Statistic title="粉丝" value={i.followers??'暂无数据'}/><Statistic title="互动率" value={i.engagementRate==null?'暂无数据':`${(i.engagementRate*100).toFixed(2)}%`}/><Statistic title="内容数" value={i.contentCount??'暂无数据'}/></Space><div style={{marginTop:16}}><Text type="secondary">最近采集：{i.lastCheckedAt?new Date(i.lastCheckedAt).toLocaleString('zh-CN'):'尚未采集'}</Text></div></Card></List.Item>}/>}
 </Space></div>;
}
