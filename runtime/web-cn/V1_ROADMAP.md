# V1 可上线 MVP+ 版本开发路线图

## PR 切分清单（按优先级）

### PR #1：首页总览 Dashboard（易用性）
**目标**：新用户3分钟内看懂价值
- 新增 `src/app/(main)/overview/page.tsx`
- 集成签到卡片、任务日历预览、积分概览、成就进度

### PR #2：统一导航与入口（易用性）
**目标**：减少用户迷路
- 修改 `MainLayout.tsx`：顶部导航改为固定5个入口
- 新增 `TabNavigation` 和 `Breadcrumb` 组件

### PR #3：签到系统后端对接（数据一致性）
**目标**：积分数据持久化
- NestJS 新增 `PointsModule`
- Prisma 新增 `points_log` 表
- API：`POST /api/points/checkin`

### PR #4：积分商城后端对接（数据一致性）
**目标**：兑换功能完整闭环
- NestJS 新增 `RewardsModule`
- Prisma 新增 `rewards`、`redemption_records` 表

### PR #5：任务与积分联动（钩子粘性）
**目标**：完成任务获得积分奖励
- 发布任务完成后自动发放积分
- 新增积分变动动画反馈

### PR #6：成就系统后端对接（数据一致性）
**目标**：成就解锁持久化
- NestJS 新增 `AchievementsModule`
- Prisma 新增 `user_achievements` 表

### PR #7：渐进式登录体系（用户沉淀）
**目标**：用户数据可跨设备同步
- 新增 `LoginModal`、`RegisterModal`
- NestJS 新增 `AuthModule`（基于JWT）
- localStorage 数据迁移逻辑

### PR #8：Design System 规范（UI一致性）
**目标**：生产级视觉规范
- 新增 `src/design-system/` 目录
- 设计token、规范组件、全局样式变量

### PR #9：支付集成（转化付费）
**目标**：付费闭环
- 新增定价页 `/pricing`
- 集成支付宝/微信支付

### PR #10：测试覆盖（工程化）
**目标**：生产可部署
- 单元测试、组件测试、E2E测试

---

## 版本里程碑

| 版本 | 目标 | 状态 |
|------|------|------|
| V1.0 | 可上线MVP+ | 进行中 |
| V1.1 | 增长与付费增强 | 待开发 |
| V1.2 | 体验精修与测试 | 待开发 |

## 埋点事件

| 事件 | 触发时机 |
|------|----------|
| `view_overview` | 进入首页 |
| `checkin` | 签到 |
| `complete_task` | 完成任务 |
| `redeem_reward` | 兑换商品 |
| `unlock_achievement` | 解锁成就 |

## 测试用例

- 积分计算、连续签到奖励
- 成就进度计算与解锁
- Modal、表单、列表组件
- E2E：核心用户路径
