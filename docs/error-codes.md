# 错误码对照

对外文案只从 `runtime/api/src/common/error-catalog.ts` 取。改句子时两边一起改。国内界面用中文，国际界面用英文。下面六类必须各说各的，不能合成一句「请稍后再试」或 “please try again later”。

| 码 | 什么时候用 | 中文 | English |
| --- | --- | --- | --- |
| NOT_CONFIGURED | 短信、密钥或其它服务没配好 | 这项服务还没开通，所以现在不能用。 | This service is not set up yet, so it cannot be used. |
| AUTHENTICATION_REQUIRED | 还没登录 | 请先登录后再继续。 | Authentication is required. Please sign in to continue. |
| NOT_PERMITTED | 登录了，但没有权限 | 你没有权限做这件事。 | You do not have permission to do this. |
| QUOTA_EXHAUSTED | 本月额度用完。接口上的 `AI_MONTHLY_QUOTA` 也归这一类 | 这个月的额度已经用完。可以升级套餐，或等下个月恢复。 | This month's allowance is used up. Upgrade your plan, or wait until it resets. |
| REQUEST_NOT_ALLOWED | 请求本身不能做（例如不能帮的内容） | 这个请求不能处理。请修改内容后再试。 | This request cannot be processed. Change it before you submit it again. |
| CONTENT_COMPLIANCE_BLOCKED | 合规检查拦住了，没有保存也没有发布 | 内容没有通过合规检查，没有保存，也没有发布。 | The compliance check blocked this content. Nothing was saved or published. |
| SERVICE_UNAVAILABLE | 服务故障，可以稍后再试 | 服务暂时出了故障，请稍后再试。 | The service is temporarily unavailable. Please try again later. |

另外三个状态也分开写，避免再挤进上面任何一句：

| 码 | 中文 | English |
| --- | --- | --- |
| VALIDATION_FAILED | 请求里的内容不符合要求，请检查后再提交。 | Some of the information is not valid. Check it and submit again. |
| NOT_FOUND | 请求的内容不存在。 | The requested item does not exist. |
| CONFLICT | 操作与已有数据冲突，请刷新后再试。 | The request conflicts with existing data. |
| RATE_LIMITED | 操作太频繁，请稍后再试。 | Too many attempts. Please wait and try again. |

业务代码已经写了对应语言的具体原因时，原句保留（例如「本月发布次数已达上限」）。只有原文语言不对、或框架只给了 Unauthorized 这类英文时，才改用上表。

短信没配置时，注册和登录都返回 503 和 `NOT_CONFIGURED`，不再对登录用途假装发送成功。短信服务可用时，未注册手机号的登录验证码仍返回成功但不发送，以免泄露哪些号码注册过。
