# 模板页发布接收口 `/growth/publish/template-page`（2026-11-19）

运营中枢 `ops/airui_ops/publish.py` 的 `fenfaxia_template_pages` 渠道会 POST 到 `{fenfaxia.api_base}/growth/publish/template-page`。分发侠原来没有这个接口，这里补上接收端。

- 实际路径：`POST /api/v1/growth/publish/template-page`（全局前缀 `api/v1`，中枢的 `fenfaxia.api_base` 要配到 `.../api/v1`）。
- 只在国内版注册（`GrowthModule` 属于 `DOMESTIC_ONLY_MODULES`；`MARKET_REGION=global` 时没有这个路由）。
- **只存不发**：内容只写进 `GrowthTemplatePageSubmission` 表，状态 `received`。不上线、不转发任何外部平台；模块里没有任何外呼代码（有测试检查）。

## 开关和令牌

| 环境变量 | 作用 | 默认 |
|---|---|---|
| `FENFAXIA_PUBLISH_RECEIVER_ENABLED` | 总开关。只有 `1/true/yes/on` 算开 | **关**（没设或其他值 → 503 `disabled`） |
| `OPENCLAW_FENFAXIA_API_TOKEN` | 中枢调用时的 `Authorization: Bearer <令牌>` | 没设 → 503 `token_not_configured` |

- 只写变量名，代码和文档里都没有值。
- 令牌不能和这些变量的值相同，相同就当没配置：`JWT_SECRET`、`JWT_REFRESH_SECRET`、`FENFAXIA_FUNNEL_READONLY_TOKEN`、`PUBLISH_DISPATCH_WEBHOOK_SECRET`、`PAYMENT_CALLBACK_SECRET`、`SMS_CODE_HMAC_SECRET`、`WEBHOOK_ENCRYPTION_KEY`、`OPENCLAW_SHUNSHI_ADMIN_TOKEN`、`OPENCLAW_SHUNSHI_PUBLISH_TOKEN`。
- 这个接口不走登录（不挂 `JwtAuthGuard`），登录令牌在这里无效；这个令牌在别的接口也无效。
- 比较的是 SHA-256 摘要，常量时间。
- 开关关、令牌没配、令牌不对这三种拒绝**不写审计**，防止外部灌表。

## 请求格式（按中枢 `Publisher._deliver`）

```
POST /api/v1/growth/publish/template-page
Content-Type: application/json
Authorization: Bearer <OPENCLAW_FENFAXIA_API_TOKEN>
X-Airui-Contract: live

{"content": {"product": "fenfaxia", "channel": "fenfaxia_template_pages", "title": "...", "body": "...【本内容由 AI 生成】", "url": "..."},
 "stub": false, "note": "",
 "approval": {"id": "...", "status": "approved", "content_sha256": "<内容哈希>", "channel": "...", "detail_checked": false}}
```

`approval` 是本接口新增要求，**中枢目前不发**（见「要主人定」）。

内容哈希与中枢 `content.py::content_sha256` 一致：`json.dumps(content, ensure_ascii=False, sort_keys=True, separators=(",", ":"))` 的 UTF-8 SHA-256。键按码点排序。内容里有小数或超出安全范围的整数时，两边写法不同，直接按 `bad_request` 拒收（中枢的内容只有字符串）。

## 四件事全部满足才接收

| 条件 | 不满足时 |
|---|---|
| 批准单：`status == "approved"`，`content_sha256` 与内容哈希一致；`channel == "oa"` 时还要 `detail_checked` | 409 `approval_missing` / `approval_not_approved` / `sha_mismatch` / `approval_detail_not_checked` |
| 上海时间（UTC+8）08:00–21:30。按整分钟，两端都含（21:30:59 收，21:31:00 拒），与中枢 `clock.in_window` 一致。用服务器时钟 | 403 `outside_window` |
| 正文含 `【本内容由 AI 生成】` | 422 `aigc_missing` |
| 写进只增不改的审计 `GrowthPublishReceiveAudit`。和存储同一个事务，审计写不进去就什么都不存 | 503 `audit_unavailable` |

另外还检查：
- 中枢的禁用词表（全平台全自动发布、过AI检测、去AI味、洗稿、降重等，去掉空格也算）→ 422 `compliance_failed`
- 格式不对、产品或渠道不对、`stub: true` → 422 `bad_request`

响应统一是 `{success, accepted, reason, message, failed[]}`；多项不满足时 `failed` 列出全部，`reason` 是第一项。

成功：`201 {success: true, accepted: true, id, url: null, content_sha256, stored: true, published: false, duplicate: false, note}`。同一内容再推返回 `200 duplicate: true`，不覆盖，也记审计。

## 只追加

- 迁移 `20261119120000_growth_publish_receiver`：两张表都有触发器，拒绝 `UPDATE`、`DELETE`、`TRUNCATE`。
- 应用层只调用 `create` / `findUnique`，有测试检查。
- 两张表在账号注销分类里标为 `global`（无用户列）。

## 要主人定

1. **中枢要在请求体里加 `approval`**（批准单原样带上）。现在的请求体是 `{content, stub, note}`，每次都会被 409 `approval_missing` 拒绝。这是有意的默认拒绝。
2. 中枢收到任何 2xx 都记成 `published: True`。这个接口只是「已存」（响应里 `published: false`），建议中枢改口径，或者读响应里的 `published`。
3. 开关打开、令牌设置、迁移上线都要主人在服务器上做，本 PR 不部署、不改线上配置。
