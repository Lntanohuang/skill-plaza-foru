# `/v1/chat/completions` 流式输出升级为 OpenAI 标准 chunk 格式 —— 后端修改摘要

> 状态：**已实现**（2026-10-15 代码落地，typecheck 通过、帧序对照通过；线上真实抓包回归待跑）。实现时在同分支追加了两项流式修复（见 §七 回填）。
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

## 五、验证计划

重跑开发手记 036 的本地 curl 用例（PI_MODEL=deepseek-v4-pro）：

1. 流式简单问题：仅 role 帧 → content 增量 → stop 帧 → usage 帧 → `[DONE]`（无思考阶段）。
2. 流式推理型问题：reasoning_content 增量若干 → content 增量 → 收尾序列。
3. 报告技能（career-guidance）流式端到端：工具活动帧出现 → 报告帧 reportUrl 公网可打开 → usage → `[DONE]`。
4. 错误用例：假 skill 400、流中失败 error 帧 + `[DONE]`。
5. 非流式与多轮拍平回归（预期零变化）。
6. plaza `/api/chat` 事件序回归（预期零变化）。

## 六、成本与取舍

- 单文件约 40 行 diff + 两处文档，无新增依赖、无常驻开销。
- 被否决：① 维持简化帧让对接方适配——丢失"标准 OpenAI 兼容"的端点定位，后续每个接入方重复适配；② 工具调用做参数级 `tool_calls` 流——需扩 RunnerEvent 协议转发 pi 工具入参/结果，改动面大，且报告类技能的外部展示只需进度级别；③ 工具时间线走 SSE 注释行——标准客户端不可解析，时间线无从展示。

## 七、实现回填（2026-10-15）

- 代码落点：`web/server/index.ts` `createChatWire`（frame/extFrame 标准外壳、role 首帧、reasoning_content、status 扩展帧、stop/报告/usage 终态序）与 `web/server/lib/piRunner.ts` `toolcall_end` 字段路径修复（id/name 从 `ev.toolCall` 下取，顶层字段保留回落）。plaza 分支逐字节不变。
- 实现时追加的两项流式修复（本方案定稿后按线上 trace 确定）：
  1. **叙述缓冲与重分类（2026-10-15 二次修订：定性上移消息边界）**：Agent 工具调用前的过渡语与最终答复同为 text 块，无法事前区分。openai 流式正文按消息缓冲（`msgBuf`）不外发；piRunner 在 `message_end` 拿完整块列表一次定性——含 toolCall 块的消息 `tool:'toolcall'`（其全部文本是过程叙述），不含则 `tool:'final'`（最终答复），wire 在消息边界一次分流：叙述整段进 `reasoning_content`、最终答复整段进 `delta.content`。`message`/`start` 兜底上一条消息 end 丢失时的残余缓冲（按叙述）、done 残余按最终答复发出、error/busy 丢弃。代价：content 与叙述按消息粒度突发、不再逐 delta 流式（OpenAI 协议无撤回帧，定性前发出的字无法收回）；thinking 增量不受影响仍实时外发。
     根因与门控改法：此前四轮事件级/消息级修复均被打穿，根因是事件映射层的侧车扣留曾**无条件**滞后 18 字符（`SIDECAR_MARKER.length-1`）才放行——wire 收到的 text 滞后且放行时机不定（同句被拆在工具事件两侧、词中断裂），叙述定性在事件级与消息级都不可能正确；而 `SIDECAR_SKILLS` 是空集合，扣留层保护的是空气。现已按 `SIDECAR_SKILLS.has(skill)` 门控：非侧车技能 text 增量即时透传，消息内全部增量先于 message_end 到达（trace 实证），消息级定性的确定性成立。
  2. **工具状态帧聚合**：active 帧压 300ms（`TOOL_ACTIVE_HOLD_MS`），终态先到即吞掉 active——亚秒级工具只见终态帧，长任务超时才补发 active；终态自身缺 tool/id（旧事件兼容）时从压帧条目回填。`finish()` 清空压帧定时器。
- 验证（2026-10-15 本地实测，PI_MODEL=deepseek-flash）：
  1. typecheck 零错误（`charts: checkedCharts` 一处 HEAD 既有的 `MetaChart[]` 与 `Record<string,unknown>[]` 不匹配，已顺手把 `WireDonePayload.charts` 改为 `MetaChart[]` 修复）。
  2. openai 流式（ai-interview，同题对照线上旧版）：帧序 role 首帧 → reasoning×4132 → status×21 → content×1 → stop → usage($0.015) → [DONE]。content 仅 1 帧纯中文最终答复（英文过渡语全部落在 reasoning 通道，问题一修复生效）；status 帧同题旧版线上 36 帧 → 21 帧（12 工具仅 9 个 >300ms 长任务发 active，3 个亚秒工具只出终态帧；终态帧 0 匿名，全部带 tool/id，问题二修复生效）。
  3. plaza `/api/chat` 回归（ai-interview）：帧序 started→status→session→…→text×69→usage→done，done 载荷键形不变，text 仍逐字直播（缓冲只作用于 openai 分支），13/13 工具终态帧带 tool/id（piRunner 字段修复的 plaza 侧增量收益）。
  4. 假 skill 400：OpenAI 错误体 + 可用技能列表。
  线上部署后真实抓包回归（§五）待跑。
- 验证（2026-10-15 晚，消息级定性 + 侧车扣留按 SIDECAR_SKILLS 门控落地后）：typecheck 0 错误（含修复既有 2 处 TS2322）、单测 12/12；无工具完整运行最终答复**单帧完整**（对照扣留层行为答案尾 18 字符会被拆进 done 兜底第二帧，单帧完整即门控生效）；plaza 回归帧型齐全、`phase:'message'` 零外泄；重型技能三次运行（career-guidance/ai-interview/tech-forecast）均被环境中断（内网 MySQL 断连黑洞、DeepSeek flash 晚间挂起），但到中断点全部帧零泄漏——content 通道全程为空、叙述 100% 进 reasoning、status 0 匿名。career-guidance 完整成功路径待环境恢复复跑回填（详见手记 036 验证口径）。
