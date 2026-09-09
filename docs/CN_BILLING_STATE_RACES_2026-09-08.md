# 订单状态竞争修复

关闭待支付订单和申请退款由无条件 update 改为包含工作区与原状态的 updateMany。读取之后状态已改变则 409，不覆盖并发处理结果。支付回调在事务内先原子认领 pending 订单，再更新订阅、租户权益及事件；认领失败不进入权益写入，后续失败由事务回滚。

本地全 API 140 项测试、TypeScript noEmit、Nest 构建通过。生产源文件 ESLint 通过。新增测试模拟过期读取及认领失败，确认拒绝操作且不写权益；这些测试本身不证明 PostgreSQL 实际并发。

CI 新增 scripts/test-billing-concurrency.cjs，在现有 PostgreSQL 16 隔离数据库迁移及构建后执行。重复运行支付/取消竞争与不同事件争用同一订单，并查询订单、订阅、租户及回调事件确认一致性；脚本拒绝非本机 contentflow_ci 数据库。本地未安装 PostgreSQL，真实数据库结果需检查本次 CI，不能预先标记通过。

未覆盖：不同订单同时续费同一工作区、退款与新购买同时发生、跨订单交易号唯一约束、生产支付及资源故障。当前修复不能等同完整账务系统完成。

验收续记：上述独立 PostgreSQL 16 并发脚本已在 [GitHub CI 34203070536](https://github.com/feifeizhao25-ship-it/contentflow/actions/runs/34203070536) 通过（任务 101986208301）。这是隔离 CI 数据库结果，不是生产支付；上述未覆盖项仍保留。
