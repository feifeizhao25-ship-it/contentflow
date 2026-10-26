# 平台规则切块

这里只放人工复核过的规则摘录。每条必须带 source_id、https 来源、tier、license、fetched_at、expires_at、content_hash。

- 平台规则 30 天内复核。正文哈希变化时，相关切块标为 needs_review，依赖它的合规结论暂停。
- 不从 Cookie、爬虫或非标准数据集灌入。禁止接入 xiaohongshu-mcp、social-auto-upload、MediaCrawler。
- 本目录当前没有已批准的切块。增长 RAG 因此保持关闭。
