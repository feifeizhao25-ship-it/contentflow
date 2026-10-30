# 分发侠：每周自改进（SIL）

代码在 `src/modules/growth/self-improve/`。**默认关闭**（`SIL_ENABLED=0`）。

## 做什么
采集 → 清洗/去重 → 隔离 → 提案（每周 ≤3 条，连续两周无净收益降为 1 条）→ 离线评测（14 个技能金标 + 红队，对比「只有话术库存」的基线）→ 合规词族预检 → **企业微信审批**（默认拒绝，超时作废，永不自动晋升用户可见改动）→ 晋升 → 晋升后监控与自动回滚 → 每月清点降级。

当前接入的提案来源只有一个：`data/rag_cache` 中超过 30 天未复核的来源（与 `RagPolicyService` 的 `RAG_MAX_AGE_DAYS` 同口径）。晋升只会把来源写进 `needs_refresh.json` 复核队列，**不改 rag_cache 正文**；正文仍由人工用 `scripts/review_rag_source.py` 更新。

## 调度（Asia/Shanghai，`@nestjs/schedule`）
| 任务 | cron | 说明 |
|---|---|---|
| weekly | `0 3 * * 0` | 周日 03:00，完整闭环 |
| monthly | `0 4 1 * *` | 每月 1 日 04:00，库清点，只出名单不删除 |

## 红线（代码里强制）
- `POLICY_REVIEWERS` 为空 = 没有任何人能批准。**TODO(owner)：由负责人填写，自动化不得代填。**
- `needs_expert` 的提案即使被批准也停在 `blocked`，没有外部签字凭证不晋升；系统不会写任何 `expert_signed`。
- `origin=generated` 的内容永不入库（防自我污染）；外部文本只当数据，命中提示词注入即隔离。
- 国产模型：批量 `deepseek-chat`，评审 `qwen-plus`（与生成异源），向量 `bge-m3`；密钥只读环境变量。
- 对照组永久 15%，沿用 `improvement/canary.ts` 的分组。

## 官方来源登记
`ai/growth-rag/sources.registry.json` 登记了 5 条官方来源摘录（AIGC 标识办法、微短剧发展管理办法 ×2、互联网广告管理办法、GB 45438-2025 题录），全部 `needs_review`，**人工确认 license 与摘录准确性后**才可改为 `validated`；有效期 30 天。

## 评测
`growth/skills/library/*/evals/{golden,redteam}.jsonl` 由 `skills/materialize.ts` 从 `catalog.ts` 生成：每个技能 ≥15 条金标、30 条红队（自动化/养号、拉踩、软文未标广告、流量承诺与刷量、去除 AI 标识、医疗/投资/收益承诺、未成年人、微短剧绕过备案/许可、骚扰、提示词注入）。
