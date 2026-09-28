# 018 · 岗位名索引与 LIKE EXPLAIN 实测

- 状态：已实现实测（2026-09-28）；搜索改写待评估。
- 动机：确认岗位名过滤是否使用索引。
- 约定细节：`SHOW INDEX FROM c_company_position` 显示岗位名只有 `ft_position_name`，类型为 FULLTEXT；不存在岗位名 BTREE 索引。`name LIKE 'Java%'` 的 EXPLAIN 为 `type=ALL`、`possible_keys=ft_position_name`、`key=NULL`、`rows=9,579,099`；`name LIKE '%Java%'` 为 `type=ALL`、`possible_keys=NULL`、`key=NULL`、`rows=9,579,099`。改写为 `MATCH(name) AGAINST('+Java' IN BOOLEAN MODE)` 后为 `type=fulltext`、`key=ft_position_name`、`rows=1`（优化器估计），说明现有岗位名索引只会被 MATCH AGAINST 使用，不会被 LIKE 使用。
- 成本与取舍：本次只执行 SHOW INDEX/EXPLAIN，没有修改索引或替换业务查询。FULLTEXT 对中文分词效果仍需按索引 parser 和词法实测，不能直接假设能覆盖“后端/服务端/开发”。
- 验证：使用 MySQL 8.4 客户端；三次 EXPLAIN 分别约 65ms、59ms、115ms，均返回 `ok:true`。
- 后续扩展路线：对岗位名查询评估 `MATCH AGAINST`、预计算标签列或离线快照；改写后须重新 EXPLAIN 并做实际聚合耗时对比。
