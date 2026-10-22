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

## 2026-10-15 追加：瓶颈归因与优化路线（基于 020/047 实测 + 09-20 索引摸底）

- 归因：EXPLAIN 中 479 万候选行的逐行 `a` 表 eq_ref 主键查找是主要成本；主表**没有以 `company_address_id` 开头的索引**（现有 PK/cid/fh1/publish_state/update_time/position_group_id/create_user/FULLTEXT），MySQL 5.7 无 hash join，优化器无法从 address 城市侧（有 `(city,district)` 索引）驱动 nested-loop 反查主表——这是城市过滤只能"扫完再滤"的根因。`LIKE '%词%'` B-tree 用不上、FULLTEXT 无 ngram 分词（019）。
- 索引结论：若可动库，`c_company_position` 加 `(company_address_id, publish_state, deleted)` 可把检查行从 ~479 万降到单城岗位量级（广州约 26 万），预计秒级（待实测）；可拉长为覆盖索引免回表。统计信息过旧（publish_state 基数 552/实际 3 值）需 `ANALYZE TABLE`。**但账号仅 SELECT 权限（09-20 SHOW GRANTS 实证），加索引/ANALYZE 均需库主操作。**
- 现实路线排序（不动共享库）：①快照/物化缓存——库为静态快照（09-20→09-23 在招基数 9,616,999 不变；047 证 09-29→10-15 数字零漂移），本地聚合毫秒级；②同口径分布聚合合并为单条条件聚合 SQL（education/experience/salary/source 共享同一 WHERE，单趟扫描 SUM(CASE) 出全部分桶），6-7 条查询可减为 3 条（合并分布 + title-top + city-distribution）；③批内并发 `MAX_PARALLEL=2`（career-market-query.mjs:18）是 020 为保护库有意从 3 降的，且 2 路并发时单条延迟已翻倍（约 25s→50s），说明瓶颈在服务端，再加并发边际收益递减，宜在 ①/② 落地后再评估。

## 2026-10-15 二次追加：7 类查询全量 EXPLAIN 实测与 DDL 方案

- 2026-10-15 内网实测：对标准口径（广州市/广东省、Java、后端/服务端/开发、实习）把 7 个模板按 `buildSql` 精确渲染后逐条 EXPLAIN——**7 条计划完全一致**：p 走 `publish_state_index` ref（rows 估 4,789,551、filtered 1.65%），a 逐行 eq_ref PRIMARY；education/experience/source/title 多 `Using temporary; Using filesort`（分组数 ≤20，非热点）；city-distribution 的 a 侧 filtered 35.56%（province 谓词）。
- 在线索引清单实证：`c_company_position` 现有 10 个索引（含 `idx_position_company_deleted(company_archive_id,deleted)`，记忆中未记），**仍无以 company_address_id 开头的索引**；`c_company_address` 四个：PRIMARY、`a(company_id)`、`idx_address_province_company_city(province,deleted,company_id,city)`、`location_key(city,district)`。
- 驱动侧规模实测：`c_company_address` 广州市 93,026 行、广东省 579,319 行（索引计数 368ms）。
- 高权限 DDL 方案（用户可申请高权限账号，待执行验证）：`ALTER TABLE c_company_position ADD INDEX idx_addr_pub_del (company_address_id, publish_state, deleted), ALGORITHM=INPLACE, LOCK=NONE;` + `ANALYZE TABLE c_company_position; ANALYZE TABLE c_company_address;`。预期计划翻转为 address 城市侧驱动（9.3 万次索引 seek 进主表、触达约 30 万岗位行，对比现在 479 万行检查 + 479 万次地址表主键查找），单条查询从约 25s 降到秒级（待实测）；覆盖索引变体因 name/salary 列宽暂不推荐。建索引期间对库的写无阻塞（INPLACE），但 1156 万行建索引需数分钟且有 IO 负载，宜避开业务高峰。
