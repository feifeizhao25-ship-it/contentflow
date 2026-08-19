# 「分发侠」 (ContentFlow) - AI一键分发 SaaS 平台

> **AI生成，一键分发，10倍效率**

「分发侠」是一款面向自媒体运营者、营销团队和内容创作者的 AI 驱动全渠道内容分发 SaaS 平台。通过接入顶级 AI 模型，实现内容从灵感、创作到多平台发布的全流程自动化、智能化。

## 🌟 核心特性

- **🚀 AI 智能创作**: 接入 OpenRouter(DeepSeek), SiliconFlow(Qwen), Fal.ai(Flux) 等顶级模型，支持文章、标题、配图的一键生成。
- **📱 多平台一键分发**: 支持抖音、小红书、微信视频号、B站、微博等主流自媒体平台。
- **📅 智能排期发布**: 灵活设置各平台发布时间，支持定时任务与日历视图管理。
- **📊 全链路数据分析**: 汇总多平台流量数据，通过可视化图表展现内容表现，优化分发策略。
- **🎨 统一素材库**: 云端管理图片、视频、文案素材，支持团队共享与版本控制。
- **👥 团队高效协作**: 完善的权限管理系统，支持多成员协同作业。

## 🛠️ 技术栈

- **前端框架**: Next.js 14+ (App Router)
- **UI 组件库**: Ant Design 5.x
- **状态管理**: Zustand
- **基础样式**: Vanilla CSS + TailwindCSS
- **数据可视化**: ECharts
- **后端服务**: Supabase (Database, Auth, Storage)
- **AI 引擎**: 
  - OpenRouter (DeepSeek-V3)
  - SiliconFlow (Qwen-2.5-7B)
  - Fal.ai (Flux-Schnell)

## 🚀 快速开始

### 1. 环境准备

复制项目中的 `.env.example` 文件并重命名为 `.env.local`，填写以下 API 密钥：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# AI Services
OPENROUTER_API_KEY=your_openrouter_key
SILICONFLOW_API_KEY=your_siliconflow_key
FAL_API_KEY=your_fal_key

# Defaults
NEXT_PUBLIC_AI_PROVIDER=siliconflow
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 即可开始使用。

## 🗺️ 项目蓝图

### ✅ Phase 1 - 基础架构与 UI 系统
- [x] 项目基础脚手架搭设 (Next.js + Ant Design)。
- [x] 响应式后台管理系统布局。
- [x] 亮暗模式切换与自定义主题系统。
- [x] 核心业务路由结构定义。

### ✅ Phase 2 - 核心业务模块
- [x] **用户认证系统**: 邮箱密码登录、注册流程、会话管理。
- [x] **AI 创作中心**: 接入文本、标题生成。
- [x] **分发中心**: 发布表单、任务列表、日历视图。
- [x] **素材库**: 素材管理、文件上传。
- [x] **数据分析**: KPI 卡片、趋势图表、平台对比。
- [x] **团队协作**: 成员管理、角色权限。

### ✅ Phase 3 - 平台集成与 AI 增强
- [x] **AI 服务全面升级**: 接入 OpenRouter, SiliconFlow 和 Fal.ai。
- [x] **账号授权流**: 实现多平台模拟 OAuth 授权。
- [x] **分发逻辑实现**: 定时任务与立即发布的业务流跑通。
- [x] **素材库动态化**: 支持素材上传与实时检索。

### 🚧 Phase 4 - 高级特性 (进行中)
- [ ] **AI 视频生成**: 接入 Luma/Runway 视频生成能力。
- [ ] **数据实战**: 接入真实各平台 API 数据分析。
- [ ] **内容自动审核**: 识别敏感词与平台违禁内容。

## 🔐 安全性

- 使用 Supabase Row Level Security (RLS) 实现多租户数据隔离
- API 密钥由服务器端环境变量管理
- 完善的内容备份与防误删机制

## 📄 许可证

MIT License

---

**Made with ❤️ by 分发侠团队**
