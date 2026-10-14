# `/v1/chat/completions` 流式输出升级为 OpenAI 标准 chunk 格式 —— 后端修改摘要

> 状态：**已实现并复验通过**（2026-10-14，落地 commit 见 git log；帧规范以 `docs/agent-api.md` 第 0 节为准）。验证结果见第五节。
> 背景对接方：外部项目（Java 客户端）已按标准 OpenAI 流式结构定义 `OpenAIChatCompletionChunk`（`choices[]`/`object`/`created`/`model`/`usage`/`id`），当前后端流式帧为简化格式，正文在顶层 `content`，无 `choices` 数组，**对接方无法取到任何正文**。非流式 JSON 已是标准 `chat.completion`，无需改动。

## 一、改动目标

把 `/v1/chat/completions` 的流式帧从自定义简化格式升级为标准 `chat.completion.chunk` 外壳，正文/思考进 `choices[0].delta`；工具调用以**活动时间线级别**（工具名 + 开始/完成/失败状态，不含入参和返回内容）作为扩展帧透出。对接方现有 Java 类零改动即可解析，仅需补充扩展字段。

明确不做：标准 OpenAI `tool_calls` 参数级流（工具入参/返回内容不透出；runner 层流式事件本就只有工具名与状态，完整输入输出仅落盘 trace 供详情页使用）。

## 二、改造后的流式帧规范（`stream: true`）

每帧 `data: {JSON}\n\n`。通用外壳（与 OpenAI 官方一致）：

```json
{"id":"chatcmpl-<runId>","object":"chat.completion.chunk","created":1760400000,"model":"<PI_MODEL 实际模型名>","choices":[…]}
```

一次报告类技能请求的完整帧序：

| # | 帧 | 格式 | 说明 |
|---|---|---|---|
| 1 | role 首帧 | `"choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]` | 流开始即发，id 就绪后 |
| 2 | 思考增量（0~N 帧） | `"delta":{"reasoning_content":"…"}"` | DeepSeek 生态通行字段名；模型有思考阶段时才有 |
| 3 | 工具活动帧（扩展，0~N 帧） | `"choices":[],"status":{"phase":"tool","state":"active"\|"completed"\|"failed","tool":"<工具名>","id":"<toolCallId>"}` | **扩展帧**：仅转发工具事件（thinking/text 的 chars 节流状态不转发——全文已流式，冗余）；标准客户端忽略 |
| 4 | 正文增量（0~N 帧） | `"delta":{"content":"…"}` | |
| 5 | 收尾帧 | `"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]` | |
| 6 | 报告帧（扩展，仅 HTML 报告技能成功） | `"choices":[],"reportUrl":"/api/reports/<runId>","runId":"…","resultType":"success"\|"timeout"` | `resultType` 透传终态 |
| 7 | usage 帧 | `"choices":[],"usage":{"prompt_tokens":…,"completion_tokens":…,"total_tokens":…,"cost_usd":…}` | `cost_usd` 为扩展字段 |
| 8 | 结束标记 | `data: [DONE]` | |

全程规则：

- **心跳**：每 15 秒一条 SSE 注释行 `: ping`，SSE 解析器自动忽略。
- **流中失败**：`data: {"error":{"message":"…","type":"agent_error"}}` 后跟 `data: [DONE]`（不改，已是 OpenAI 惯例）。
- **流前失败**（不走 SSE）：缺/非法 `skill` 400（列出可用技能）、会话占用 429，均为 OpenAI 错误体。
- HTML 报告技能失败时：无报告帧，流中 error 帧（原因透传），`resultType` 语义由报告帧承载。

**非流式（`stream: false`，默认）**：不改。已回标准 `chat.completion`（`choices[0].message.content`、`object`、`created`、`model`、`usage`），报告技能成功时顶层扩展 `reportUrl`/`runId`。

## 三、后端代码改动清单

改动集中在**一个文件一个函数**：`web/server/index.ts` 的 `createChatWire`（578 行起），仅 openai 流式分支；wire 对外接口不变，编排核心 `runChatTurn`、runner、trace、报告捕获全部不动。

| 位置 | 改动 |
|---|---|
| `frame()` 辅助（约 587 行） | 套标准外壳：`{id, object:"chat.completion.chunk", created, model, choices:[{index:0, delta:{…}, finish_reason:null}]}`；`created`/`model` 在 `begin()` 已就绪，直接复用 |
| `started()`（约 618 行） | openai 流式补发 role 首帧（id 就绪后） |
| `thinkingDelta()`（约 639 行） | 顶层 `reasonContent` → `delta.reasoning_content` |
| `textDelta()`（约 644 行） | 顶层 `content` → `delta.content` |
| `status()`（约 646 行） | 新增 openai 流式分支：仅 `phase:"tool"` 事件转发为 `choices:[]` + 顶层 `status` 扩展帧（现 openai 协议直接丢弃 status） |
| `done()`（约 671 行） | 补 `finish_reason:"stop"` 收尾帧；报告帧改 `choices:[]` + 顶层扩展；usage 帧改 `choices:[]` 外壳 |
| `busy()` / `error()` | **不改**（流中已是 `{"error":{…}}` + `[DONE]`，流前已是 OpenAI 错误体） |

配套文档：`docs/agent-api.md` 第 0 节流式示例更新（约 10 行）；开发手记 036 帧格式描述回填（实现时）。

**明确不动**：plaza `/api/chat` 协议（逐字节回归安全）、非流式 JSON、错误码语义、`/api/reports/*` 与 `/api/runs/*` 文件接口、CORS/无鉴权策略、请求侧字段（`skill`/`messages`/`sessionId`/`taskTitle`/`attachments`/历史拍平）。

## 四、对接方（前端）配套改动

1. 现有 `OpenAIChatCompletionChunk` 类**无需修改即可解析所有帧**。
2. 补充内部类：`Choices`（`index`、`delta`、`finish_reason`）与 `Delta`（`role`、`content`、`reasoning_content`，后两个可空）；正文从 `chunk.getChoices()[0].getDelta().getContent()` 取，思考从 `getReasoning_content()` 取（`choices` 为空数组的帧跳过）。
3. 可选扩展字段（加到 Chunk 类顶层）：`status`（工具时间线展示）、`reportUrl`/`runId`/`resultType`（报告技能，收到后给用户展示报告链接）。
4. `usage` 字段已有，最后一帧直接读。
5. Jackson 需忽略未知字段：Spring Boot 默认即是；纯 Jackson 需 `FAIL_ON_UNKNOWN_PROPERTIES=false`（否则 `status`/`role` 等扩展字段会反序列化抛异常）。
6. SSE 解析按标准处理：`data:` 帧解析 JSON、`[DONE]` 结束、`: ` 注释行忽略。

## 五、验证结果（2026-10-14 实测，PI_MODEL=deepseek-flash，后端重启后）

1. ✅ 流式简单问题（classroom-assistant）：role 首帧 → `reasoning_content` 增量 1569 帧（deepseek-flash 有思考阶段）→ `content` 增量 362 帧 → `finish_reason:"stop"` 帧 → usage 帧 → `[DONE]`；外壳字段（`object`/`created`/`model`/`id`）齐全。
2. ✅ 工具活动帧：同一用例出现 32 条 `choices:[]` + 顶层 `status`（bash 工具 active/completed），thinking/text 节流状态未泄漏。
3. ✅ 报告技能流式端到端（career-guidance，run 20261014-135228-hzyi，6.9 分钟，protocol=openai，outcome=success）：`reasoning_content` 6184 帧 → `content` 160 帧 → 工具活动帧 66 条（岗位库查询 bash）→ stop 帧 → 报告帧 `{reportUrl:"/api/reports/20261014-135228-hzyi", runId, resultType:"success"}` → usage 帧 → `[DONE]`；报告 URL 200/text/html/126KB，6 章结构完整。
4. ✅ 错误用例：假 skill 流前 400（OpenAI 错误体，`code:"unknown_skill"` 列出可用技能），不变。
5. ✅ 非流式（ai-interview）：标准 `chat.completion`（`choices[0].message.content`、`object`、`created`、`model`、`usage` 含 `cost_usd`），非报告技能无 `reportUrl`——与升级前一致。
6. ✅ plaza `/api/chat` 回归（ai-interview）：事件类型序 `started → status → session → status → …(thinking 节流) → text → usage → done`，与旧版形状一致，plaza 分支零改动。

## 六、成本与取舍

- 单文件约 40 行 diff + 两处文档，无新增依赖、无常驻开销。
- 被否决：① 维持简化帧让对接方适配——丢失"标准 OpenAI 兼容"的端点定位，后续每个接入方重复适配；② 工具调用做参数级 `tool_calls` 流——需扩 RunnerEvent 协议转发 pi 工具入参/结果，改动面大，且报告类技能的外部展示只需进度级别；③ 工具时间线走 SSE 注释行——标准客户端不可解析，时间线无从展示。
