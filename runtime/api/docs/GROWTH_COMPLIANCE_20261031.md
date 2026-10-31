# 分发侠：AIGC / 深度合成合规更新（2026-10-31）

只有 **A 级来源**（已读到官方或平台原文）驱动了下面的规则；B 级和待核的平台信息只登记在 `docs/research/EVIDENCE_LEDGER.md`，**没有变成强制规则**。

## 已落地（A 级）
| 规则 | 依据（原文已读） | 位置 |
|---|---|---|
| 发布者须主动声明并使用平台标识功能 | 《人工智能生成合成内容标识办法》第十条第一款（cac.gov.cn，2026-10-31 复读） | `aigc-label.ts: checkPublisherDeclaration` |
| 不得协助删除、篡改、伪造、隐匿标识；不得提供相应工具或服务 | 同上第十条第二款 | `aigc-label.ts: detectLabelTamperingRequest`，接入 `render.ts` 拒答 |
| 视频号：深度合成内容须显著标识；含虚拟人物形象须实名验证；不得未经授权使用他人肖像/声音；不得造谣、诈骗 | 微信视频创作安全中心《视频号关于创作者规范使用深度合成技术生成内容的建议》（mp.weixin.qq.com/s/qe6dUaATgrWkiggfXzcAYg） | `rules/deep-synthesis-platform.ts`（只对 `platform=weixin` 生效，其他平台返回 `applicable=false`） |
| 来源登记 | 办法第九条、第十条原文摘录 | `growth-rag/sources.registry.json`（`review_status=needs_review`，30 天到期，须人工确认后才能改 validated） |
| 红队 +10 条（每个增长技能共享）：清元数据标识、隐藏标识发布、数字人口播不标注、效果图不标注、声音克隆、换脸、克隆博主声音、AI 冒充真人医生、深度合成造谣、深度合成诈骗 | 上述依据 | `growth/skills/catalog.ts: SHARED_REDTEAM`，`library/*/evals/redteam.jsonl` 已重新生成 |

## 待核（未转成强制规则）
- 视频号「带货短视频含 AI 内容必须主动标注，否则限制分发（08-10 起）」：只有媒体转述（B）；视频号原文《建议》里没有这一条。
- 小红书「AI 虚拟人账号须在资料页开启标签（08-07 起）」「10-28 AI 虚假营销治理」：媒体转载（B），平台原文未取回。
- 抖音《内容标识使用规范》（2026-05）与一周年公告：协会转载页盒子直连 500。
- ZJU-REAL/Easel（Apache-2.0，页面说明）：许可证未通过 API 复核；本版只作思路参考，没有拷贝任何代码。

## 没有做
不抓取国内社交平台；不引入账号自动化；不做自动发布。草稿仍停在「待人工确认后发布」。
