import { Alert, Card } from 'antd';

export default function DeveloperPage() {
    return (
        <div className="max-w-4xl mx-auto py-10 space-y-6">
            <h1 className="text-3xl font-bold">开发者中心</h1>
            <Alert type="info" showIcon message="API 密钥管理尚未开放" description="服务端密钥签发、哈希存储、权限范围、撤销和审计完成前，系统不会生成模拟密钥。" />
            <Card title="上线验收条件"><ul className="list-disc pl-5 space-y-2"><li>密钥明文只在创建时展示一次</li><li>数据库仅保存不可逆哈希</li><li>支持权限范围、到期时间和即时撤销</li><li>所有调用写入租户隔离审计日志</li></ul></Card>
        </div>
    );
}
