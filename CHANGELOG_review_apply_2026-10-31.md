# 评审结论落地：最低年龄 16（分发侠，2026-10-31）

> 这是助手在用户全权委托下做的选择，不是法务结论，**待专家复核**。产品下限 16 比 PIPL 14 / GDPR 第 8 条 16 / COPPA 13 都不松。

- 国内 web-cn：用户协议「账号与授权」增加"须年满 16 周岁"；隐私政策新增「5. 未成年人」（联系我们顺延为 6）；更新日期 2026年10月31日。
- `runtime/api/src/modules/auth/consent.ts` `CONSENT_VERSION` 2026-08-22 → 2026-10-31（与页面更新日期一致，旧用户的 consent_version 仍可区分）。
- 国际 web-int：服务条款新增 "Eligibility"（16+）、隐私政策新增 "Minimum age"；`LAST_UPDATED` → 2026-10-31；`legal-pages.test.tsx` 日期同步并新增 16+ 断言。
- 未做：注册接口（`register.dto.ts`）没有加"确认年满 16 周岁"字段——它要客户端同时改，现有客户端不会发这个字段；留给后续决定。

## Follow-up: required "I am 16 or older" confirmation on register (2026-10-31)
- API: `RegisterDto` and `RegisterPhoneDto` get a required `confirmedAge16` (boolean `true` only; the string `'true'`, `1`, missing → 400). Message is Chinese for the domestic edition and English (`Please confirm that you are 16 or older`) when `MARKET_REGION=global`.
- web-cn register page (phone + email forms): required checkbox 「我已满 16 周岁」, submitted as `confirmedAge16`; `auth-service.ts` whitelist updated; e2e now ticks both checkboxes.
- web-int and the four Flutter apps have **no register screen** (sign-in only), and `apps/INT-Web` is an unmaintained tree (its own verify script says not to use it), so no client change there. A future register UI must send `confirmedAge16`.
- Not stored as a separate column (consent_version already identifies the terms version that carries the 16+ clause).
