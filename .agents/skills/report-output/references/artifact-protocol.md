# Artifact 协议 v1

Artifact 是“输出产物清单 + 证据关系”的机器可读协议，不是固定的报告格式。每个业务 Skill 可以声明不同的产物组合。

## 最小结构

```json
{
  "schema": "artifact/1",
  "kind": "report",
  "status": "complete",
  "title": "报告标题",
  "producer": { "skill": "career-guidance" },
  "outputs": [
    {
      "id": "user-report",
      "type": "html",
      "audience": "user",
      "required": true,
      "status": "complete",
      "path": "report.html"
    },
    {
      "id": "evidence",
      "type": "json",
      "audience": "system",
      "required": true,
      "status": "complete",
      "path": "report.artifact.json"
    }
  ],
  "sources": [],
  "metrics": [],
  "claims": [],
  "evidence": [],
  "gaps": []
}
```

## 固定字段

- `schema`：当前为 `artifact/1`。
- `kind`：当前为 `report`。
- `status`：`complete`、`partial` 或 `failed`。
- `title`：产物集合的用户可读名称。
- `outputs`：实际产物清单。
- `sources`、`metrics`、`claims`、`evidence`、`gaps`：按统一证据模型填写，可为空数组。

## 输出项字段

- `id`：产物唯一标识。
- `type`：`text`、`html`、`markdown`、`pdf`、`docx`、`doc`、`json`、`image` 或 `zip`。
- `audience`：`user`、`system` 或 `developer`。
- `required`：是否为业务要求的必需产物。
- `status`：`complete`、`partial`、`failed` 或 `unavailable`。
- `path`：workspace 内相对路径；不得使用绝对路径、`..` 或远程 URL。
- `error`：失败时的简短原因，不写敏感信息。

## 关系

```text
claim → evidence → source
metric → source
output → report content / evidence
```

Artifact 校验只保证结构、ID 和引用可解析，不宣称完成正文与事实的语义核验。
