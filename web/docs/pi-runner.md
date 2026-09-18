# pi Runner 接入笔记（`pi --mode rpc` · DeepSeek）

> 2026-09-18 实测落地。pi v0.85.1（npm 包 `@earendil-works/pi-coding-agent`，bin `pi`）。
> 官方协议文档：`pi-mono` 仓库 `packages/coding-agent/docs/rpc.md`（本机安装目录下也有一份同版本副本）。
> 真实事件样例：`web/server/samples/pi-rpc-events-sample.jsonl`、探测脚本 `samples/pi-probe.mjs`。

## 为什么是 RPC 模式

pi 有四种接入形态（交互 TUI / `-p` print+json / `--mode rpc` / Node SDK）。
RPC 模式是「常驻子进程 + JSONL over stdio」，与 zcode `app-server` 的桥接结构同构
（共用 `lib/runner.ts` 抽象基类：分帧、id 关联、listen/tap 都在基类），
且 token 级流式、多轮上下文、abort、工具事件齐全。

与 zcode 的关键差异：**RPC 是单会话协议**，因此 PiRunner 每个引擎会话各起一个
pi 子进程（zcode 是全局共享一个进程）；进程 cwd 即沙箱 workspace。

## 启动参数（PiRunner.createSession）

```
pi --mode rpc \
   --model deepseek/deepseek-v4-pro \        # PI_MODEL 可覆盖，格式 provider/model
   --session-dir <workspace>/.pi-sessions \  # 会话文件落沙箱，兼作权威 trace 来源
   -n <短id> \
   --no-extensions \                         # 无头运行裁掉扩展发现
   [--skill <repo>/.zcode/skills/<slug>]     # 已安装技能（SKILL.md 格式两边通用）
```

- cwd = `web/server/workspace/<clientSessionId>/`（工作目录由 spawn 继承，无协议字段）。
- 首条 prompt 用 `/skill:<slug> <任务>` 触发技能展开（参数以 `User: <args>` 追加到技能文档后）。
- 空闲进程回收：`PI_IDLE_MS`（默认 30 分钟）。

## 协议要点（实测确认）

- 请求：`{"id":"req-N","type":"prompt","message":"..."}`；命令名即 `type` 字段。
- 响应：`{"id","type":"response","command":"prompt","success":true,"data":...}`；
  `success:false` 带 `error` 字符串。**prompt 的 success 只表示已受理**，后续失败走事件流。
- 事件：`{"type":"agent_start"|"message_update"|"message_end"|"agent_settled"|...}`，一般无 id。
- 分帧：只按 `\n` 分帧、容忍尾部 `\r`；不能用 Node `readline`（会在 U+2028/U+2029 错误分行）。
- 无反向请求；但扩展可能发 `extension_ui_request`（对话框 select/confirm/input/editor）——
  不回复会等超时，主动回 `{"type":"extension_ui_response","id","cancelled":true}` 让流程立刻继续。
- 收尾信号：`agent_settled`（重试/压缩/排队全部落定）；`agent_end` 只是单次低层运行结束。
- 常用命令：`get_state`（就绪探测）、`get_last_assistant_text`（终文本）、
  `get_messages`（trace 导出）、`get_session_stats`（会话级 token/成本）、`abort`（停止当前执行）。

## usage 字段（DeepSeek 实测）

- `message_update.usage` 逐 delta 都带，是**单次调用内的累计值**；DeepSeek 在流式期间
  只可靠给 `totalTokens` 增长，input/output/cacheRead 明细在块边界（text_end / toolcall_end）
  与 `message_end.message.usage` 才完整。
- 多步任务一轮 = 多次 LLM 调用（每条 assistant 消息一次）：以 `message_end` 终值入账累加
  （明细缺失时回落流式最后上报值），`agent_start` 重置本轮累计。
- 会话级合计用 `get_session_stats.tokens`（含压缩/工具嵌套调用）。

## 事件 → SSE 映射（PiRunner.routeMessage）

| pi 事件 | RunnerEvent | SSE |
| --- | --- | --- |
| `message_update.assistantMessageEvent.text_delta` | text_delta | `text` |
| 块边界 / `message_end` 的 usage（本轮累计） | usage | `usage` |
| `agent_settled`（经 `get_last_assistant_text` 取终文本） | terminal | `usage` + `done` |
| `auto_retry_end success=false` / `extension_error` / 收尾请求失败 | error | `error` |

## trace 导出（exportTrace）

`get_messages` 的 AgentMessage 直接映射成与 zcode 导出同构的 `SessionTrace`：
- assistant 内容块：`text` 原样、`thinking` → `reasoning`、`toolCall` → `tool`
  （`state.input = arguments`）；`toolResult` 消息的输出折叠进对应 `tool` 的 `state.output`；
- `summary.toolCalls` 从 toolCall 块登记（名称/状态/时间），详情页时间线直接可用。

## 凭据

DeepSeek key 走 pi 自己的读取顺序（环境变量 `DEEPSEEK_API_KEY` 等）。后端 spawn 的 pi
继承 server 进程环境——**启动后端的 shell 必须 export**，或写入 `web/.env`（随 loadLocalEnv
进环境）。自检：`pi auth check --provider deepseek` / `npm run detect:cli`。

## 已安装技能

pi 的技能就是 SKILL.md（与 zcode 同一约定）。`--skill <dir>` 显式加载仓库
`.zcode/skills/`（绕过项目信任检查），技能目录里的 references/assets 由 agent 在执行时
自行按需读取（渐进披露）。
