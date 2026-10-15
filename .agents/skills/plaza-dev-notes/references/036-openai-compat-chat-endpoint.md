# 036 · OpenAI 兼容端点 /v1/chat/completions：外部项目统一接入入口

**状态**：已实现（本地流式/非流式/错误用例/多轮拍平/回归全通过，2026-10-13；2026-10-15 流式升级为标准 chunk 格式并修两项流式缺陷，typecheck 与帧序对照通过，线上真实抓包回归待跑）

## 动机

另一个项目要调用本服务，其客户端已按 OpenAI 风格 SSE（`content` 正文增量、`reasonContent` 思考增量、`data: [DONE]`）开发。直接改造 `/api/chat` 会破坏广场前端两处事件消费（UsePage/ExperiencePage），故新增平行端点，两协议并存、共用编排核心。

**端点定位（长期策略）**：`/v1/chat/completions` 是外部项目的**唯一**接入入口；后续外部需求以可选字段在此扩展（attachments、会话优化等），协议骨架不破坏。`/api/chat` 冻结为广场前端专用、不再演进。外部接口文档在仓库 `docs/agent-api.md` 第 0 节。

## 约定细节

### 思考原文事件（前置改动）

- `web/server/lib/runner.ts:28-30`：`RunnerEvent` 新增 `{ kind: 'thinking_delta'; delta: string }`。
- `web/server/lib/piRunner.ts:309-314`：pi `thinking_delta` 分支计数照发（节流 status，plaza 前端 030 进度时间线不变），**同时** emit 原文事件。此前原文在该行被降级为字符计数丢弃（008 的取舍，本记录兑现其"后续扩展路线"）。

### 共享编排核心 + wire 适配器

- `web/server/index.ts:399-428`：`TurnParams`（protocol/stream/skill/messages/sessionId/taskTitle/attachments）；`handleOpenAiChat`（校验 + 历史拍平）与 `handleChat`（plaza 校验，行为与旧版一致）都调 `runChatTurn`。
- `web/server/index.ts` `createChatWire(protocol, stream)`：两套 wire 相邻放置——
  - **plaza wire**：输出与旧版 `/api/chat` 逐字节一致的 `type` 事件帧（回归安全）；
  - **openai wire**（2026-10-15 升级，帧规范见 `docs/openai-stream-upgrade.md` §二）：流式输出标准 `chat.completion.chunk` 外壳——role 首帧、`choices[0].delta.reasoning_content`（思考 + 过程叙述）、`delta.content`（仅最终答复）、`choices:[]` 顶层扩展帧（`status`/`reportUrl`/`usage` 含 cost_usd）、`finish_reason:"stop"` 收尾帧、`[DONE]`；JSON 模式不写 SSE 头，终态一次性回 `chat.completion`（career-guidance 成功时顶层 `reportUrl`/`runId` 扩展字段，`content` 空串）。
- 错误映射：流前校验 400（`unknown_skill_model` 列出可用技能）；流中失败 `{"error":{...,"type":"agent_error"}}` + `[DONE]`；非流式 agent 错误 500、会话占用 429。
- 会话与多轮：技能走**独立 `skill` 字段**（2026-10-13 修订，最初设计为复用 `model` 字段；因语义混淆改为独立字段，`model` 彻底释放——忽略不校验，预留给将来按请求选模型；错误码 `unknown_skill` 并列出可用技能）。`taskTitle` 可选透传（同 plaza 清洗规则，用于运行标题与报告文件名）。无 `sessionId` 或服务端不认识时，messages>1 则历史拍平为「【对话历史】…【当前消息】…」注入首轮 prompt（复用 buildPrompt，不动 runner）；promptDigest 对拍平消息取【当前消息】段。非流式 JSON 的 `model` 字段回显 `runner.describe()` 真实服务模型。
- trace：`RunRecord.protocol: 'plaza' | 'openai'`（`web/server/lib/traceExport.ts:141-142`），运行记录页可区分两类流量；其余落盘（events/trace/报告校验/agentEnv）两入口完全一致。

### 维护性约定（新事件/字段的跟随关系）

- trace 记录、Agent 编排类改动在核心，改一处两入口自动生效。
- 新 RunnerEvent 的输出映射在两个 wire 各加 case（相邻放置降低遗漏）。
- 广场 `/api/chat` 自身协议变化有意不跟随——OpenAI 帧格式是冻结的对外契约。

### 流式升级为标准 chunk + 两项流式修复（2026-10-15，方案 `docs/openai-stream-upgrade.md`）

- **标准 chunk 外壳**：`createChatWire` 内 `frame(delta, finishReason?)` 出 `choices[0].delta` 增量帧、`extFrame(extra)` 出 `choices:[]` 顶层扩展帧（status/reportUrl/usage），`id`/`created`/`model` 复用 `begin()` 就绪值；帧序 role 首帧 → reasoning 增量 → 工具 status 帧 → content（仅最终答案）→ stop 帧 → 报告帧 → usage 帧 → `[DONE]`。仅 openai 分支改动，plaza 分支逐字节不变。
- **叙述缓冲与重分类**（修"过程叙述混进最终答案"）：Agent 一次运行产出多条 assistant 消息，工具调用前的过渡语与最终答复同为 text 块无法事前区分；规律（线上 trace 验证）为叙述块之后必跟工具调用（status active）、最终答复块之后直接 done。openai 流式正文进 `contentBuf` 不立即外发：任一工具状态事件（含终态——pi 的 text 增量可能落后于 toolcall_start 到达，2026-10-15 端到端实测曾因此漏出英文尾巴，终态兜底修复）即 `flushNarration()` 整段并入 `reasoning_content`，坚持到 done 的缓冲一次性作 `delta.content` 发出；`error()`/`busy()` 丢弃缓冲。代价是 `delta.content` 不再逐 delta 流式。
- **工具状态帧聚合**（修"状态帧刷屏/一直跳"）：active 帧压 `TOOL_ACTIVE_HOLD_MS`（300ms，`index.ts` 顶部）存入 `heldActive`，终态先到即 clearTimeout 吞掉 active——亚秒级工具只见终态帧；超时仍未终态才补发 active。终态缺 tool/id（旧事件兼容）从压帧条目回填；`finish()` 清空压帧定时器。`flushNarration` 在聚合之外无条件先行，重分类不随压帧延迟。
- **piRunner `toolcall_end` 字段路径修复**（修"completed 帧匿名"）：`web/server/lib/piRunner.ts:318-324` id/name 改从 `ev.toolCall` 下取（真实载荷顶层无这两个字段），顶层字段保留回落；`toolcall_start` 分支不动。plaza 协议同为纯增量字段受益。

## 成本与取舍

- 无新增常驻开销；无会话复用时对方每次调用技能指令重注入约 +1~2K token（实测 ai-interview 首轮 prompt_tokens ≈ 14.7K）。
- 被否决方案：① 直接改 `/api/chat` 输出格式——破坏广场前端，否决；② 复制一份完整 handler——trace/报告捕获/自愈全部双份维护，否决；③ reportUrl 走响应头（代理/封装易丢）或轮询接口（复杂+延迟），改为终帧扩展字段，标准客户端忽略未知字段不破坏。

## 验证口径（2026-10-15 流式升级后本地实测，PI_MODEL=deepseek-flash）

openai 流式（ai-interview）content 仅 1 帧纯最终答复、英文过渡语全部进 reasoning_content；status 帧同题 36→21、亚秒工具只出终态帧且 0 匿名；plaza /api/chat 回归帧序与 done 载荷不变、13/13 终态帧带 tool/id；假 skill 400 为 OpenAI 错误体。详见 `docs/openai-stream-upgrade.md` §七。线上部署后真实抓包回归待跑。

## 验证口径（2026-10-13 本地实测，PI_MODEL=deepseek-v4-pro）

1. ✅ 流式（classroom-assistant 推理型问题）：reasonContent 989 字 → content 增量 → usage 帧 → [DONE]；简单问题无思考阶段时只有 content（pi 未吐 thinking_delta，符合预期）。
2. ✅ 非流式（ai-interview）：标准 chat.completion JSON，usage 含 cost_usd，model 回显真实服务模型。
3. ✅ 错误用例：缺/假 skill 400（列出 5 个可用技能）、空 messages 400，均为 OpenAI 错误体；乱填 model 被忽略照常运行。
4. ✅ 多轮拍平：两轮历史 + 新问题（无 sessionId），模型正确 recall 历史中的代号。
5. ✅ 回归：`/api/chat`（ai-interview）事件序 started → status → session → status → usage → text → usage → done，done 载荷形状与旧版一致；`/api/runs` 两条流量 protocol 分别为 plaza/openai。
6. ✅ career-guidance 端到端（/v1 流式，2026-10-13 run 20261013-025750-ydum）：reasonContent 66414 字流式输出、taskTitle 透传入记录、protocol=openai、trace 落盘全部正确；报告校验失败走 error 帧 + [DONE]（失败原因透传），**失败路径行为符合协议设计**。报告本身未过校验是 VPN 导致内网岗位库查询失败后 Agent 未按规则标注"热点图未评估"（环境+合规问题，与端点无关；VPN 关闭后公网侧同类运行当日已成功）。
7. ⬜ 公网部署后 career-guidance 成功路径（reportUrl 帧 + 报告链接可打开）待用户执行。
8. 2026-10-15 升级静态验证：`npx tsc --noEmit`（针对 `server/index.ts` + `server/lib/piRunner.ts`）无新增错误（仅存 `charts: checkedCharts` 一处与本改动无关的既有错误，源自工作区未提交的 htmlReport.ts 改动）；帧序与 `docs/openai-stream-upgrade.md` §二 表逐条对照一致。线上抓包回归待跑。

## 后续扩展路线

- ~~附件接入~~：已实现（2026-10-13）——`/v1` 接受与 plaza 同规的 `attachments`（`{name, path}`，path 为 /api/upload 相对路径；沙箱防穿越/5 个上限/md-txt 内联在共享核心，入口只做透传）。
- 会话复用优化：对方稳定后建议用返回的 sessionId 续聊，避免每轮重注入历史。
- `reasonContent` 的 plaza 侧展示（008 预留的折叠区路线）如需要，消费同一 thinking_delta 事件即可。
- 按请求选模型：`model` 字段已预留（当前忽略不校验），需要时透传 createSession 的 `--model` 并配白名单。
