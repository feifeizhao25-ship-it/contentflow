import { FeatureNotOpen } from '@/components/common/FeatureNotOpen';

// 开放平台（API 密钥与对外接口）后端尚未对外开放，此前这里是一个会 404 的表单：
// 「创建 API Key」永远失败，示例里的接口也不存在。开放后再恢复。
export default function DeveloperPage() {
    return <FeatureNotOpen title="开放平台" detail="API 密钥与对外接口暂未对外开放，开放后会在这里通知。" />;
}
