# 020 · 岗位查询客户端预探测与受控并行

- 状态：已实现并完成真实岗位库回归（2026-09-28）。
- 动机：避免每条 SQL 重复触发 MySQL 9.5 的 `mysql_native_password` 失败；在放宽查询时间后支持并行执行，同时避免三条重聚合一起压垮岗位库。
- 约定细节：`scripts/career-market-query.mjs` 批次开始用 `SELECT 1 AS mysql_client_probe` 选择兼容客户端，后续查询复用 `mysqlBin`；默认查询超时 120 秒、上限 180 秒；批次最多并发 2 条；批次结果包含 `maxParallel` 与 `mysqlBin`。沙箱 `AGENTS.md` 文案同步为上述限制。
- 成本与取舍：每个批次增加一次轻量探测；并发从 3 降为 2，牺牲部分峰值并行换取数据库稳定性。没有把 `MATCH AGAINST` 强行用于中文岗位词，因为 019 实测中文 FULLTEXT 命中为 0。
- 验证：`env -u MYSQL_BIN node scripts/career-market-query.mjs --parallel ...` 对广州 Java 后端实习的 education/experience/salary 三条真实查询成功；选择 `/opt/homebrew/opt/mysql@8.4/bin/mysql`，`maxParallel=2`，各查询 44.8–50.3 秒，批次总耗时 95.2 秒，`failed=[]`；未出现 `ERROR 2059` 或 `ERROR 3024`。
- 后续扩展路线：完成索引/快照优化后再评估并发 3；增加按查询类型的总预算和更细粒度 trace 指标。
