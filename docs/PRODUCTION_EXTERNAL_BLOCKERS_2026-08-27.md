# 分发侠生产上线外部堵点（2026-08-27）

## 当前状态

- 主分支 `c165a52` 的 CI 已通过，包含 API、国内站、国际站、四个 Flutter 版本、语言隔离、RAG 时效、生产配置与密钥扫描。
- 国际站移动端溢出修复位于不可变镜像 `bfc505e25e79f551d358e04bd54e0b5067e7e046`。
- 该镜像的数据库迁移执行成功，PostgreSQL 与 Redis 健康。
- 上线被 OpenClaw 发布分发器配置挡住；部署已自动恢复至上一健康镜像 `c7cf8fb0a8a513af919d000de19146314e0c4ff7`，不是半上线状态。

## 必须由账号持有人完成：配置 OpenClaw 发布入口

### 1. 在 OpenClaw 运营服务器提供 HTTPS 接口

接口必须接受 `POST` JSON，并满足以下契约：

- 请求头：
  - `Idempotency-Key: contentflow:<task-id>`
  - `X-ContentFlow-Timestamp: <Unix 毫秒>`
  - `X-ContentFlow-Signature: sha256=<hex HMAC>`
- 签名原文：`<timestamp>.<原始请求体>`。
- 签名算法：HMAC-SHA256。
- 拒绝与服务器时间相差超过 5 分钟的请求，防止重放。
- 对 `Idempotency-Key` 做持久化去重；重复请求返回第一次的结果，不得重复发布。
- 默认先创建 Postiz 草稿或审核任务，不得在未经人工批准时直接发布高风险内容。
- 成功响应示例：

```json
{
  "state": "SUBMITTED",
  "remotePostId": "postiz-task-id",
  "remotePostUrl": null
}
```

只有第三方平台已经确认发布时才能返回 `PUBLISHED`、`POSTED` 或 `COMPLETED`；此时必须同时提供真实 `remotePostId`。

建议地址形式：`https://<您的自动化域名>/webhooks/contentflow/publish`。不要使用示例域名、HTTP、临时隧道或本机地址。

### 2. 生成独立签名密钥

在自己的终端执行，生成值只存入密码管理器和 GitHub Secrets：

```bash
openssl rand -hex 32
```

不得复用 JWT、Postiz、OpenRouter、数据库或 SSH 密钥。

### 3. 写入 GitHub Actions Secrets

在 GitHub 仓库 `feifeizhao25-ship-it/contentflow` 的 Settings → Secrets and variables → Actions 中新增：

- `PUBLISH_DISPATCH_WEBHOOK_URL`：第 1 步的真实 HTTPS 地址。
- `PUBLISH_DISPATCH_WEBHOOK_SECRET`：第 2 步生成的 64 位十六进制值。

也可在已登录 GitHub CLI 的本机执行；不要把实际值写进 shell 历史：

```bash
gh secret set PUBLISH_DISPATCH_WEBHOOK_URL --repo feifeizhao25-ship-it/contentflow
gh secret set PUBLISH_DISPATCH_WEBHOOK_SECRET --repo feifeizhao25-ship-it/contentflow
```

命令会交互式从标准输入读取内容。

### 4. 先做验签测试

在 OpenClaw 端确认以下场景全部通过：

1. 正确签名创建一条草稿。
2. 错误签名返回 401/403，且不创建草稿。
3. 过期时间戳返回 401/403。
4. 同一 `Idempotency-Key` 连续发送两次，只创建一条草稿。
5. Postiz 暂时不可用时返回 5xx，ContentFlow 任务进入失败/重试状态，不伪报已发布。

### 5. 重新部署不可变镜像

```bash
gh workflow run deploy.yml \
  --repo feifeizhao25-ship-it/contentflow \
  --ref main \
  -f image_tag=bfc505e25e79f551d358e04bd54e0b5067e7e046
```

部署会在服务器变更前验证两项 Secrets，将其安全同步到服务器，等待 API/Web 容器健康，并执行线上 `/health` 检查；失败会自动采集日志并恢复上一健康版本。

## 上线后验收

- `https://contentflow.tianji-astrology.com/health` 返回成功。
- 国际站 `<html lang="en">`，可见业务内容无中文。
- 390×844 与 320×568 视口均满足 `document.documentElement.scrollWidth === window.innerWidth`。
- 创建审核内容 → 创建发布任务 → OpenClaw 验签 → Postiz 草稿 → 人工批准 → 平台回执，全链路仅生成一次。
- ContentFlow 中的任务状态、第三方 `remotePostId` 和实际平台内容一致。

