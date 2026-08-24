# 📚 分发侠 (ContentFlow) 项目完整技术文档

> 版本: v2.0  
> 更新日期: 2026年1月  
> 项目地址: https://github.com/your-org/fenfa-ai

---

## 📋 目录

1. [项目概述](#1-项目概述)
2. [技术栈总览](#2-技术栈总览)
3. [项目架构](#3-项目架构)
4. [核心功能模块](#4-核心功能模块)
5. [数据库设计](#5-数据库设计)
6. [API接口规范](#6-api接口规范)
7. [前端组件系统](#7-前端组件系统)
8. [状态管理](#8-状态管理)
9. [AI服务集成](#9-ai服务集成)
10. [部署指南](#10-部署指南)
11. [开发规范](#11-开发规范)
12. [常见问题](#12-常见问题)

---

## 1. 项目概述

### 1.1 产品介绍

**分发侠** 是一款面向自媒体运营者、营销团队和内容创作者的 AI 驱动全渠道内容分发 SaaS 平台。

### 1.2 核心价值

| 价值主张 | 描述 |
|---------|------|
| 🚀 AI智能创作 | 接入顶级AI模型，支持文章、标题、配图、视频一键生成 |
| 📱 多平台分发 | 支持抖音、小红书、微信视频号、B站、微博等主流平台 |
| 📅 智能排期 | 灵活设置发布时间，支持定时任务与日历视图管理 |
| 📊 数据分析 | 汇总多平台流量数据，可视化呈现内容表现 |
| 🎨 素材管理 | 云端管理图片、视频、文案素材，支持团队共享 |
| 👥 团队协作 | 完善的权限管理系统，支持多成员协同作业 |

### 1.3 目标用户

- 自媒体运营者
- 营销团队
- 内容创作者
- MCN机构
- 电商卖家

---

## 2. 技术栈总览

### 2.1 前端技术栈

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | Next.js | 16.1.1 | React全栈框架 |
| 语言 | TypeScript | 5.x | 类型安全 |
| UI组件库 | Ant Design | 6.1.3 | 企业级组件 |
| 样式 | Tailwind CSS | 4.x | 原子化CSS |
| 状态管理 | Zustand | 5.0.9 | 轻量级状态管理 |
| 图表 | ECharts | 6.0.0 | 数据可视化 |
| 富文本编辑 | TipTap | 3.14.0 | 所见即所得编辑 |
| 动画 | Framer Motion | 12.29.0 | 交互动画 |
| 图标 | Lucide React | 0.562.0 | 图标库 |
| 日期处理 | Day.js | 1.11.19 | 日期格式化 |
| HTTP客户端 | Supabase | 2.89.0 | API调用 |

### 2.2 后端技术栈

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | NestJS | 11.x | Node.js企业级框架 |
| ORM | Prisma | 6.x | 数据库ORM |
| 数据库 | PostgreSQL | 15+ | 主数据库 |
| 认证 | JWT | - | Token认证 |
| 缓存 | Redis | 7.x | 缓存层 |
| 任务队列 | Bull | - | 异步任务队列 |

### 2.3 AI服务集成

| 服务商 | 模型 | 用途 |
|--------|------|------|
| OpenRouter | DeepSeek-V3 | 文本生成 |
| SiliconFlow | Qwen-2.5-7B | 文本生成 |
| Fal.ai | Flux-Schnell | 图片生成 |
| Fal.ai | 视频生成 | 视频生成 |

### 2.4 基础设施

| 类别 | 技术 | 用途 |
|------|------|------|
| 部署平台 | Vercel | 前端部署 |
| 容器化 | Docker | 后端容器化 |
| 数据库托管 | Supabase | PostgreSQL托管 |
| 版本控制 | Git | 代码管理 |

---

## 3. 项目架构

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户层 (User Layer)                       │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐   │
│  │ Web浏览器  │  │  移动端   │  │  小程序   │  │  API调用   │   │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘   │
└────────┼──────────────┼──────────────┼──────────────┼──────────┘
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                                │
                    ┌───────────┴───────────┐
                    │    CDN / Nginx        │
                    │    (负载均衡 & 静态资源) │
                    └───────────┬───────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   Next.js 前端   │   │   NestJS 后端   │   │    AI Services  │
│   (Vercel)      │   │   (Docker)      │   │   (外部API)     │
│                 │   │                 │   │                 │
│  ┌───────────┐  │   │  ┌───────────┐  │   │  ┌───────────┐  │
│  │  React    │  │   │  │  Controller│  │   │  │OpenRouter │  │
│  │  TypeScript│  │   │  │  Services │  │   │  │SiliconFlow│  │
│  │  Zustand  │  │   │  │  Prisma   │  │   │  │ Fal.ai    │  │
│  │  Antd    │  │   │  │  Redis    │  │   │  └───────────┘  │
│  └───────────┘  │   │  └───────────┘  │   │                 │
└────────┬────────┘   └────────┬────────┘   └─────────────────┘
         │                      │
         └──────────────────────┴────────────────────────┐
                                                        │
                                            ┌───────────┴───────────┐
                                            │     PostgreSQL        │
                                            │   (Supabase/自建)     │
                                            │                       │
                                            │  ┌─────────────────┐  │
                                            │  │   主数据库      │  │
                                            │  │   Redis缓存     │  │
                                            │  │   Blob存储      │  │
                                            └─────────────────────┘
```

### 3.2 前端项目结构

```
fenfa-ai/
├── src/
│   ├── app/                           # Next.js App Router
│   │   ├── (main)/                    # 主应用路由组（需要认证）
│   │   │   ├── ai-create/             # AI创作中心
│   │   │   │   └── page.tsx           # 创作页面
│   │   │   ├── dashboard/             # 工作台
│   │   │   │   └── page.tsx           # 仪表盘
│   │   │   ├── points/                # 积分商城
│   │   │   │   └── page.tsx           # 积分页面
│   │   │   ├── materials/             # 素材库
│   │   │   │   └── page.tsx           # 素材管理
│   │   │   ├── my-videos/             # 我的视频
│   │   │   │   └── page.tsx           # 视频列表
│   │   │   ├── overview/              # 首页总览
│   │   │   │   └── page.tsx           # 总览页面
│   │   │   ├── achievements/          # 成就系统
│   │   │   │   └── page.tsx           # 成就页面
│   │   │   ├── calendar/              # 发布日历
│   │   │   │   └── page.tsx           # 日历页面
│   │   │   ├── community/             # 社区
│   │   │   │   └── page.tsx           # 社区页面
│   │   │   ├── monetization/          # 变现中心
│   │   │   │   └── page.tsx           # 变现页面
│   │   │   ├── persona/               # 人设模板
│   │   │   │   └── page.tsx           # 人设管理
│   │   │   ├── competitor/            # 竞品分析
│   │   │   │   └── page.tsx           # 竞品页面
│   │   │   ├── growth/                # 增长目标
│   │   │   │   └── page.tsx           # 增长页面
│   │   │   ├── settings/              # 设置
│   │   │   │   └── page.tsx           # 设置页面
│   │   │   └── layout.tsx             # 主布局包装器
│   │   ├── api/                       # Next.js API Routes
│   │   │   ├── ai/
│   │   │   │   └── generate-image/
│   │   │   │       └── fal/
│   │   │   │           └── route.ts   # Fal.ai图片生成
│   │   │   ├── upload/
│   │   │   │   └── route.ts           # 文件上传
│   │   │   ├── payment/
│   │   │   │   └── route.ts           # 支付回调
│   │   │   ├── onboarding/
│   │   │   │   └── reward/
│   │   │   │       └── route.ts       # 新手奖励
│   │   │   └── auth/
│   │   │       └── [...nextauth]/
│   │   │           └── route.ts       # 认证处理
│   │   ├── layout.tsx                 # 根布局
│   │   ├── page.tsx                   # 首页（重定向）
│   │   └── error.tsx                  # 错误边界
│   │
│   ├── components/                    # 公共组件
│   │   ├── layout/
│   │   │   └── MainLayout.tsx         # 主布局组件
│   │   ├── editor/
│   │   │   └── TiptapEditor.tsx       # 富文本编辑器
│   │   ├── video/
│   │   │   ├── VideoStylePicker.tsx   # 视频风格选择
│   │   │   ├── VoiceoverPanel.tsx     # 配音面板
│   │   │   └── SubtitleEditor.tsx     # 字幕编辑
│   │   ├── onboarding/                # 新手引导组件
│   │   │   ├── OnboardingGuide.tsx
│   │   │   ├── EnhancedOnboardingGuide.tsx
│   │   │   ├── DomainSelector.tsx
│   │   │   ├── PlatformSelector.tsx
│   │   │   ├── FirstScriptGuide.tsx
│   │   │   ├── FirstVideoGuide.tsx
│   │   │   └── CompletionGuide.tsx
│   │   ├── membership/
│   │   │   └── PremiumGate.tsx        # 付费门槛组件
│   │   ├── checkin/
│   │   │   └── CheckInModal.tsx       # 签到弹窗
│   │   ├── share/
│   │   │   └── ShareModal.tsx         # 分享弹窗
│   │   ├── dashboard/
│   │   │   └── DashboardWorkspace.tsx # 工作台组件
│   │   ├── image/
│   │   │   └── ImageEditor.tsx        # 图片编辑器
│   │   └── error/
│   │       └── ErrorBoundary.tsx      # 错误边界
│   │
│   ├── lib/                           # 服务层
│   │   ├── supabase.ts                # Supabase客户端
│   │   ├── ai-service.ts              # AI服务封装
│   │   ├── content-service.ts         # 内容服务
│   │   ├── points-service.ts          # 积分服务
│   │   ├── materials-service.ts       # 素材服务
│   │   ├── payment-service.ts         # 支付服务
│   │   ├── video-service.ts           # 视频服务
│   │   ├── tts-service.ts             # TTS服务
│   │   ├── music-service.ts           # 音乐服务
│   │   ├── subtitle-service.ts        # 字幕服务
│   │   ├── referral-service.ts        # 分享服务
│   │   ├── enhanced-script-service.ts # 增强脚本服务
│   │   └── frame-consistency-service.ts # 帧一致性服务
│   │
│   ├── store/                         # 状态管理
│   │   ├── appStore.ts                # 应用状态
│   │   ├── pointsStore.ts             # 积分状态
│   │   ├── themeStore.ts              # 主题状态
│   │   └── onboardingStore.ts         # 新手引导状态
│   │
│   ├── hooks/                         # 自定义Hooks
│   │   ├── usePermissions.ts          # 权限Hook
│   │   └── useVideoGeneration.ts      # 视频生成Hook
│   │
│   └── types/                         # 类型定义
│       └── new-features.ts            # 新功能类型
│
├── public/                            # 静态资源
├── supabase/                          # Supabase配置
│   └── migrations/                    # 数据库迁移
│       ├── 001_initial_schema.sql
│       ├── 002_ai_content_tables.sql
│       ├── 003_new_features.sql
│       └── 004_payment_system.sql
│
├── .env.example                       # 环境变量模板
├── .env.local                         # 本地环境变量（不提交）
├── next.config.ts                     # Next.js配置
├── tailwind.config.ts                 # Tailwind配置
├── tsconfig.json                      # TypeScript配置
├── package.json                       # 依赖配置
└── README.md                          # 项目说明
```

### 3.3 后端项目结构

```
api/
├── src/
│   ├── main.ts                        # 应用入口
│   ├── app.module.ts                  # 根模块
│   │
│   ├── common/                        # 公共模块
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts  # 异常过滤器
│   │   ├── interceptors/
│   │   │   └── transform.interceptor.ts   # 响应转换
│   │   ├── middleware/
│   │   │   └── request-logger.middleware.ts # 请求日志
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts          # JWT认证守卫
│   │   └── decorators/
│   │       └── @CurrentUser()             # 当前用户装饰器
│   │
│   ├── modules/                       # 业务模块
│   │   ├── auth/                      # 认证模块
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/
│   │   │   │   └── jwt.strategy.ts
│   │   │   └── dto/
│   │   │       ├── login.dto.ts
│   │   │       └── register.dto.ts
│   │   │
│   │   ├── user/                      # 用户模块
│   │   │   ├── user.module.ts
│   │   │   ├── user.controller.ts
│   │   │   └── user.service.ts
│   │   │
│   │   ├── tenant/                    # 租户模块
│   │   │   ├── tenant.module.ts
│   │   │   └── tenant.service.ts
│   │   │
│   │   ├── content/                   # 内容模块
│   │   │   ├── content.module.ts
│   │   │   ├── content.controller.ts
│   │   │   └── content.service.ts
│   │   │
│   │   ├── publish/                   # 发布模块
│   │   │   ├── publish.module.ts
│   │   │   ├── publish.controller.ts
│   │   │   └── publish.service.ts
│   │   │
│   │   ├── account/                   # 账号模块
│   │   │   ├── account.module.ts
│   │   │   ├── account.controller.ts
│   │   │   └── account.service.ts
│   │   │
│   │   ├── analytics/                 # 分析模块
│   │   │   ├── analytics.module.ts
│   │   │   ├── analytics.controller.ts
│   │   │   └── analytics.service.ts
│   │   │
│   │   ├── ai/                        # AI模块
│   │   │   ├── ai.module.ts
│   │   │   ├── ai.controller.ts
│   │   │   └── ai.service.ts
│   │   │
│   │   ├── hot/                       # 热点模块
│   │   │   ├── hot.module.ts
│   │   │   ├── hot.controller.ts
│   │   │   └── hot.service.ts
│   │   │
│   │   ├── competitor/                # 竞品模块
│   │   │   ├── competitor.module.ts
│   │   │   ├── competitor.controller.ts
│   │   │   └── competitor.service.ts
│   │   │
│   │   ├── team/                      # 团队模块
│   │   │   ├── team.module.ts
│   │   │   ├── team.controller.ts
│   │   │   └── team.service.ts
│   │   │
│   │   ├── materials/                 # 素材模块
│   │   │   ├── materials.module.ts
│   │   │   ├── materials.controller.ts
│   │   │   └── materials.service.ts
│   │   │
│   │   ├── growth/                    # 增长模块
│   │   │   ├── growth.module.ts
│   │   │   ├── growth.controller.ts
│   │   │   └── growth.service.ts
│   │   │
│   │   ├── points/                    # 积分模块
│   │   │   ├── points.module.ts
│   │   │   ├── points.controller.ts
│   │   │   └── points.service.ts
│   │   │
│   │   ├── rewards/                   # 奖励模块
│   │   │   ├── rewards.module.ts
│   │   │   ├── rewards.controller.ts
│   │   │   └── rewards.service.ts
│   │   │
│   │   ├── quest/                     # 任务模块
│   │   │   ├── quest.module.ts
│   │   │   ├── quest.controller.ts
│   │   │   └── quest.service.ts
│   │   │
│   │   ├── achievement/               # 成就模块
│   │   │   ├── achievement.module.ts
│   │   │   ├── achievement.controller.ts
│   │   │   └── achievement.service.ts
│   │   │
│   │   └── publish/                   # 发布模块
│   │       ├── publish.module.ts
│   │       ├── publish.controller.ts
│   │       └── publish.service.ts
│   │
│   ├── database/                      # 数据库层
│   │   ├── database.module.ts
│   │   ├── prisma.service.ts
│   │   └── prisma/
│   │       └── schema.prisma          # Prisma Schema
│   │
│   ├── cache/                         # 缓存层
│   │   ├── cache.module.ts
│   │   └── cache.service.ts
│   │
│   └── queue/                         # 任务队列
│       ├── queue.module.ts
│       ├── publish-queue.service.ts
│       ├── ai-queue.service.ts
│       └── data-sync-queue.service.ts
│
├── prisma/
│   └── schema.prisma                  # Prisma Schema
│
├── test/                              # 测试文件
├── Dockerfile                         # Docker配置
├── docker-compose.yml                 # Docker Compose
├── package.json                       # 依赖配置
└── tsconfig.json                      # TypeScript配置
```

---

## 4. 核心功能模块

### 4.1 AI创作中心

#### 功能描述
支持AI生成文章、标题、配图、视频等多种内容形式。

#### 核心文件
- `src/app/(main)/ai-create/page.tsx` - 创作页面
- `src/lib/ai-service.ts` - AI服务封装
- `src/lib/enhanced-script-service.ts` - 增强脚本服务

#### 功能特性
```typescript
// 支持的内容类型
type ContentType = 'article' | 'headline' | 'image' | 'video';

// AI生成参数
interface AIGenerationParams {
  type: ContentType;
  topic: string;
  style?: string;
  tone?: string;
  length?: number;
  platforms?: string[];
}

// 使用示例
const generateArticle = async (params: AIGenerationParams) => {
  const result = await aiService.generate(params);
  return result;
};
```

### 4.2 多平台分发

#### 功能描述
支持一键分发内容到多个社交媒体平台。

#### 支持平台
- 抖音 (Douyin)
- 小红书 (Xiaohongshu)
- 微信视频号 (VideoChannel)
- B站 (Bilibili)
- 微博 (Weibo)
- 快手 (Kuaishou)
- 知乎 (Zhihu)
- 今日头条 (TouTiao)

#### 核心文件
- `src/lib/content-service.ts` - 内容服务
- `api/src/modules/publish/` - 发布模块

### 4.3 积分商城系统

#### 功能描述
用户通过签到、创作、分享等行为获取积分，可兑换优惠券、VIP会员、云存储等。

#### 积分获取规则
| 行为 | 积分 | 说明 |
|------|------|------|
| 每日签到 | +10~45 | 连续签到额外奖励 |
| 创建内容 | +20 | 每次创建 |
| 发布内容 | +30 | 每次发布 |
| 邀请好友 | +100 | 成功邀请 |

#### 兑换商品
| 商品 | 积分价格 | 类型 |
|------|----------|------|
| 10元优惠券 | 500 | coupon |
| 30元优惠券 | 1200 | coupon |
| 1天VIP会员 | 100 | subscription |
| 7天VIP会员 | 500 | subscription |
| 30天VIP会员 | 1500 | subscription |
| 10GB云存储 | 800 | storage |
| 50GB云存储 | 3000 | storage |
| 专属头像框 | 2000 | other |

#### 核心文件
- `src/app/(main)/points/page.tsx` - 积分页面
- `src/store/pointsStore.ts` - 积分状态管理
- `src/components/checkin/CheckInModal.tsx` - 签到弹窗

### 4.4 成就系统

#### 功能描述
用户完成特定任务可解锁成就，获得积分奖励。

#### 成就分类
- `general` - 通用成就
- `content` - 内容成就
- `social` - 社交成就
- `milestone` - 里程碑成就

#### 核心文件
- `src/app/(main)/achievements/page.tsx` - 成就页面
- `api/src/modules/achievement/` - 成就模块

### 4.5 新手引导系统

#### 功能描述
5步渐进式引导，帮助新用户快速上手。

#### 引导流程
1. **领域选择** - 选择创作领域
2. **平台选择** - 选择目标平台
3. **第一篇脚本** - 生成第一篇AI脚本
4. **第一支视频** - 生成第一支视频
5. **完成引导** - 展示完成奖励

#### 核心文件
- `src/components/onboarding/` - 引导组件
- `src/store/onboardingStore.ts` - 引导状态

### 4.6 数据分析

#### 功能描述
汇总多平台流量数据，可视化呈现内容表现。

#### 核心指标
- 发布数量
- 互动量（点赞、评论、分享）
- 播放量/阅读量
- 粉丝增长
- 互动率

#### 核心文件
- `src/app/(main)/dashboard/page.tsx` - 工作台
- `src/components/dashboard/DashboardWorkspace.tsx` - 仪表盘组件
- `api/src/modules/analytics/` - 分析模块

---

## 5. 数据库设计

### 5.1 ER图概览

```
┌─────────────────────────────────────────────────────────────────┐
│                        核心实体关系                              │
└─────────────────────────────────────────────────────────────────┘

Tenant (租户)
├── 1:N User (用户)
├── 1:N Content (内容)
├── 1:N PlatformAccount (平台账号)
├── 1:N PublishTask (发布任务)
├── 1:N Material (素材)
├── 1:N Subscription (订阅)
├── 1:N ApiKey (API密钥)
├── 1:N ActivityLog (活动日志)
└── 1:N PaymentOrder (支付订单)

User (用户)
├── 1:N Content (创建的内容)
├── N:1 Tenant (所属租户)
├── 1:1 UserPoints (积分信息)
├── 1:N UserAchievement (成就进度)
└── 1:N UserGamification (游戏化数据)

Content (内容)
├── N:1 Tenant (所属租户)
├── 1:N PlatformContent (平台适配内容)
├── 1:N PublishTask (发布任务)
├── 1:N AIGeneration (AI生成记录)
├── 1:N ContentAnnotation (标注)
└── 1:N ContentPrediction (预测)

PlatformAccount (平台账号)
├── N:1 Tenant (所属租户)
└── 1:N PublishTask (发布任务)

PublishTask (发布任务)
├── N:1 Tenant (所属租户)
├── N:1 Content (发布的内容)
├── N:1 PlatformAccount (发布的账号)
└── 1:N ContentStats (统计数据)

UserPoints (用户积分)
├── N:1 User (所属用户)
├── 1:N PointsLog (积分记录)
└── 1:N RedemptionRecord (兑换记录)

Reward (奖励)
└── 1:N RedemptionRecord (兑换记录)

Achievement (成就)
└── 1:N UserAchievement (用户成就进度)
```

### 5.2 核心表结构

#### 5.2.1 Tenant (租户)

```sql
CREATE TABLE "Tenant" (
  id                UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(255) NOT NULL,
  slug              VARCHAR(100) UNIQUE NOT NULL,
  logo_url          TEXT,
  
  -- 套餐信息
  plan              VARCHAR(50) DEFAULT 'free',
  plan_expires_at   TIMESTAMP,
  
  -- 配额限制 (JSON)
  limits            JSONB DEFAULT '{
    "max_accounts": 2,
    "max_members": 1,
    "max_publishes_monthly": 30,
    "max_ai_calls_monthly": 20,
    "max_storage_gb": 1
  }',
  
  -- 使用统计 (JSON)
  usage_stats       JSONB DEFAULT '{
    "accounts_count": 0,
    "members_count": 1,
    "publishes_this_month": 0,
    "ai_calls_this_month": 0,
    "storage_used_mb": 0
  }',
  
  status            VARCHAR(20) DEFAULT 'active',
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);
```

#### 5.2.2 User (用户)

```sql
CREATE TABLE "User" (
  id                UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID    NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  
  -- 基本信息
  email             VARCHAR(255) NOT NULL,
  phone             VARCHAR(20),
  password_hash     VARCHAR(255),
  name              VARCHAR(100),
  avatar_url        TEXT,
  
  -- 角色权限
  role              VARCHAR(50) DEFAULT 'member',
  permissions       JSONB DEFAULT '[]',
  
  -- 认证信息
  email_verified    BOOLEAN DEFAULT false,
  phone_verified    BOOLEAN DEFAULT false,
  last_login_at     TIMESTAMP,
  login_count       INTEGER DEFAULT 0,
  oauth_providers   JSONB DEFAULT '{}',
  
  status            VARCHAR(20) DEFAULT 'active',
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(tenant_id, email)
);
```

#### 5.2.3 Content (内容)

```sql
CREATE TABLE "Content" (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID    NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  created_by      UUID,
  
  -- 内容基本信息
  content_type    VARCHAR(50) NOT NULL,
  title           VARCHAR(500),
  summary         TEXT,
  body            TEXT,
  body_html       TEXT,
  cover_url       TEXT,
  media_urls      JSONB DEFAULT '[]',
  
  -- 分类标签
  category        VARCHAR(100),
  tags            JSONB DEFAULT '[]',
  keywords        JSONB DEFAULT '[]',
  
  -- 内容来源
  source          VARCHAR(50) DEFAULT 'manual',
  source_url      TEXT,
  
  -- AI生成参数
  ai_params       JSONB,
  ai_model        VARCHAR(100),
  
  -- 内容评分
  quality_score   INTEGER,
  viral_score     INTEGER,
  
  -- 状态
  status          VARCHAR(20) DEFAULT 'draft',
  version         INTEGER DEFAULT 1,
  
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  published_at    TIMESTAMP
);
```

#### 5.2.4 UserPoints (用户积分)

```sql
CREATE TABLE "UserPoints" (
  id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID    UNIQUE NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  
  -- 积分余额
  balance             INTEGER DEFAULT 0,
  total_earned        INTEGER DEFAULT 0,
  total_spent         INTEGER DEFAULT 0,
  
  -- 签到相关
  streak_days         INTEGER DEFAULT 0,
  last_checkin_date   TIMESTAMP,
  longest_streak      INTEGER DEFAULT 0,
  
  -- 等级信息
  level               INTEGER DEFAULT 1,
  experience_points   INTEGER DEFAULT 0,
  
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);
```

#### 5.2.5 Reward (奖励)

```sql
CREATE TABLE "Reward" (
  id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- 商品信息
  name                VARCHAR(255) NOT NULL,
  description         TEXT,
  image_url           TEXT,
  category            VARCHAR(50) DEFAULT 'coupon',
  
  -- 价格
  points_required     INTEGER NOT NULL,
  
  -- 库存
  stock               INTEGER,
  stock_unlimited     BOOLEAN DEFAULT false,
  
  -- 使用限制
  usage_limit_per_user INTEGER DEFAULT 1,
  expires_at          TIMESTAMP,
  
  -- 状态
  is_active           BOOLEAN DEFAULT true,
  is_featured         BOOLEAN DEFAULT false,
  sort_order          INTEGER DEFAULT 0,
  
  -- 兑换后的奖励详情
  reward_details      JSONB,
  
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);
```

### 5.3 数据库迁移文件

迁移文件位于 `supabase/migrations/` 目录：

| 文件 | 说明 |
|------|------|
| `001_initial_schema.sql` | 初始数据库架构 |
| `002_ai_content_tables.sql` | AI内容相关表 |
| `003_new_features.sql` | 新功能表（积分、成就等） |
| `004_payment_system.sql` | 支付系统表 |

---

## 6. API接口规范

### 6.1 认证相关

#### POST /api/auth/login
```typescript
// 请求
interface LoginRequest {
  email: string;
  password: string;
  tenant_slug?: string;
}

// 响应
interface LoginResponse {
  user: User;
  tenant: Tenant;
  token: string;
}
```

#### POST /api/auth/register
```typescript
// 请求
interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  tenant_name: string;
  tenant_slug: string;
}
```

### 6.2 AI相关

#### POST /api/ai/generate
```typescript
// 请求
interface AIGenerateRequest {
  type: 'article' | 'headline' | 'script';
  topic: string;
  style?: string;
  tone?: 'professional' | 'casual' | 'humorous';
  length?: number;
  platforms?: string[];
}

// 响应
interface AIGenerateResponse {
  content: string;
  title?: string;
  suggestions?: string[];
  tokens_used: number;
}
```

### 6.3 内容相关

#### GET /api/contents
```typescript
// 查询参数
interface ContentsQuery {
  page?: number;
  page_size?: number;
  status?: 'draft' | 'published' | 'scheduled';
  content_type?: string;
  keyword?: string;
}

// 响应
interface ContentsResponse {
  list: Content[];
  total: number;
  page: number;
  page_size: number;
}
```

#### POST /api/contents
```typescript
// 请求
interface CreateContentRequest {
  content_type: string;
  title: string;
  body: string;
  cover_url?: string;
  tags?: string[];
  ai_params?: Record<string, any>;
}

// 响应
interface ContentResponse {
  id: string;
  status: string;
  created_at: string;
}
```

### 6.4 积分相关

#### POST /api/points/checkin
```typescript
// 请求
interface CheckInRequest {}

// 响应
interface CheckInResponse {
  success: boolean;
  bonus: number;
  streak: number;
  balance: number;
}
```

#### GET /api/points/balance
```typescript
// 响应
interface PointsBalanceResponse {
  balance: number;
  total_earned: number;
  total_spent: number;
  level: number;
  experience_points: number;
  streak_days: number;
  last_checkin_date: string;
}
```

### 6.5 发布相关

#### POST /api/publish
```typescript
// 请求
interface PublishRequest {
  content_id: string;
  platforms: string[];
  scheduled_at?: string;
  publish_type: 'immediate' | 'scheduled';
}

// 响应
interface PublishResponse {
  task_id: string;
  status: string;
  scheduled_at?: string;
}
```

---

## 7. 前端组件系统

### 7.1 布局组件

#### MainLayout
主布局组件，包含侧边栏和顶部导航。

```typescript
// 使用示例
import MainLayout from '@/components/layout/MainLayout';

export default function Page() {
  return (
    <MainLayout>
      <PageContent />
    </MainLayout>
  );
}

// 属性
interface MainLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  activeMenu?: string;
}
```

### 7.2 富文本编辑器

#### TiptapEditor
基于TipTap的富文本编辑器。

```typescript
// 使用示例
import TiptapEditor from '@/components/editor/TiptapEditor';

<TiptapEditor
  content={content}
  onChange={setContent}
  placeholder="请输入内容..."
  editable={true}
/>

// 属性
interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
  onImageUpload?: (file: File) => Promise<string>;
}
```

### 7.3 新手引导组件

```typescript
// 引导步骤
interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType;
}

// 使用示例
import { OnboardingGuide } from '@/components/onboarding';

<OnboardingGuide
  steps={steps}
  onComplete={() => handleComplete()}
/>
```

### 7.4 签到组件

```typescript
// 使用示例
import CheckInModal from '@/components/checkin/CheckInModal';

<CheckInModal
  visible={visible}
  onClose={() => setVisible(false)}
  onSuccess={(data) => handleSuccess(data)}
/>
```

---

## 8. 状态管理

### 8.1 Zustand Store

#### pointsStore
积分状态管理。

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LevelProgress {
  currentXP: number;
  level: number;
  xpForNextLevel: number;
  progress: number;
}

interface PointsState {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  consecutiveDays: number;
  lastCheckInDate: string | null;
  
  addPoints: (points: number, source: string, description: string) => void;
  spendPoints: (points: number, source: string, description: string) => boolean;
  checkIn: () => { success: boolean; bonus?: number; streak?: number };
  getLevelProgress: () => LevelProgress;
  getTodayStatus: () => { checkedIn: boolean; canCheckIn: boolean };
}

export const usePointsStore = create<PointsState>()(
  persist(
    (set, get) => ({
      balance: 0,
      totalEarned: 0,
      totalSpent: 0,
      consecutiveDays: 0,
      lastCheckInDate: null,
      
      addPoints: (points, source, description) => {
        set((state) => ({
          balance: state.balance + points,
          totalEarned: state.totalEarned + points,
        }));
      },
      
      spendPoints: (points, source, description) => {
        const state = get();
        if (state.balance < points) return false;
        set((state) => ({
          balance: state.balance - points,
          totalSpent: state.totalSpent + points,
        }));
        return true;
      },
      
      checkIn: () => {
        const state = get();
        const today = new Date().toISOString().split('T')[0];
        
        if (state.lastCheckInDate === today) {
          return { success: false };
        }
        
        const baseBonus = 10;
        const streakBonus = Math.min(state.consecutiveDays * 2, 35);
        const totalBonus = baseBonus + streakBonus;
        
        set({
          balance: state.balance + totalBonus,
          totalEarned: state.totalEarned + totalBonus,
          consecutiveDays: state.consecutiveDays + 1,
          lastCheckInDate: today,
        });
        
        return { success: true, bonus: totalBonus, streak: state.consecutiveDays + 1 };
      },
      
      getLevelProgress: () => {
        const state = get();
        const currentXP = state.totalEarned;
        const level = Math.floor(currentXP / 1000) + 1;
        
        return {
          currentXP,
          level,
          xpForNextLevel: level * 1000,
          progress: (currentXP % 1000) / 1000,
        };
      },
      
      getTodayStatus: () => {
        const state = get();
        const today = new Date().toISOString().split('T')[0];
        return {
          checkedIn: state.lastCheckInDate === today,
          canCheckIn: state.lastCheckInDate !== today,
        };
      },
    }),
    {
      name: 'points-storage',
    }
  )
);
```

### 8.2 themeStore

主题状态管理（亮暗模式）。

```typescript
import { create } from 'zustand';

interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (isDark: boolean) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: false,
  
  toggleTheme: () => set((state) => ({ isDark: !state.isDark })),
  setTheme: (isDark) => set({ isDark }),
}));
```

### 8.3 onboardingStore

新手引导状态管理。

```typescript
import { create } from 'zustand';

interface OnboardingState {
  currentStep: number;
  completedSteps: string[];
  isGuideActive: boolean;
  
  setStep: (step: number) => void;
  completeStep: (stepId: string) => void;
  resetGuide: () => void;
  activateGuide: () => void;
  deactivateGuide: () => void;
}
```

---

## 9. AI服务集成

### 9.1 OpenRouter (DeepSeek)

用于文本生成。

```typescript
// src/lib/ai-service.ts
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface OpenRouterRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
}

async function generateWithOpenRouter(request: OpenRouterRequest) {
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL,
    },
    body: JSON.stringify(request),
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
}
```

### 9.2 SiliconFlow (Qwen)

用于快速文本生成。

```typescript
// src/lib/ai-service.ts
const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';

async function generateWithSiliconFlow(prompt: string) {
  const response = await fetch(SILICONFLOW_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SILICONFLOW_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'Qwen/Qwen2.5-7B-Instruct',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.7,
    }),
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
}
```

### 9.3 Fal.ai (Flux)

用于图片生成。

```typescript
// src/lib/ai-service.ts
import { FalAI } from '@fal-ai/client';

const fal = new FalAI({
  apiKey: process.env.FAL_API_KEY,
});

async function generateImage(prompt: string) {
  const result = await fal.run('fal-ai/flux/schnell', {
    prompt,
    num_images: 1,
    image_size: { width: 1024, height: 1024 },
  });
  
  return result.images[0].url;
}
```

### 9.4 AI提示词模板

```typescript
// 脚本生成提示词
const SCRIPT_GENERATION_PROMPT = `你是一位专业的短视频脚本撰写专家。请根据以下主题撰写一个短视频脚本：

主题：{topic}
风格：{style}
时长：{duration}秒
平台：{platform}

要求：
1. 开头要有吸引眼球的钩子
2. 内容结构清晰，有起承转合
3. 结尾要有引导互动的话术
4. 适合短视频平台的节奏

请以JSON格式返回，包含以下字段：
- title: 视频标题
- hooks: 开场钩子 (3选1)
- script: 主体脚本
- cta: 行动号召
- hashtags: 建议标签`;

const HEADLINE_GENERATION_PROMPT = `请为以下内容生成10个爆款标题，要求：
1. 简洁有力
2. 引起好奇心
3. 数字量化
4. 情感共鸣

内容：{content}

请返回JSON数组格式：["标题1", "标题2", ...]`;
```

---

## 10. 部署指南

### 10.1 前端部署 (Vercel)

#### 1. 安装Vercel CLI
```bash
npm i -g vercel
```

#### 2. 登录Vercel
```bash
vercel login
```

#### 3. 部署
```bash
vercel --prod
```

#### 4. 环境变量配置
在Vercel控制台配置以下环境变量：
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENROUTER_API_KEY`
- `SILICONFLOW_API_KEY`
- `FAL_API_KEY`
- `NEXT_PUBLIC_AI_PROVIDER`

### 10.2 后端部署 (Docker)

#### 1. 构建镜像
```bash
cd api
docker build -t fenfa-ai-api .
```

#### 2. 运行容器
```bash
docker run -d \
  --name fenfa-ai-api \
  -p 3001:3001 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="your-secret" \
  -e REDIS_URL="redis://..." \
  fenfa-ai-api
```

#### 3. Docker Compose配置
```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: ./api
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - redis
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  redis-data:
```

### 10.3 数据库配置

#### Supabase配置
1. 创建Supabase项目
2. 获取项目URL和anon key
3. 运行数据库迁移：
   ```bash
   # 使用Supabase CLI
   supabase db push
   ```
   或在Supabase控制台的SQL编辑器中执行迁移文件

#### 自建PostgreSQL
```bash
# 创建数据库
createdb fenfa_ai

# 运行迁移
npx prisma migrate deploy
```

### 10.4 本地开发环境

#### 1. 克隆项目
```bash
git clone https://github.com/your-org/fenfa-ai.git
cd fenfa-ai
```

#### 2. 安装依赖
```bash
# 前端依赖
npm install

# 后端依赖
cd api && npm install
```

#### 3. 配置环境变量
```bash
cp .env.example .env.local
# 编辑 .env.local 填入实际的API密钥
```

#### 4. 启动开发服务器
```bash
# 前端 (端口3000)
npm run dev

# 后端 (端口3001)
cd api && npm run start:dev
```

---

## 11. 开发规范

### 11.1 代码规范

#### TypeScript规范
- 严格模式开启
- 使用接口而非类型别名定义对象结构
- 泛型用于复用逻辑
- 导出类型定义放在`types/`目录

```typescript
// GOOD
interface User {
  id: string;
  name: string;
  email: string;
}

export const getUser = async (id: string): Promise<User> => {
  // ...
};

// BAD
type User = {
  id: string;
  name: string;
  email: string;
};
```

#### React组件规范
- 使用函数组件
- 使用TypeScript泛型Props
- 提取复用逻辑到自定义Hook
- 组件文件以`.tsx`为后缀

```typescript
// GOOD
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
}) => {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick}>
      {children}
    </button>
  );
};
```

### 11.2 Git规范

#### 分支命名
- `main` - 主分支（生产环境）
- `develop` - 开发分支
- `feature/*` - 功能分支
- `hotfix/*` - 紧急修复分支
- `release/*` - 发布分支

#### 提交信息
```
<type>(<scope>): <subject>

# 类型
feat: 新功能
fix: Bug修复
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建/工具

# 示例
feat(points): 添加积分商城签到功能
fix(editor): 修复图片上传失败的bug
docs(readme): 更新部署文档
```

### 11.3 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件 | PascalCase | `UserProfile.tsx` |
| 工具函数 | camelCase | `formatDate()` |
| 常量 | UPPER_SNAKE_CASE | `MAX_FILE_SIZE` |
| 接口 | PascalCase | `UserProfileProps` |
| 类型 | PascalCase | `ContentStatus` |
| 文件夹 | kebab-case | `my-components/` |

### 11.4 目录结构规范

```
src/
├── app/                    # 页面组件
├── components/             # 公共组件
│   ├── ui/                 # 基础UI组件
│   ├── business/           # 业务组件
│   └── layout/             # 布局组件
├── lib/                    # 服务层
├── store/                  # 状态管理
├── hooks/                  # 自定义Hook
├── types/                  # 类型定义
├── utils/                  # 工具函数
└── constants/              # 常量定义
```

---

## 12. 常见问题

### Q1: 如何添加新的AI模型？

1. 在`src/lib/ai-service.ts`中添加模型调用函数
2. 在环境变量中添加API密钥配置
3. 在AI服务配置中添加模型信息
4. 更新前端模型选择器组件

### Q2: 如何添加新的平台支持？

1. 在类型定义中添加平台常量
2. 在平台账号表中添加字段
3. 实现平台API调用逻辑
4. 添加平台图标和名称到前端

### Q3: 积分系统不工作怎么办？

1. 检查`pointsStore`是否正确定义
2. 确认`getLevelProgress`方法已实现
3. 检查控制台是否有错误信息
4. 清除localStorage重新测试

### Q4: 如何调试API请求？

1. 使用Chrome DevTools Network面板
2. 查看后端日志：`docker logs fenfa-ai-api`
3. 使用Postman测试API端点

### Q5: 数据库迁移失败怎么办？

1. 检查数据库连接是否正常
2. 确认迁移文件语法正确
3. 回滚迁移后重新执行：
   ```bash
   npx prisma migrate reset
   npx prisma migrate deploy
   ```

---

## 附录

### A. 环境变量模板

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# AI Services
OPENROUTER_API_KEY=sk-or-v1-xxxxx
SILICONFLOW_API_KEY=sk-xxxxx
FAL_API_KEY=fal_ai_key_xxxxx

# AI Provider
NEXT_PUBLIC_AI_PROVIDER=siliconflow

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database (后端)
DATABASE_URL=postgresql://user:password@localhost:5432/fenfa_ai

# Redis (后端)
REDIS_URL=redis://localhost:6379

# JWT (后端)
JWT_SECRET=your-jwt-secret-key

# Stripe (支付)
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### B. 常用命令

```bash
# 前端
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run lint         # 代码检查
npm run lint:fix     # 自动修复格式问题

# 后端
cd api
npm run start        # 启动生产服务器
npm run start:dev    # 启动开发服务器
npm run build        # 构建
npm run test         # 运行测试
npx prisma generate  # 生成Prisma客户端
npx prisma migrate dev  # 执行数据库迁移
```

### C. 相关资源

- [Next.js文档](https://nextjs.org/docs)
- [Ant Design文档](https://ant.design/docs/react/introduce-cn)
- [Tailwind CSS文档](https://tailwindcss.com/docs)
- [Zustand文档](https://zustand-demo.pmnd.rs/)
- [NestJS文档](https://docs.nestjs.com/)
- [Prisma文档](https://www.prisma.io/docs/)
- [Supabase文档](https://supabase.com/docs)

---

## 📝 更新日志

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v2.0 | 2026-01-25 | 完整技术文档编写 |
| v1.0 | 2024-12-01 | 项目初始化 |

---

**文档维护: 分发侠技术团队**  
**最后更新: 2026年1月25日**
