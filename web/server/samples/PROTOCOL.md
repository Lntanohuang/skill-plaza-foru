# ZCode app-server 协议探测笔记（2026-09-16 实测）

阶段 0 核实结论。CLI：`node /Applications/ZCode.app/Contents/Resources/glm/zcode.cjs`（v0.16.5）。

## 前置：模型配置

CLI 独立运行需要 `~/.zcode/cli/config.json`（0600，含 API key）。已从桌面 App 的
`~/.zcode/v2/config.json` 程序化迁移 `builtin:bigmodel-coding-plan`（Anthropic 兼容端点
`https://open.bigmodel.cn/api/anthropic` + GLM Coding Plan key）。有效结构：

```json
{
  "provider": {
    "builtin:bigmodel-coding-plan": {
      "name": "BigModel - Coding Plan",
      "kind": "anthropic",
      "options": { "apiKey": "<key>", "baseURL": "https://open.bigmodel.cn/api/anthropic" }
    }
  },
  "model": { "main": "builtin:bigmodel-coding-plan/glm-5.3" }
}
```

注意：`model` 是 **字符串引用** `"provider/model"`（或 `{main: "provider/model"}`），
写对象会被 zod 整体拒绝，报 "Model config is missing"。

## 两种无头方式

### 1. `-p` 单发（简单，无流式）

```
zcode.cjs -p "<prompt>" --cwd <dir> --json
```

- 结束时一次性输出 JSON：`{sessionId, response, usage{inputTokens, outputTokens,
  cacheReadTokens...}, projection, eventCount}`。14 秒任务全程无中间输出。
- 适合：批处理、探测。不适合：面向用户的流式 UI。
- 实测单次固定上下文 ~14k token，其中 ~10k 可命中缓存（cacheRead）。

### 2. `app-server` 常驻协议（流式，MVP 采用）

`zcode.cjs app-server --cwd <dir>` 起 NDJSON stdio 协议服务（"ZCode Protocol v1"）。
消息 = 每行一个 JSON，无 jsonrpc 字段：

- 客户端请求：`{"id": <num>, "method": "...", "params": {...}}`
- 服务端响应：`{"id": <num>, "result": {...}}` 或 `{"id", "error": {code, message, data}}`
- 服务端通知：`{"method": "...", "params": {...}}`（无 id）
- **服务端也会反向发请求**，必须回复，否则 15s 超时报错（错误里带 zod 详情，可用于反推 schema）

核心流程：

```
→ {"id":1,"method":"session/create","params":{
     "workspace": {"workspacePath": "<dir>", "workspaceKey": "<dir>"}}}
← （期间需应答两个反向请求，见下）
← {"id":1,"result":{"session":{"sessionId":"sess_..."},"protocol":{"version":1},...}}
→ {"id":2,"method":"session/subscribe","params":{
     "sessionId":"sess_...","deliveryKind":"web-remote-replayable"}}
→ {"id":3,"method":"session/send","params":{"sessionId":"sess_...","content":"<提示词>"}}
← 通知 {"method":"session/event","params":{
     "seq":N,"payload":{"kind":"text_delta","delta":"...","done":false},...}}   ← token 级流式
← 通知 ... payload.kind = "usage.delta"（inputTokens/cacheReadTokens...）
← 通知 ... payload.kind = "turn.terminal"（{"response":"全文","usage":{...}}）
```

必须应答的反向请求（实测出现两个）：

| method | 回复 result |
| --- | --- |
| `session/requestRuntimePreferences` | `{"nativeSearchEnhancementsEnabled": false}` |
| `interaction/requestOfficialMcpAuthHeaders` | `{"headers": {}}` |

事件 payload 识别（**重要**：`session/event` 的 payload 多数**没有** `kind` 字段，
按字段特征区分；`kind:"text_delta"` 是唯一带 kind 的）：

| 判定特征 | 含义 |
| --- | --- |
| `payload.kind === 'text_delta'`（有 delta/done） | 文本增量，token 级流式 |
| `payload.response !== undefined && payload.resultType !== undefined` | 终止事件（response=全文，含 usage/tokenCount/duration） |
| `payload.usage && payload.stopReason !== undefined` | 单次模型请求用量（含 cacheHit、contextUsageBreakdown） |
| `payload.title` / `payload.input` / `payload.modelRef` 等 | 标题、turn 开始、模型请求状态等杂项，可忽略 |

另有 `state.updated`、`v4/telemetry/event`（冗余遥测，其中有 kind 字段如
`turn.started`/`turn.terminal`，但那是遥测通道，别拿来当业务事件）、
`computer-use/operation-event`（turn 起止）。工具调用事件应出现在 tool_use 场景
（MVP 未处理）。

其他有用 method：`session/list`、`session/stop`、`session/close`、`session/read`、
`session/resume`（多轮复用会话，v2 用）。

## 相关文件

- `probe.mjs`：最小可运行探测客户端（create→subscribe→send→打印事件流）。
- `app-server-events-sample.txt`：一次真实运行的事件样例。
