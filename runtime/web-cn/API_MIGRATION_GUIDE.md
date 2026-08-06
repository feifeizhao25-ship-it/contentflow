# API架构迁移指南

## 项目概述

本项目从 Next.js API Routes + Supabase 架构迁移到 **NestJS + Prisma + Redis + BullMQ** 架构。

## 新架构目录结构

```
api/
├── src/
│   ├── main.ts                    # 应用入口
│   ├── app.module.ts              # 根模块
│   │
│   ├── common/                    # 公共模块
│   │   ├── guards/                # 守卫
│   │   │   └── jwt-auth.guard.ts
│   │   ├── interceptors/          # 拦截器
│   │   ├── filters/               # 过滤器
│   │   └── middleware/            # 中间件
│   │
│   ├── database/                  # 数据库层
│   │   ├── database.module.ts
│   │   ├── prisma.service.ts
│   │   └── prisma/
│   │       └── schema.prisma      # 数据库模型
│   │
│   ├── cache/                     # 缓存模块
│   │   ├── cache.module.ts
│   │   └── cache.service.ts
│   │
│   ├── queue/                     # 队列模块
│   │   ├── queue.module.ts
│   │   ├── ai-queue.service.ts
│   │   ├── publish-queue.service.ts
│   │   └── data-sync-queue.service.ts
│   │
│   └── modules/                   # 业务模块
│       ├── auth/                  # 认证模块
│       ├── user/                  # 用户模块
│       ├── tenant/                # 租户模块
│       ├── content/               # 内容模块
│       ├── account/               # 平台账号模块
│       ├── publish/               # 发布模块
│       ├── ai/                    # AI模块
│       ├── analytics/             # 数据分析模块
│       ├── hot/                   # 热点模块
│       ├── competitor/            # 竞品分析模块
│       ├── team/                  # 团队模块
│       ├── materials/             # 素材模块
│       └── growth/                # 增长模块
│
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

## 快速开始

### 1. 安装依赖

```bash
cd api
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```env
# 数据库
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fenfa"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=7d

# AI API
QWEN_API_KEY=your-qwen-api-key
DEEPSEEK_API_KEY=your-deepseek-api-key
```

### 3. 生成Prisma客户端

```bash
npx prisma generate
```

### 4. 同步数据库

```bash
npx prisma db push
```

### 5. 启动开发服务器

```bash
npm run start:dev
```

API服务将在 `http://localhost:3001` 启动。

## 使用Docker运行

```bash
docker-compose up -d
```

这将启动：
- NestJS API (端口 3001)
- PostgreSQL (端口 5432)
- Redis (端口 6379)

## 主要功能模块

| 模块 | 功能 | 端点 |
|------|------|------|
| Auth | 注册、登录、JWT认证 | POST /auth/* |
| User | 用户信息管理 | GET/PUT /user/* |
| Tenant | 租户管理、配额 | GET/PUT /tenant/* |
| Content | 内容CRUD | CRUD /content/* |
| Account | 平台账号管理 | CRUD /accounts/* |
| Publish | 发布任务管理 | CRUD /publish/tasks |
| AI | AI生成服务 | POST /ai/generate/* |
| Analytics | 数据分析 | GET /analytics/* |
| Hot | 热点榜单 | GET /hot/list |
| Competitor | 竞品分析 | GET /competitor/* |
| Team | 团队管理 | CRUD /team/* |
| Materials | 素材管理 | CRUD /materials/* |
| Growth | 增长计划 | GET/PUT /growth/plan |

## 队列任务

- **AI生成队列**：处理AI内容生成任务
- **发布队列**：处理多平台内容发布
- **数据同步队列**：同步第三方平台数据

## 下一步

1. 完成 `npm install` 和 `npx prisma generate`
2. 配置数据库连接并运行 `npx prisma db push`
3. 前端API地址改为 `http://localhost:3001`
4. 迁移Supabase中的现有数据
5. 逐步将前端API调用迁移到新架构
