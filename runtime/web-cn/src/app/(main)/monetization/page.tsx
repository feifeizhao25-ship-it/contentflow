'use client';
import { DollarOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Space, Typography } from 'antd';
import Link from 'next/link';
const {Title,Text}=Typography;
export default function MonetizationPage(){return <div style={{maxWidth:960,margin:'0 auto'}}><Space direction="vertical" size={20} style={{width:'100%'}}><div><Title level={2}><DollarOutlined/> 变现中心</Title><Text type="secondary">汇总已核验的订单、广告和咨询收入，不展示估算收入。</Text></div><Alert showIcon type="warning" message="收入数据尚未接入" description="当前账户没有已核验的交易数据，因此不会展示演示金额、虚构 ROI 或预测收益。完成支付渠道与平台数据授权后才会生成报表。"/><Card><Empty description="暂无可核验的收入记录"><Link href="/settings"><Button type="primary">前往配置数据来源</Button></Link></Empty></Card></Space></div>}
