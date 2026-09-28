# 019 · 岗位名 FULLTEXT 替代 LIKE 试验

- 状态：试验完成；不能直接替换生产岗位名筛选。
- 动机：验证现有 `ft_position_name` 是否可用 `MATCH ... AGAINST` 替代岗位名 `LIKE`。
- 约定细节：`MATCH(name) AGAINST('+Java' IN BOOLEAN MODE)` 的 EXPLAIN 使用 `type=fulltext`、`key=ft_position_name`，优化器估计 rows=1；全库 Java 命中 38,447 条，广州在招命中 596 条。中文词测试 `+后端`、`+服务端`、`+开发` 以及 `+(后端 服务端 开发)` 均返回 0，说明当前 FULLTEXT 分词不能覆盖这些中文岗位词。广州在招中 `MATCH(+Java)` 与中文 `LIKE` 混合仅命中 11 条，加入实习谓词后为 0，不能证明与原 LIKE 口径等价。
- 成本与取舍：FULLTEXT 能走索引，但会改变召回口径；不能直接把所有 LIKE 改成 MATCH。中文检索需 ngram/专用搜索字段/预计算标签之一。
- 验证：使用 MySQL 8.4 客户端；三次 EXPLAIN/计数与样本查询均返回 `ok:true`。
- 后续扩展路线：保留 Java FULLTEXT 作为候选集预过滤仍需先做结果一致性回归；中文词改用预计算标签或支持中文分词的检索索引，再比较准确率和耗时。
