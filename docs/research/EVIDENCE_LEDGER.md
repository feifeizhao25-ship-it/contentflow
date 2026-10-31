# 证据账本（分发侠）— 2026-10-31

本目录是「持续自改进」计划第 1 步的产物：把本轮检索（X、GitHub、HuggingFace、arXiv、政府/平台公告）里和**分发侠**相关的来源登记成可审计的账本。
它是**登记册，不是语料**：账本里的条目不会自动进入任何检索索引或回答。

## 使用规则
1. **只有 A 级来源可以驱动内容改动**（政策条目、事实数据点、评测期望答案）。A = 本轮已读到官方/平台原文或论文全文。
2. B 级（只读到元数据、搜索摘录或媒体转述）和 lead 级（X 帖子等线索）只能作**发现线索**，要升级为 A 才能入库。
3. 带「待核」标记的条目必须回到原文复核后才能使用；复核前不得写进任何用户可见回答。
4. 许可证：`do_not_ingest`（非商用/相同方式共享）不入库、不训练、不拷贝题目；`do_not_introduce`（GPL/自定义许可证）不引入依赖或代码；`permissive_reference` 仅作思路参考，若拷贝代码须保留许可证声明。
5. 所有新条目走既有流程：来源 → 隔离区 → 离线评测 → 合规门 → 企业微信批准 → 发布。SIL 默认关闭（`SIL_ENABLED=0`），审批人名单为空，`expert_signed` 保持 false。
6. 本账本不含国内社交平台抓取结果；X 内容只当线索，不含任何投资类内容。

## 待核清单（本产品相关）
- `ZJU-REAL/Easel` — 待核：许可证仅来自页面/搜索摘录，GitHub API 额度用尽未复核
- `xhs-ai-fake-marketing-2026-10` — 待核：媒体转载，盒子直连失败；须回平台原文复核
- `douyin-ai-label-anniv` — 待核：行业协会转载，盒子直连 HTTP 500

## 条目（21 条；A 级 2 条）
| 等级 | id | 类型 | 标题 | 许可证 | 许可分类 | 链接 | 备注 |
|---|---|---|---|---|---|---|---|
| A | `2610.24630` | arxiv | Selm: Self-Evolving Library Management for Multi-Skill Agent Optimization | n/a | n/a | https://arxiv.org/abs/2610.24630 | 全文已读：效用检索+验证门+退役名单；容量30、α=0.4（论文基准，需自测校准） |
| A | `shipinhao-deepsynth` | policy | 视频号关于创作者规范使用深度合成技术生成内容的建议 | 平台规则 | platform_or_media | https://mp.weixin.qq.com/s/qe6dUaATgrWkiggfXzcAYg | 正文已读 |
| B | `2604.27306` | arxiv | NuggetIndex: Governed Atomic Retrieval | n/a | n/a | https://arxiv.org/abs/2604.27306 | 元数据 |
| B | `2606.12903` | arxiv | X-MADAM-RAG 中英证据冲突 | n/a | n/a | https://arxiv.org/abs/2606.12903 | 元数据 |
| B | `2606.28331` | arxiv | AI Watermarking: policy vs technical capabilities | n/a | n/a | https://arxiv.org/abs/2606.28331 | 元数据 |
| B | `2607.24760` | arxiv | CHaystack 中文文档检索 | n/a | n/a | https://arxiv.org/abs/2607.24760 | 元数据 |
| B | `2608.08129` | arxiv | 创作者对AI标识的安全与隐私认知 | n/a | n/a | https://arxiv.org/abs/2608.08129 | 元数据 |
| B | `2610.24320` | arxiv | The Judge Can Debias Itself | n/a | n/a | https://arxiv.org/abs/2610.24320 | 元数据 |
| B | `2610.25126` | arxiv | Trackable Skill Library Lifecycle Management | n/a | n/a | https://arxiv.org/abs/2610.25126 | 元数据 |
| B | `2610.36188` | arxiv | Skill Dreaming | n/a | n/a | https://arxiv.org/abs/2610.36188 | 元数据 |
| B | `JuneYaooo/self-media-compliance-review` | github | 自媒体视频发布前违规风险审核 | MIT | permissive_reference | https://github.com/JuneYaooo/self-media-compliance-review | API |
| B | `NanmiCoder/MediaCrawler` | github | MediaCrawler | custom(NOASSERTION) | do_not_introduce | https://github.com/NanmiCoder/MediaCrawler | 禁止引入 |
| B | `Qwen/Qwen3-Embedding-4B` | hf-model | Qwen3-Embedding-4B | apache-2.0 | permissive_reference | https://huggingface.co/Qwen/Qwen3-Embedding-4B | 嵌入/重排 A/B 本期暂缓（用户决定 2026-10-31） |
| B | `ZJU-REAL/Easel` | github | Easel 自媒体 Agent（114 skills） | Apache-2.0(页面) | permissive_reference | https://github.com/ZJU-REAL/Easel | 待核：许可证仅来自页面/搜索摘录，GitHub API 额度用尽未复核 |
| B | `douyin-ai-label-anniv` | policy | 抖音落实AI标识办法一周年公告 | 行业协会转载 | platform_or_media | http://www.cnsa.cn/art/2026/9/3/art_1957_49264.html | 待核：行业协会转载，盒子直连 HTTP 500 |
| B | `dreammis/social-auto-upload` | github | social-auto-upload | MIT | permissive_reference | https://github.com/dreammis/social-auto-upload | 仅参考；不引入账号自动化 |
| B | `hanliang97/MatrixMedia` | github | MatrixMedia | GPL-2.0 | do_not_introduce | https://github.com/hanliang97/MatrixMedia | 禁止引入 |
| B | `shipinhao-ai-2026-08` | policy | 视频号带货短视频AI应用规范（08-10生效） | 平台规则(媒体转述) | platform_or_media | https://www.jinantimes.com.cn/news-222-5297802.html | 正文已读；另有平台原文建议 |
| B | `xhs-ai-fake-marketing-2026-10` | policy | 小红书AI虚假营销治理公告（10-28） | 平台公告(媒体转载) | platform_or_media | https://www.sina.cn/news/detail/5359075577038609.html | 待核：媒体转载，盒子直连失败；须回平台原文复核 |
| B | `xhs-ai-vtuber-2026-08` | policy | 小红书AI虚拟人账号标识（08-07）及4-27 AI治理规则 | 平台规则(媒体转载) | platform_or_media | https://news.qq.com/rain/a/20260807A0A0US00 | 正文已读；需回平台原文复核 |
| lead | `x-2109194038373138523` | x | Easel 推荐帖 | 线索 | unknown | https://x.com/lksmlabc/status/2109194038373138523 | 线索 |

数据文件：`evidence_ledger_20261031.jsonl`（同内容的机器可读版，字段：id/type/title/url/date/license/license_class/products/grade/url_status/flag/takeaway_zh/retrieved）。
