# 分发侠流量增长（实现说明）

版本：2026-10-26。对应规格草案 v0.1。两条线不要混用：

- 产品自己的获客：访问、试用、付费。
- 给用户的能力：选题、起草、合规。产出停在待人工发布。

对外可以说：AI 辅助选题和起草，平台规则合规检查，AIGC 标识自动附加，一键生成各平台发布包，你确认后发布。

不可以说全自动发布、托管运营、无人值守、自动涨粉。话术库存在 `runtime/api/src/modules/ai/compliance/claims.yaml`。新增话术要人批。

年化 ARPU 和付费账户数量是规划假设，不是代码里的承诺。Business 配额仍然是待确认。免费版仍然是每月 5 条发布。

## 代码位置

- 技能库：`runtime/api/src/modules/growth/skills/`
- 增长 RAG：`runtime/api/src/modules/ai/growth-rag/`（与合规资料的 `RagPolicyService` 分开）
- 自改进：`runtime/api/src/modules/growth/improvement/`
- 漏斗和 UTM：`runtime/api/src/modules/growth/events/`、`attribution/`
- 实验：`experiments/growthbook.client.ts`、`experiments/bandit.service.ts`
- 模板页和百度收录：`seo/`
- GEO：`geo/geo-monitor.ts`
- 平台规则提案：`runtime/api/src/modules/ai/knowledge-improvement/weekly.ts`
- 人工发布：`runtime/api/src/modules/publish/manual-publish.ts` 与 `runtime/web-cn/src/lib/manual-publish.ts`

接口（国内模块；国际版不加载 GrowthModule）：

- `GET /growth/skills`、`POST /growth/skills/:id/draft`：需要登录。草稿不发布。
- `GET /growth/rag/status`：默认关闭。
- `POST /growth/visits`：公开，只接受 `site_view`、访客编号和 UTM。
- `POST /growth/events`、`GET /growth/funnel`：需要登录，漏斗按工作区隔离。

## 默认关闭的配置

全部留空或保持非 `1`。不要把真实密钥提交到仓库。

| 变量 | 作用 |
|---|---|
| `GROWTH_RAG_ENABLED` | 为 `1` 且来源、新鲜度、冻结评测都通过时，增长 RAG 才返回 enabled |
| `GROWTH_RAG_EVAL_PASSED` | 人工确认冻结评测已通过后才设为 `1` |
| `GROWTH_EMBEDDING_PROVIDER` | `local`（默认）或 `bge-m3` |
| `GROWTH_EMBEDDING_URL` | bge-m3 的地址。没有地址就用本地哈希 |
| `GROWTH_RERANKER_PROVIDER` | `local`（默认）或 `bge-reranker-v2-m3` |
| `GROWTH_RERANKER_URL` | 重排模型地址 |
| `GROWTHBOOK_ENABLED` | 自托管 GrowthBook。缺地址或 client key 时实验返回默认值 |
| `GROWTHBOOK_API_HOST` | GrowthBook 地址 |
| `GROWTHBOOK_CLIENT_KEY` | GrowthBook client key |
| `BAIDU_PUSH_ENABLED` | 百度普通收录 |
| `BAIDU_PUSH_SITE` | 站点 |
| `BAIDU_PUSH_TOKEN` | 收录 token，只放环境变量 |
| `GEO_MONITOR_ENABLED` | 为 `1` 才接受人工或官方接口录入的引用观测 |
| `DOUYIN_ENTERPRISE_AUTHORIZED` | 企业授权标记。设为 `1` 也不会自动发帖 |
| `BILIBILI_ENTERPRISE_AUTHORIZED` | 同上 |

数据库迁移：`runtime/api/src/database/prisma/migrations/202610260001_growth_traffic`。

## 只能人工完成的步骤

1. 为增长 RAG 登记来源：source_id、https URL、tier、license、fetched_at、expires_at、title、text、content_hash。许可只接受 MIT、Apache-2.0、CC-BY-4.0、official-public、proprietary-licensed。拒绝 CC-BY-NC。空注册表保持关闭。
2. 跑新鲜度检查。平台规则 30 天复核。正文哈希变化则标 needs_review，并暂停依赖它的合规结论。
3. 冻结评测通过后，才把 `GROWTH_RAG_EVAL_PASSED` 和 `GROWTH_RAG_ENABLED` 设为 `1`。
4. 自行部署 bge-m3 与 bge-reranker-v2-m3，填写 URL。Qwen3 向量模型只作以后的 A/B 候选，当前未接入。
5. 自建 GrowthBook，填写地址和 client key。
6. 在百度站长平台申请普通收录 token。
7. GEO 每周分别记录 App 和 Web。不要抓取、不要刷量、不要买投放。
8. 抖音、B站适配器在企业资质完成前保持关闭。代码里没有代发实现。
9. 小红书、公众号、视频号、知乎按 2026 年规则只做人确认。不要接入 xiaohongshu-mcp、XiaohongshuSkills、social-auto-upload、MediaCrawler。
10. 模板页和案例页人批后才能上线。新词雷达只产草稿。
11. 话术库存的新增条目要人批。
12. Business 配额（M-07）、支付商户、备案、OpenClaw cron 安装都要人来做。仓库里的 `openclaw-cron.json` 只是说明，不会写入 `~/.openclaw`。
13. 执行上面的数据库迁移。

自改进循环由 cron 调用 `npx ts-node src/modules/growth/improvement/cli.ts <cycle.json>`。顺序是读指标、评测、提案、合规闸、永久 15% 对照、晋升或回滚。闸门失败时结果是 `no_change`。审计日志只追加。
