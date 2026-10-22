# 统一证据模型 v1

该模型统一的是来源和结论之间的最小关系，不统一不同业务的章节和判断语义。

```json
{
  "schema": "evidence-core/1",
  "sources": [],
  "metrics": [],
  "claims": [],
  "evidence": [],
  "gaps": []
}
```

## 字段

- `sources`：原始来源，如用户材料、岗位原文、数据库、快照、网页或内置文档。
- `metrics`：可验证数字，至少保留 `id`、`label`、`value`、`unit`、`sourceIds`；有条件时补充 `period`、`region`、`population`、`definition`。
- `claims`：报告判断，`kind` 为 `fact`、`inference` 或 `recommendation`，并可关联 `sourceIds`、`metricIds`、`evidenceIds`。
- `evidence`：结论与来源/用户材料之间的支持关系；职业匹配可扩展 `requirement`、`support`。
- `gaps`：影响判断的数据或材料缺口，不等同于程序错误。

## 状态边界

- 证据关系：`matched`、`partial`、`gap`、`unknown`。
- 缺口状态：`pending`、`unverified`、`resolved`。
- 机器校验状态：`pass`、`warning`、`error`。

这些状态不要混用：证据支持状态、数据缺口状态和文件校验状态是三件不同的事。

## 兼容原则

旧的 `report-meta/1`、`report-meta/2` 和行业报告 `report.json` 可以继续使用。新 Artifact 只要求字段语义可映射，不要求本次立即迁移所有旧报告。
