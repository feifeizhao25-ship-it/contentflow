# 分发侠 权益对齐记录（2026-11-01，X8）

## 已做
- 国际站权益表 `runtime/web-int/src/lib/entitlements-int.json` 补齐 `aiTokenQuota`（此前只有平台数/发布条数），并由
  `runtime/api/src/modules/billing/entitlements-sync.spec.ts` 与 `plans.constant.ts` 的 `PLANS` 逐档自动比对
  （价格、平台数、发布条数、AI 令牌、custom、features）。国内站原有 `web-cn/scripts/test-entitlements.mjs` 做同样的对比。
- 所有数值显式写出，不依赖继承默认；仅国际 Enterprise（定制档）使用 -1。

## 未改（需负责人本人确认，不是本次可代决）
D4 FF-6-1 的建议值：平台账号 Solo 3 / Team 10 / Business 30；当前代码为 Solo 10 / Team 30 / Business 100
（Business 仍标记 `quotaStatus: 'unconfirmed'`，对外不展示数字）。平台开放授权（抖音、B 站）尚未开通，
`quotas.platformAccounts` 在 `entitlementStatus` 中为 `coming_soon`。改成建议值会让已展示的"10 个平台账号"文案下降，
属于对外权益变更，因此保持现状，确认后同时改 `plans.constant.ts`、`entitlements.json`、定价文案。
