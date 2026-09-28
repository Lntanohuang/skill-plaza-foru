# 017 · 岗位统计查询 EXPLAIN 实测

- 状态：已完成只读 EXPLAIN（2026-09-28）；查询优化与实际扫描行数待验证。
- 动机：定位运行 `20260928-021809-aq1z` 的学历统计超时，区分全表扫描与索引低选择性。
- 约定细节：使用 MySQL 8.4 客户端，对 `scripts/career-market-queries/education-distribution.sql:1` 的广州、Java、后端/服务端/开发、实习口径执行普通 EXPLAIN；未执行实际 SELECT、未修改索引。结果如下：

| 表 | type | possible_keys | key | rows（估计） | filtered | Extra |
|---|---|---|---|---:|---:|---|
| p | ref | publish_state_index | publish_state_index | 4789549 | 1.65 | Using index condition; Using where; Using temporary; Using filesort |
| a | eq_ref | PRIMARY,location_key | PRIMARY | 1 | 5.56 | Using where |

- 解释：没有 `type=ALL` 全表扫描；岗位表以发布状态索引驱动，但候选行估计约 479 万，仍需剩余条件过滤；地址表逐条主键查找，再过滤城市。不能把估计 rows 写成实际扫描行数；`filesort` 也不证明发生磁盘排序。此结果支持“大范围索引访问仍慢”，不能单凭 EXPLAIN 确认并行时 CPU/IO 的具体瓶颈。
- 成本与取舍：本次只做普通 EXPLAIN，避免重复运行约 40 秒的聚合。未直接增加索引、强制连接顺序或提高超时；这些方案需基于索引定义、选择性与实际对比决定。
- 验证：`scripts/mysql-query.mjs --mysql-bin /opt/homebrew/opt/mysql@8.4/bin/mysql --timeout-ms 10000 "EXPLAIN ..."` 返回 `ok:true`，227ms，2 行；经批准的沙箱外网络连接成功。此前沙箱内 ERROR 2003 / Operation not permitted 不构成数据库不可达证据。
- 后续扩展路线：读取两表索引定义，评估城市过滤优先的执行计划和岗位地址关联索引；验证同一筛选结果复用；性能改善需实际查询对比，不能以执行计划替代实测。
