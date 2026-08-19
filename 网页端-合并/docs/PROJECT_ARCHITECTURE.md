# 📚 分发AI (Fenfa AI) - 项目架构文档

## 项目概述

**分发AI** 是一个 AI 驱动的短视频创作与分发平台，提供从脚本生成、视频制作到多平台发布的一站式服务。

---

## 🏗️ 技术架构

### 前端技术栈

| 技术 | 用途 | 版本 |
|-----|------|------|
| **Next.js 14** | React 框架 | App Router |
| **TypeScript** | 类型安全 | 5.x |
| **Tailwind CSS** | 样式框架 | 3.x |
| **Zustand** | 状态管理 | 4.x |
| **React Hook Form** | 表单处理 | 7.x |
| **Supabase** | 后端即服务 | - |
| **Framer Motion** | 动画效果 | 10.x |

### 后端技术栈

| 技术 | 用途 | 版本 |
|-----|------|------|
| **NestJS** | Node.js 企业级框架 | 10.x |
| **Prisma** | ORM 数据库访问 | 5.x |
| **PostgreSQL** | 关系型数据库 | 15.x |
| **Bull Queue** | 任务队列 | 4.x |
| **Redis** | 缓存 & 队列 | 7.x |
| **JWT** | 认证授权 | - |

### AI 服务集成

| 服务 | 功能 | 定价 |
|-----|------|------|
| **OpenAI (GPT-4)** | 脚本生成、智能对话 | $0.03/1K tokens |
| **OpenAI (DALL-E 3)** | AI 配图生成 | $0.04/图 |
| **ElevenLabs** | AI 配音 (TTS) | $0.01/字符 |
| **Azure TTS** | 备用配音服务 | $0.001/字符 |
| **Whisper** | 语音识别字幕 | 免费 |
| **Fal AI** | 视频生成 | 按需计费 |

---

## 📁 项目结构

### 目录结构

```
fenfa-ai/
├── api/                          # NestJS 后端服务
│   ├── src/
│   │   ├── main.ts              # 应用入口
│   │   ├── app.module.ts        # 根模块
│   │   ├── database/            # 数据库层
│   │   │   ├── prisma.service.ts
│   │   │   └── schema.prisma    # 数据模型
│   │   ├── cache/               # 缓存服务
│   │   │   └── cache.service.ts
│   │   ├── queue/               # 任务队列
│   │   │   ├── ai-queue.service.ts
│   │   │   ├── publish-queue.service.ts
│   │   │   └── data-sync-queue.service.ts
│   │   ├── common/              # 公共组件
│   │   │   ├── guards/          # 认证守卫
│   │   │   ├── interceptors/    # 响应拦截
│   │   │   ├── filters/         # 异常过滤
│   │   │   └── middleware/      # 中间件
│   │   └── modules/             # 业务模块
│   │       ├── auth/            # 认证模块
│   │       ├── user/            # 用户模块
│   │       ├── tenant/          # 租户模块
│   │       ├── content/         # 内容管理
│   │       ├── account/         # 账户模块
│   │       ├── publish/         # 发布模块
│   │       ├── ai/              # AI 服务
│   │       ├── analytics/       # 数据分析
│   │       ├── hot/             # 热点追踪
│   │       ├── competitor/      # 竞品分析
│   │       ├── team/            # 团队管理
│   │       ├── materials/       # 素材管理
│   │       ├── growth/          # 增长模块
│   │       ├── points/          # 积分系统
│   │       ├── rewards/         # 奖励系统
│   │       ├── quest/           # 任务系统
│   │       └── achievement/     # 成就系统
│   ├── docker-compose.yml
│   └── Dockerfile
│
├── src/                          # Next.js 前端
│   ├── app/                      # App Router 页面
│   │   ├── (main)/               # 主要页面组
│   │   │   ├── overview/         # 数据概页
│   │   │   ├── dashboard/        # 控制面板
│   │   │   ├── ai-create/        # AI 创作页
│   │   │   ├── materials/        # 素材库
│   │   │   ├── community/        # 社区
│   │   │   ├── my-videos/        # 我的作品
│   │   │   ├── points/           # 积分中心
│   │   │   ├── achievements/     # 成就中心
│   │   │   ├── growth/           # 增长数据
│   │   │   ├── monetization/     # 变现数据
│   │   │   ├── persona/          # 人设管理
│   │   │   ├── competitor/       # 竞品分析
│   │   │   └── calendar/         # 内容日历
│   │   ├── api/                  # API 路由
│   │   │   ├── ai/               # AI 相关
│   │   │   ├── payment/          # 支付
│   │   │   └── upload/           # 上传
│   │   ├── layout.tsx
│   │   └── error.tsx
│   ├── components/               # React 组件
│   │   ├── layout/               # 布局组件
│   │   ├── editor/               # 编辑器
│   │   ├── video/                # 视频相关
│   │   ├── image/                # 图片相关
│   │   ├── onboarding/           # 新手引导
│   │   ├── membership/           # 会员相关
│   │   ├── checkin/              # 签到
│   │   └── error/                # 错误边界
│   ├── lib/                      # 服务层
│   │   ├── ai-service.ts         # AI 服务封装
│   │   ├── tts-service.ts        # AI 配音
│   │   ├── subtitle-service.ts   # 字幕生成
│   │   ├── music-service.ts      # 背景音乐
│   │   ├── video-service.ts      # 视频服务
│   │   ├── video-merger-service.ts # 视频合并
│   │   ├── multi-segment-video-service.ts # 多片段
│   │   ├── frame-consistency-service.ts # 帧一致性
│   │   ├── enhanced-script-service.ts # 增强脚本
│   │   ├── video-style-presets.ts # 视频风格
│   │   ├── video-storage-service.ts # 视频存储
│   │   ├── content-service.ts    # 内容服务
│   │   ├── points-service.ts     # 积分服务
│   │   ├── materials-service.ts  # 素材服务
│   │   ├── payment-service.ts    # 支付服务
│   │   ├── image-service.ts      # 图片服务
│   │   ├── tophub-service.ts     # TopHub 服务
│   │   └── traffic-sandwich-service.ts # 流量三明治
│   ├── hooks/                    # 自定义 Hooks
│   │   ├── useVideoGeneration.ts # 视频生成控制
│   │   ├── usePermissions.ts     # 权限控制
│   │   └── useOnboarding.ts      # 新手引导
│   ├── store/                    # Zustand 状态
│   │   ├── themeStore.ts
│   │   └── pointsStore.ts
│   ├── types/                    # TypeScript 类型
│   │   └── new-features.ts
│   └── config/                   # 配置文件
│
├── scripts/                      # 脚本工具
├── docs/                         # 文档
├── supabase/                     # Supabase 配置
│   └── migrations/               # 数据库迁移
│
├── shunshi/                      # 养生类子项目 (独立)
├── stitch_/                      # 设计稿参考
└── TestResults/                  # 测试结果
```

---

## 🎯 核心功能模块

### 1️⃣ AI 创作中心

#### 脚本生成
```typescript
// enhanced-script-service.ts
interface ScriptTemplate {
  type: 'product_review' | 'knowledge_share' | 'life_vlog' | ...
  platform: 'douyin' | 'xiaohongshu' | 'b站' | ...
  hooks: string[];        // 开头钩子
  structure: ScriptSection[];
  cta: string[];          # 结尾号召
}
```

**支持的视频类型：**
| 类型 | 描述 | 平台优化 |
|-----|------|---------|
| 好物推荐 | 产品测评、种草 | 抖音/小红书 |
| 知识分享 | 科普、教学 | B站/YouTube |
| 生活vlog | 日常记录 | 抖音/快手 |
| 热点锐评 | 时事评论 | 全平台 |
| 教程教学 | 技能教学 | B站/抖音 |
| 故事叙事 | 情感故事 | 全平台 |
| 励志鸡汤 | 正能量 | 抖音/视频号 |
| 搞笑段子 | 幽默内容 | 全平台 |
| 新闻解说 | 时事解读 | B站/YouTube |
| ASMR | 治愈系 | 抖音/小红书 |

#### 视频生成
```typescript
// multi-segment-video-service.ts
interface VideoGenerationParams {
  script: string;
  segments: VideoSegment[];
  style: VideoStyle;
  voiceover?: VoiceoverConfig;
  music?: MusicConfig;
  subtitle?: SubtitleConfig;
}

interface VideoSegment {
  id: string;
  prompt: string;
  duration: number;  // 3-8秒
  imageUrl?: string;
  transition?: TransitionType;
}
```

#### 视频风格预设
```typescript
// video-style-presets.ts
const VIDEO_STYLE_PRESETS = {
  cinematic: {      // 电影质感
    prompt: "cinematic masterpiece, film grain, anamorphic...",
    negative: "cartoon, anime, low quality, blurry..."
  },
  anime: {          // 二次元
    prompt: "anime style, Japanese animation, cel shaded...",
    negative: "photorealistic, 3d render..."
  },
  cyberpunk: {      // 赛博朋克
    prompt: "cyberpunk city, neon lights, futuristic...",
    negative: "natural, daylight, peaceful..."
  },
  // ... 还有 9 种预设
};
```

### 2️⃣ 配音服务 (TTS)

```typescript
// tts-service.ts
interface TTSProvider {
  openai: { voices: 6, quality: 'good', price: 'medium' };
  azure: { voices: 7, quality: 'good', price: 'low' };
  elevenlabs: { voices: 6, quality: 'best', price: 'high' };
}

// 支持的声音
const VOICES = {
  openai: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  azure: ['晓晓', '云希', '云扬', '晓涵', '晓璇', 'Jenny', 'Guy'],
  elevenlabs: ['Rachel', 'Domi', 'Bella', 'Antoni', 'Adam', 'Sam']
};
```

### 3️⃣ 字幕系统

```typescript
// subtitle-service.ts
interface SubtitleStylePreset {
  default: '默认样式';
  modern: '现代简洁';
  cinematic: '电影风格';
  vibrant: '鲜艳活泼';
  tiktok: 'TikTok风格';
  youtube: 'YouTube风格';
  // ... 共 12 种预设
}

// 导出格式
type SubtitleFormat = 'srt' | 'vtt' | 'ass' | 'lrc';
```

### 4️⃣ 背景音乐

```typescript
// music-service.ts
const MUSIC_MOODS = [
  'upbeat', 'relaxed', 'dramatic', 'romantic',
  'mysterious', 'energetic', 'peaceful', 'inspiring',
  'nostalgic', 'tense', 'playful', 'epic'
];

// 情绪到音乐映射
const EMOTION_TO_MOOD = {
  happy: ['upbeat', 'playful'],
  sad: ['peaceful', 'nostalgic'],
  excited: ['energetic', 'epic'],
  calm: ['peaceful', 'relaxed'],
  // ...
};
```

### 5️⃣ 视频存储与管理

```typescript
// video-storage-service.ts
interface VideoProject {
  id: string;
  userId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration: number;
  width: number;
  height: number;
  script?: string;
  style?: string;
  voiceoverUrl?: string;
  musicUrl?: string;
  tags: string[];
  category?: string;
  views: number;
  likes: number;
  createdAt: Date;
}
```

---

## 📊 数据模型 (Prisma Schema)

```prisma
// 主要模型
model User {
  id          String    @id @default(cuid())
  email       String    @unique
  points      Int       @default(0)
  vipLevel    Int       @default(0)
  createdAt   DateTime  @default(now())
  
  videos      Video[]
  achievements Achievement[]
  quests      UserQuest[]
}

model Video {
  id          String    @id @default(cuid())
  userId      String
  title       String
  script      String?   @db.Text
  videoUrl    String
  thumbnailUrl String?
  duration    Int
  style       String?
  tags        String[]
  views       Int       @default(0)
  likes       Int       @default(0)
  createdAt   DateTime  @default(now())
  
  user        User      @relation(fields: [userId], references: [id])
}

model Quest {
  id          String    @id @default(cuid())
  type        String    // daily, weekly, achievement
  title       String
  description String
  points      Int
  target      Int       // 完成目标
  
  userQuests  UserQuest[]
}

model Achievement {
  id          String    @id @default(cuid())
  name        String
  description String
  icon        String
  points      Int
  condition   Json      // 触发条件
  
  users       UserAchievement[]
}
```

---

## 🔐 认证与授权

```typescript
// 认证流程
1. 用户登录 → JWT Token
2. 请求携带 Token
3. JwtAuthGuard 验证
4. 获取用户信息 → 注入 request

// 权限等级
enum UserLevel {
  FREE = 0,      // 免费用户
  BASIC = 1,     // 基础会员
  PREMIUM = 2,   // 高级会员
  VIP = 3,       // VIP
}
```

---

## 🎮 积分系统

```typescript
// 积分获取
const POINTS_CONFIG = {
  dailyCheckin: 10,           // 每日签到
  watchVideo: 2,              // 观看视频
  shareVideo: 5,              // 分享视频
  completeQuest: 20,          // 完成任务
  achieveAchievement: 50,     // 获得成就
  
  // 积分消耗
  generateImage: 3,           // 生成图片
  generateVideo: 10,          // 生成视频
  generateVoiceover: 5,       // 生成配音
  generateSubtitle: 2,        // 生成字幕
};
```

---

## 🚀 API 接口设计

### RESTful API

```
认证模块:
POST   /api/auth/register     # 注册
POST   /api/auth/login        # 登录
GET    /api/auth/profile      # 获取个人信息

用户模块:
GET    /api/user/profile      # 用户资料
PUT    /api/user/profile      # 更新资料

积分模块:
GET    /api/points/balance    # 查询余额
GET    /api/points/history    # 积分记录
POST   /api/points/checkin    # 每日签到

AI 模块:
POST   /api/ai/generate-script     # 生成脚本
POST   /api/ai/generate-image      # 生成图片
POST   /api/ai/generate-video      # 生成视频
POST   /api/ai/generate-voiceover  # 生成配音

视频模块:
GET    /api/video/list         # 视频列表
GET    /api/video/:id          # 视频详情
DELETE /api/video/:id          # 删除视频
POST   /api/video/save         # 保存视频

发布模块:
POST   /api/publish/douyin     # 发布到抖音
POST   /api/publish/xiaohongshu # 发布到小红书
POST   /api/publish/b站        # 发布到B站
```

### WebSocket 实时通知

```typescript
// 连接
const ws = new WebSocket('wss://api.fenfa.ai/ws');

// 事件类型
enum WSEvent {
  GENERATION_PROGRESS = 'generation_progress',
  PUBLISH_STATUS = 'publish_status',
  POINTS_UPDATE = 'points_update',
  ACHIEVEMENT_UNLOCKED = 'achievement_unlocked',
}
```

---

## 📈 业务流程图

```
用户输入主题/脚本
       ↓
   AI 脚本增强
       ↓
脚本 → 配音生成 → 背景音乐匹配 → 字幕生成
       ↓                    ↓
视频片段生成 ←←←←←←←←←←←←←←←←←←←←←←
       ↓
   视频合成
       ↓
   预览确认
       ↓
  保存/下载
       ↓
   多平台发布
       ↓
   数据追踪
       ↓
   收益分析
```

---

## 🛠️ 开发规范

### 代码风格
- **ESLint** + **Prettier** 统一代码风格
- **Husky** + **lint-staged** Git Hooks
- **CommitLint** 规范提交信息

### 分支策略
```
main        → 生产环境
develop     → 开发环境
feature/*   → 功能分支
hotfix/*    → 紧急修复
```

### 测试策略
```
单元测试    → Jest + React Testing Library
集成测试    → Supertest API 测试
E2E 测试    → Playwright
```

---

## 📦 部署架构

```yaml
# Docker Compose
services:
  # 前端
  frontend:
    build: ./src
    ports: ["3000:3000"]
    
  # 后端
  api:
    build: ./api
    ports: ["3001:3001"]
    environment:
      - DATABASE_URL
      - REDIS_URL
    
  # 数据库
  postgres:
    image: postgres:15
    volumes: [postgres_data:/var/lib/postgresql]
    
  # 缓存
  redis:
    image: redis:7-alpine
    
  # 任务队列处理
  worker:
    build: ./api
    command: npm run worker
```

---

## 📱 响应式设计

| 断点 | 设备 | 类名 |
|-----|------|------|
| < 640px | 手机 | `max-sm:` |
| < 768px | 平板 | `max-md:` |
| < 1024px | 桌面 | `max-lg:` |
| < 1280px | 大屏 | `max-xl:` |
| < 1536px | 超大屏 | `max-2xl:` |

---

## 🎨 UI 组件库

项目使用 **Shunshi Design System** 自研组件库，包含：

- `Button` - 按钮
- `Input` - 输入框
- `Modal` - 弹窗
- `Card` - 卡片
- `Tabs` - 标签页
- `Dropdown` - 下拉菜单
- `Upload` - 上传组件
- `Avatar` - 头像
- `Badge` - 徽章
- `Loading` - 加载动画
- `Empty` - 空状态
- `ErrorBoundary` - 错误边界

---

## 📊 性能优化

### 前端优化
- **Code Splitting** - 路由级别懒加载
- **Image Optimization** - 图片压缩 + WebP
- **Bundle Analysis** - Bundle Analyzer 分析
- **Memoization** - React.memo + useMemo

### 后端优化
- **数据库索引** - 核心查询字段索引
- **缓存策略** - Redis 热点数据缓存
- **连接池** - Prisma Data Proxy
- **队列削峰** - Bull Queue 异步处理

---

## 🔒 安全措施

- **输入验证** - Zod schema 验证
- **SQL 注入防护** - Prisma 参数化查询
- **XSS 防护** - React 自动转义
- **CORS** - 跨域白名单
- **Rate Limiting** - 接口限流
- **JWT** - Token 过期时间 7 天

---

## 📈 监控与日志

```typescript
// 日志级别
enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// 日志格式
{
  timestamp: Date,
  level: LogLevel,
  message: string,
  userId?: string,
  requestId?: string,
  stack?: string,
}
```

---

## 🚧 待实现功能 (Roadmap)

| 功能 | 优先级 | 状态 |
|-----|-------|------|
| 多平台一键发布 | P0 | 开发中 |
| 视频数据统计分析 | P0 | 待开发 |
| AI 直播功能 | P1 | 规划中 |
| 团队协作 | P1 | 规划中 |
| API 开放平台 | P2 | 规划中 |
| 插件市场 | P2 | 规划中 |

---

## 📞 联系与支持

- **文档**: `/docs/`
- **API 文档**: `/docs/API.md`
- **问题反馈**: GitHub Issues

---

*文档最后更新: 2024-01-25*
