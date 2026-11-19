# 全站每周漏斗汇总（只读，国内版）

`GET /api/v1/growth/site-funnel/weekly`：按上海时间的自然周，出**全站**聚合漏斗，给运营每周复盘用。
只做读查询、不写任何表。响应里没有工作区（租户）编号、用户编号、订单号、手机号、邮箱，**也不按工作区拆分**。

当前工作区的 `GET /api/v1/growth/funnel`（登录令牌，只看自己工作区）保持不变。

## 谁能调

| 凭证 | 能调什么 |
|---|---|
| 登录令牌（JWT） | 原有接口照常；**不能**调本接口（403） |
| **只读漏斗令牌 `FENFAXIA_FUNNEL_READONLY_TOKEN`**（`Authorization: Bearer`） | **只有**本接口的 `GET`。它不是登录令牌，其他接口（都走 JwtAuthGuard）一律 401 |

- 环境变量名：`FENFAXIA_FUNNEL_READONLY_TOKEN`（生产 compose 里从 `CN_FENFAXIA_FUNNEL_READONLY_TOKEN` 传入 api-cn）。
- **默认不设 = 只读入口关闭**（带任何值都是 403）。
- 值由主人自己生成（建议 ≥32 位随机串），不要复用 JWT 密钥、运营中枢令牌或任何管理口令。
- 比较 SHA-256 摘要，用 `crypto.timingSafeEqual`，常量时间、不因长度不同而短路。
- 没带 Bearer：401；带了但不对、或入口未开启：403；非 GET：403/404。
- 只在国内栈挂载（GrowthModule 属于国内专属模块，`MARKET_REGION=global` 时不存在）。

## 参数

| 参数 | 默认 | 说明 |
|---|---|---|
| `week_start` | 本周 | 最后一周的周日，`YYYY-MM-DD`（上海时间）。不是周日、或晚于本周，返回 422 |
| `weeks` | 4 | 从 `week_start` 往前共几周，1–26，超出返回 422 |

## 周的定义

上海时间（UTC+8，无夏令时）**周日 00:00:00 至周六 23:59:59**，即左闭右开 `[周日 00:00, 下周日 00:00)`。
数据库存 UTC，先换成上海时间再归周：UTC 周六 16:00 已是上海周日 00:00，归下一周。`complete=false` 表示这周还没过完。

## 字段

金额单位一律是**分（人民币）**，整数（订单表 `amount` 是元，乘 100 取整）。付款类只算 `PaymentOrder.currency='CNY'`。
付费主体是**工作区**（订单挂在工作区上），所以「新付费」按工作区去重，但响应里不出现工作区。

| 字段 | 定义 / 计入哪些状态 | 来源 |
|---|---|---|
| `week_start` / `week_end` | 本周第一秒 / 最后一秒，带 `+08:00` | — |
| `complete` | 此刻是否已过完这一周 | — |
| `new_signups` | `User.created_at` 落在本周的账号数（含受邀加入团队的成员；已注销、行已删的不再计入历史周） | `User` |
| `new_paid` | 本周付款、且此前从没付过款的**工作区数**。订单 `status IN ('paid','refund_pending','refunded')` 且 `paid_at` 非空，按 `paid_at` 归周 | `PaymentOrder` |
| `renewals` | 本周付款的**订单数**中，该工作区此前已有付款的那些（同一工作区同周两单：第一单算新付费，第二单算续费） | `PaymentOrder` |
| `order_amount_fen` | 本周付款订单金额合计；之后退款的订单仍算在付款那周 | `PaymentOrder.amount` |
| `refund_amount_fen` | `status='refunded'` 的订单金额合计，按 `updated_at` 归周（表里没有退款时间列，订单变成 refunded 时写下的 `updated_at` 即退款完成时间）；`refund_pending` 不算 | `PaymentOrder` |
| `expirations` | 到期**工作区数**：`Subscription.status='active'`、`plan<>'free'`、`current_period_end` 落在本周且已经过去（当前周只算到此刻）。续费会把到期时间往后推，所以这里就是到期没续的；`refunded` 不算 | `Subscription` |
| `signups_by_source` | 注册来源题各选项计数，加 `unanswered`（本周 signup 事件里没答的）。按 `GrowthEvent.created_at`（`event='signup'`）归周 | `GrowthSignupSource` ⋈ `GrowthEvent` |

说明：

- 注册来源题在 PR #120（`grok/signup-source`）里，还没合入 main。本接口不依赖那个分支：先用
  `to_regclass('"GrowthSignupSource"')` 查表在不在，不在就返回 `null` 加 `signups_by_source_note`，**`null` 不代表 0**。
  #120 合入、跑完迁移、打开 `SIGNUP_SOURCE_ENABLED` 后自动出各选项计数。
- `new_signups` 来自账号表、`signups_by_source` 来自增长事件，两者口径不同，合计不一定相等。
- 不出按工作区的拆分：只读令牌持有人看到的就是全站合计。若以后要按套餐等维度拆分，也只拆到聚合维度，不出工作区。
- 现在没有业务数据，付款记录读出来在内存里按周归并；数据量大了再改成在 SQL 里按时间分组。

## 响应示例

下面是测试造数据（`site-funnel.spec.ts` 的场景）跑出来的真实响应，不是线上数据：

```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Shanghai",
    "week_definition": "周日 00:00:00 至周六 23:59:59（上海时间）",
    "scope": "site",
    "currency": "CNY",
    "money_unit": "分",
    "generated_at": "2026-11-19T03:00:00+08:00",
    "weeks": [
      {
        "week_start": "2026-11-01T00:00:00+08:00",
        "week_end": "2026-11-07T23:59:59+08:00",
        "complete": true,
        "new_signups": 1,
        "new_paid": 1,
        "renewals": 0,
        "order_amount_fen": 9900,
        "refund_amount_fen": 9900,
        "expirations": 1,
        "signups_by_source": null,
        "signups_by_source_note": "注册来源表 GrowthSignupSource 不存在（注册来源题尚未上线或未合入），本项为空，不代表 0。"
      },
      {
        "week_start": "2026-11-08T00:00:00+08:00",
        "week_end": "2026-11-14T23:59:59+08:00",
        "complete": true,
        "new_signups": 2,
        "new_paid": 2,
        "renewals": 1,
        "order_amount_fen": 128850,
        "refund_amount_fen": 9900,
        "expirations": 2,
        "signups_by_source": null,
        "signups_by_source_note": "注册来源表 GrowthSignupSource 不存在（注册来源题尚未上线或未合入），本项为空，不代表 0。"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-11-18T19:00:00.000Z",
    "path": "/api/v1/growth/site-funnel/weekly?week_start=2026-11-08&weeks=2",
    "version": "v1"
  }
}
```

## 调用示例

```bash
curl -s -H "Authorization: Bearer $FENFAXIA_FUNNEL_READONLY_TOKEN" \
  "https://<国内 api 域名>/api/v1/growth/site-funnel/weekly?weeks=4"
```

## 测试

`runtime/api/src/modules/growth/site-funnel/site-funnel.spec.ts`。
