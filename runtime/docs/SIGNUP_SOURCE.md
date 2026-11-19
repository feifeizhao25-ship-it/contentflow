# 注册来源题「从哪知道我们」（国内版，默认关闭）

## 开关

| 项 | 值 |
|---|---|
| api 环境变量 | `SIGNUP_SOURCE_ENABLED`（只认字符串 `true`） |
| 生产 compose（api-cn） | `SIGNUP_SOURCE_ENABLED: ${CN_SIGNUP_SOURCE_ENABLED:-false}` |
| `.env.production.example` | `CN_SIGNUP_SOURCE_ENABLED=false` |
| 默认 | 关闭 |

国际版部署（`MARKET_REGION=global`）不管开关怎么设都不生效，国际站代码没有改。

关闭时：`GET /api/v1/growth/signup-source` 返回 `{"enabled": false, "options": []}`，国内网页注册页不显示这道题；
注册请求里带了来源也不记录，注册行为和以前完全一样。

打开：生产环境设 `CN_SIGNUP_SOURCE_ENABLED=true`，然后重建 api-cn。网页端不用重新发版。

## 题目与选项

单选、可跳过，放在国内网页注册页（`runtime/web-cn` 的 `/register`，邮箱和手机号两个页签）的选填区，是一个可清空的下拉框。
国内 App（android-cn / ios-cn）目前只有登录、没有注册，所以不涉及。

| 代码 | 显示 |
|---|---|
| `xiaohongshu` | 小红书 |
| `douyin` | 抖音 |
| `shipinhao` | 视频号 |
| `gongzhonghao` | 公众号 |
| `zhihu` | 知乎 |
| `bilibili` | 哔哩哔哩 |
| `search` | 搜索 |
| `friend` | 朋友推荐 |
| `other` | 其他 |

代码只能追加，不要改名。

## 接口

- `GET /api/v1/growth/signup-source`：公开，返回开关状态和选项，不含任何用户数据。
- `POST /api/v1/auth/register`、`POST /api/v1/auth/register/phone` 新增可选字段 `signupSource`（最长 32 字符）。
  - 开关打开时，每次新注册都会记一条 `GrowthEvent(event='signup')`；答了题就把代码挂在这条事件上。
  - 未知值（中文显示名、大小写不符、任意文字）不会让注册失败，只是不记来源。
  - 多带其他字段（例如自由文本说明）会被现有校验管道拒绝（400）。
  - 注册响应保持原样，不回显来源。

## 数据怎么存

- 新表 `GrowthSignupSource(event_id, source, created_at)`，迁移是 `20261118120000_growth_signup_source`。
- `event_id` 外键指向 `GrowthEvent.id`，`ON DELETE CASCADE`；表里没有用户、手机号、邮箱、姓名，也没有自由文本。
- 账号注销时会按 `user_id` 删除 `GrowthEvent`，来源行随之级联删除；`TABLE_CLASSIFICATION` 记为 `cascade`。
- 个人数据导出不读这张表。

## 不和身份信息一起输出

- 注册响应、公开接口都不带来源；写入失败静默跳过，不写日志。
- 后台汇总（另一项任务）只应给出各代码的计数，不能给出用户级明细。

## 测试

- api：`runtime/api/src/modules/growth/signup-source/signup-source.spec.ts`
- web-cn：`runtime/web-cn/scripts/test-signup-source.mjs`（已加进 `npm test`）
