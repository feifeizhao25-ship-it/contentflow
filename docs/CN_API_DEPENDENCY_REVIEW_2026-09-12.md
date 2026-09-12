# API 依赖审计修复（2026-09-12）

提交 e3e1165 的 [CI](https://github.com/feifeizhao25-ship-it/contentflow/actions/runs/34436793158) 中，国内外网页、四项 Flutter 构建、语言和 RAG 契约、生产准备与密钥扫描均通过；API 在生产依赖审计阶段失败。

本轮重新执行审计，报告 10 项依赖漏洞（9 高、1 中），根源为 Multer 2.2.0 和 qs 6.15.3 及其上游依赖链，不能理解成 10 个独立业务漏洞。API 的 overrides 明确固定 Multer 2.3.0、qs 6.16.0，并同步 package-lock.json。保留 NestJS 11，避免使用审计建议中的破坏性框架降级。截至检查时，上游最新 platform-express 仍依赖旧 Multer，因此暂用窄范围覆盖，后续随上游修复复核移除。

依据：[Express 官方 2026-08-31 安全发布](https://expressjs.com/en/blog/2026-08-31-security-releases/)、[Multer 维护者公告](https://github.com/expressjs/multer/security/advisories)，以及本轮 npm audit 返回的 qs 公告 GHSA-x5fp-wj9c-mxmx、GHSA-4mjr-xmp4-gh2g。检查日期 2026-09-12。

本地验证：生产依赖审计 0 个已知漏洞；npm ls multer qs 无无效依赖，所有路径解析到修复版本；30 套、140 项 Jest 测试通过；Nest 生产构建通过。源代码中没有发现直接使用 Multer 文件拦截器的业务路由，本轮没有新增上传功能或声称完成真实上传验收。

远端结果需以本次提交的 CI 为准。审计归零只覆盖当前公告库中的依赖风险，不等于业务、安全、真实支付或阿里云生产环境验收全部完成。
