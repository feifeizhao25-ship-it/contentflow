# 退款完成凭据入口校验

接续 CN_BILLING_STATE_RACES_2026-09-08.md 和 PAYMENT_RECONCILIATION_2026-09-28.md，基线 b976d8e；仅补充退款完成函数输入校验，不替代此前账本待办。

markRefunded 现在在开启数据库事务之前拒绝缺失、null、空字符串、纯空白及非字符串的订单号/渠道退款号，返回中文 BadRequest，避免不完整凭据进入退款与权益变更流程。有效凭据的既有幂等行为保持。

先新增10项反例，原实现10项失败；修复后会员支付模块15个测试套件共117项全部通过。运行命令：runtime/api 下 npm test -- --runInBand src/modules/billing。事务依赖为 Jest 替身，验证非法输入不触及事务；不是实际数据库退款、支付平台验签或生产验收。日志见 docs/evidence/2026-10-18-refund-identifiers/。

本地缺少 node_modules，先 npm ci --ignore-scripts --prefer-offline 并执行指定 schema 的 prisma generate 恢复测试环境；未更改依赖锁文件，未执行迁移或付款。

仍需多笔购买退款账本、独立渠道退款号存储（现有函数仍复用支付流水号字段）、跨订单交易号唯一性及商户真实验收。本轮只改该函数并新增独立测试，他人的 RAG 改动全部保留。当前工作分支 apply-20261013b-contentflow 无远端同名分支；按现有本地分支推送，不强推或覆盖其他分支。
