# 分发侠 - 开发指南

## 🎯 项目概述

分发侠是一个基于 Next.js 14 和 Supabase 构建的多租户 SaaS 平台，专注于 AI 内容生成和多平台分发。

## 📋 已完成功能

### ✅ 基础架构
- [x] Next.js 14 项目初始化（App Router）
- [x] TypeScript 配置
- [x] TailwindCSS 集成
- [x] Ant Design 5.x UI 库集成
- [x] 自定义主题配置（活力紫主色调）
- [x] Zustand 状态管理
- [x] Supabase 客户端配置

### ✅ 核心组件
- [x] **MainLayout**: 响应式主布局
  - 深色侧边栏导航
  - 顶部导航栏
  - 用户头像和通知
  - 侧边栏折叠功能
  
### ✅ 页面实现

#### 1. 工作台 (Dashboard)
**路径**: `/dashboard`

**功能**:
- 4个核心指标卡片（今日发布、总曝光、总互动、新增粉丝）
- 数据趋势折线图（7天数据）
- 平台分布饼图
- 本周爆款内容 TOP 3 表格

**技术栈**:
- ECharts 图表库
- Ant Design Card, Statistic, Table 组件

#### 2. AI 创作中心 (AI Create)
**路径**: `/ai-create`

**功能**:
- **文章生成**: 输入主题/关键词，选择写作风格，AI 生成完整文章
- **标题生成**: 一键生成 10+ 爆款标题
- **图片生成**: 占位符（待开发）
- **视频生成**: 占位符（待开发）

**技术栈**:
- Ant Design Tabs, Input, Select, Button
- 模拟 AI 生成（实际 API 待接入）

#### 3. 内容管理 (Contents)
**路径**: `/contents`

**功能**:
- 内容列表展示（标题、类型、状态、平台、曝光、创建时间）
- 多条件筛选（状态、类型、关键词搜索）
- 批量操作（批量发布、批量删除）
- 单条操作（预览、编辑、发布、删除）
- 行选择功能

**技术栈**:
- Ant Design Table（支持行选择）
- 状态管理和筛选逻辑

#### 4. 账号管理 (Accounts)
**路径**: `/accounts`

**功能**:
- **已绑定账号**: 展示已授权的社交媒体账号
  - 账号信息（平台、名称、粉丝数）
  - 授权状态（正常/已过期）
  - 操作按钮（续期、编辑、解绑）
- **添加平台账号**: 支持 8+ 平台绑定
  - 抖音、小红书、微信视频号、微信公众号
  - B站、微博、知乎、快手
- **配额使用情况**: 进度条展示账号数量和发布次数

**技术栈**:
- Ant Design Card, Avatar, Tag, Progress
- 网格布局（Grid System）

## 🗄️ 数据库设计

### 核心表结构

```
tenants (租户表)
├── id
├── name
├── plan (free/pro/team/enterprise)
├── status
├── limits (JSONB)
└── settings (JSONB)

profiles (用户表)
├── id
├── tenant_id
├── email
├── name
├── role (owner/admin/editor/viewer)
└── status

platform_accounts (平台账号表)
├── id
├── tenant_id
├── platform
├── account_name
├── follower_count
├── auth_type
├── auth_data (JSONB, 加密)
└── status

contents (内容表)
├── id
├── tenant_id
├── created_by
├── title
├── body
├── status (draft/pending/approved/published)
└── source (manual/ai_generated)

publish_tasks (发布任务表)
├── id
├── content_id
├── platform_account_id
├── scheduled_at
├── status
└── result (JSONB)
```

### Row Level Security (RLS)

所有表都启用了 RLS，确保租户数据隔离：
- 用户只能访问自己租户的数据
- 通过 `tenant_id` 字段实现物理隔离

## 🎨 设计系统

### 颜色规范

```typescript
// 主题色
colorPrimary: '#6366f1'      // 活力紫
colorSuccess: '#10b981'      // 成功绿
colorWarning: '#f59e0b'      // 警告橙
colorError: '#ef4444'        // 错误红
colorInfo: '#3b82f6'         // 信息蓝

// 背景色
colorBgLayout: '#f8fafc'     // 浅灰背景
siderBg: '#1e1b4b'           // 深靛蓝侧边栏
```

### 组件样式

```typescript
// 圆角
borderRadius: 8px (按钮、输入框)
borderRadius: 12px (卡片)

// 高度
controlHeight: 40px (按钮、输入框)

// 阴影
boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)'
```

## 🔧 开发工作流

### 1. 创建新页面

```bash
# 在 (main) 路由组下创建新页面
src/app/(main)/your-page/page.tsx
```

示例：
```typescript
'use client';

import { Card } from 'antd';

export default function YourPage() {
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>
        页面标题
      </h1>
      <Card>
        {/* 页面内容 */}
      </Card>
    </div>
  );
}
```

### 2. 添加菜单项

编辑 `src/components/layout/MainLayout.tsx`:

```typescript
const menuItems = [
  // ... 其他菜单项
  {
    key: '/your-page',
    icon: <YourIcon />,
    label: <Link href="/your-page">页面名称</Link>,
  },
];
```

### 3. 状态管理

使用 Zustand 添加全局状态：

```typescript
// src/store/appStore.ts
interface AppState {
  // 添加新状态
  yourState: YourType;
  setYourState: (state: YourType) => void;
}

export const useAppStore = create<AppState>((set) => ({
  yourState: initialValue,
  setYourState: (yourState) => set({ yourState }),
}));
```

### 4. API 集成

创建 API 路由处理器：

```typescript
// src/app/api/your-endpoint/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  
  // 处理逻辑
  
  return NextResponse.json({ success: true });
}
```

## 📦 待开发功能清单

### Phase 2 - 核心功能完善

- [ ] **用户认证**
  - [ ] 登录页面
  - [ ] 注册页面
  - [ ] 密码重置
  - [ ] Supabase Auth 集成

- [ ] **AI 服务集成**
  - [ ] OpenAI API 集成
  - [ ] 通义千问 API 集成
  - [ ] 图片生成 API
  - [ ] 内容审核 API

- [ ] **平台授权**
  - [ ] OAuth 2.0 流程
  - [ ] 微信公众号授权
  - [ ] 抖音开放平台授权
  - [ ] 小红书授权（浏览器扩展）

- [ ] **发布功能**
  - [ ] 发布日历组件
  - [ ] 定时发布调度器
  - [ ] 发布状态追踪
  - [ ] 失败重试机制

- [ ] **数据统计**
  - [ ] 平台数据采集 API
  - [ ] 实时数据同步
  - [ ] 报表生成
  - [ ] 数据导出

### Phase 3 - 高级功能

- [ ] **素材库**
  - [ ] 文件上传（OSS）
  - [ ] 分类管理
  - [ ] 标签系统
  - [ ] 搜索功能

- [ ] **团队协作**
  - [ ] 成员邀请
  - [ ] 角色权限
  - [ ] 审核流程
  - [ ] 评论系统

- [ ] **API 开放平台**
  - [ ] API Key 管理
  - [ ] 调用统计
  - [ ] 开发者文档
  - [ ] SDK 生成

## 🧪 测试策略

### 单元测试
```bash
# 使用 Jest + React Testing Library
npm run test
```

### E2E 测试
```bash
# 使用 Playwright
npm run test:e2e
```

## 🚀 部署指南

### Vercel 部署

1. 连接 GitHub 仓库
2. 配置环境变量
3. 自动部署

### 环境变量配置

```bash
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
OPENAI_API_KEY=your_key
DASHSCOPE_API_KEY=your_key
```

## 📝 代码规范

### 组件命名
- 页面组件: `YourPagePage`
- 布局组件: `YourLayout`
- 通用组件: `YourComponent`

### 文件组织
```
src/
├── app/              # 页面路由
├── components/       # 可复用组件
├── lib/             # 工具函数
├── store/           # 状态管理
├── config/          # 配置文件
└── types/           # TypeScript 类型定义
```

### Git Commit 规范
```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建/工具
```

## 🔍 调试技巧

### 查看 Supabase 日志
```typescript
import { supabase } from '@/lib/supabase';

const { data, error } = await supabase
  .from('your_table')
  .select('*');

console.log('Data:', data);
console.log('Error:', error);
```

### React DevTools
- 安装浏览器扩展
- 检查组件树和状态

### Network 面板
- 监控 API 请求
- 检查响应数据

## 📚 参考资源

- [Next.js 文档](https://nextjs.org/docs)
- [Ant Design 文档](https://ant.design/)
- [Supabase 文档](https://supabase.com/docs)
- [Zustand 文档](https://zustand-demo.pmnd.rs/)
- [ECharts 文档](https://echarts.apache.org/)

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交代码
4. 发起 Pull Request

---

**Happy Coding! 🎉**
