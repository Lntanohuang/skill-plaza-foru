# Agent 后端接入 MVP 方案（zcode 无头模式）

> 状态：**已完成并验收通过**（2026-09-17）。验收记录见文末。

## 阶段 0 核实结论（已完成）

- CLI：`node /Applications/ZCode.app/Contents/Resources/glm/zcode.cjs`（v0.16.5）。
- 模型：GLM Coding Plan（`builtin:bigmodel-coding-plan/glm-5.3`，Anthropic 兼容端点）。
  CLI 需 `~/.zcode/cli/config.json`，已从桌面 App 配置迁移（含 key，0600）。
- `-p "..." --json`：一次性返回最终 JSON（含 usage），**无流式**。
- `app-server`：NDJSON stdio 协议，`session/create → subscribe → send`，
  `session/event` 通知里 `text_delta` 是 **token 级流式**，`usage.delta` 带 token
  统计与缓存命中；常驻进程（缓存友好）。两个反向请求需应答（runtimePreferences /
  mcpAuthHeaders，见协议笔记）。
- 成本实测：单发固定上下文 ~14k token，cacheRead ~10k。


## 背景与目标

SKILL 广场（`web/`，Vue 3 + Vite）目前唯一的后端是 `web/server.py`：一个 Python 代理，
把 `/api/chat` 简单转发到 Youcai chat-completions 接口，只能单轮问答，不能执行多步任务。
技能目录数据全部硬编码在 `web/src/data/skills.ts` 和 `web/src/data/useTaskConfigs.ts`。

MVP 只验证一个命题：**浏览器 → Node 后端 spawn zcode 无头模式 → SSE 流式看到真实的多步 agent 执行**。
链路通了再按需做 v2；不通，损失只有半天。

## 架构

```
Vue SPA ── POST /api/chat ──> Express (web/server/index.ts, 端口 8767)
                              │    spawn（常驻）: zcode.cjs app-server
                              │      session/create(workspace=web/server/workspace/<sessionId>/)
                              │      session/subscribe → session/send
                              │<── session/event 通知（text_delta / usage.delta / turn.terminal）
                              │        → 归一成 SSE 推给浏览器
                              └── GET /api/health（就绪态）
```

开发期由 Vite 把 `/api` 代理到 8767；前端只访问同源 `/api/*`，不感知后端形态。

## MVP 步骤（4 件事）

### 1. 核实无头参数（动手前，约 10 分钟）

- `zcode --help` 确认无头参数：`-p`、`--output-format stream-json`、权限模式参数（如
  `--permission-mode` / `--dangerously-skip-permissions`）是否存在及确切写法。
- 实跑一次 `zcode -p "你好" --output-format stream-json`，把 stdout 样例存到
  `web/server/samples/`，事件解析器照真实输出写，不靠猜。

### 2. 极简 Node 服务（新建 `web/server/index.ts`，约 150 行）

- 依赖：`express`；`tsx` 作 devDependency；`package.json` 加 `"server": "tsx server/index.ts"`。
- `POST /api/chat`：
  - 入参沿用现有格式 `{ skill, messages }`（见 `useChatApi.ts` 的 `sendChat`）。
  - 提示词 = skill 提示词（从 `server.py` 的 `SKILL_PROMPTS` 复制进本文件）+ 用户消息；
    多轮历史首版直接拼进提示词重跑，不做 `--resume`。
  - spawn zcode，cwd 固定 `web/server/workspace/`（沙箱目录，agent 的文件操作只落在这里）。
  - 逐行解析 stream-json：**只处理文本增量 + 结束/出错**，工具调用事件先吞掉不展示。
  - 以 SSE（`text/event-stream`）推给前端；客户端断开时 kill 子进程；设单次超时。
- `GET /api/health`：返回就绪状态（服务在、runner=zcode）。
- 校验逻辑沿用 `server.py` 的做法：skill slug 白名单、消息条数/长度上限、Origin 私网限制。

### 3. Vite 代理切换（`web/vite.config.ts`，改 1 行）

- `/api` 的 target 从 `http://127.0.0.1:8766` 改为 `http://127.0.0.1:8767`。

### 4. 前端接流（改 `web/src/composables/useChatApi.ts`）

- 新增 `streamChat()`：fetch + ReadableStream 解析 SSE，逐段回调文本增量。
- UsePage / ExperiencePage 的输出区改为流式渲染（先只显示文本）。
- 保留现有 `checkHealth` / 离线 / nokey 降级 UI，适配新 health 响应格式。

## 明确砍掉（v2 再做）

| 项 | 说明 |
| --- | --- |
| 数据动态化 | 继续用静态 `skills.ts` / `useTaskConfigs.ts`，不上 JSON 数据层 |
| PiRunner | pi（@mariozechner/pi）+ GLM Max Anthropic 兼容端点，v2 抽 AgentRunner 接口后接入 |
| 工具步骤条 UI | `tool_use` / `tool_result` 事件的折叠展示组件 |
| `--resume` 多轮 | 首版每轮把历史拼进提示词重跑 |
| usage 统计 | token 消耗与缓存命中落盘（`usage.log`）、zcode vs pi 成本对比 |
| 并发/会话管理 | 固定一个 workspace 目录 + 简单超时，够内网自用 |

## 验收标准

1. `npm run server` + `npm run dev` 同时启动。
2. 在 UsePage 选一个技能、输入任务，浏览器**实时**看到 zcode 的流式执行结果（真实多步任务）。
3. 后端不启动时，页面仍显示现有离线提示，表单预览不受影响。
4. `npm run build` 通过，纯静态部署路径未被破坏。

## 启动方式（实施后）

```bash
cd web
npm install
npm run server   # 终端 1：Node 后端（8767）
npm run dev      # 终端 2：Vite（4188，/api 代理到 8767）
```

## 验收记录（2026-09-17）

- ✅ `npm run server` + `npm run dev` 双服务启动。
- ✅ 在线对话页（/experience）：真实流式输出（token 级 text_delta），多轮上下文保留
  （第二轮能基于用户回答追问）；后端离线时自动回落演示输出。
- ✅ 在线运行页（/use）：结构化表单 → 真实 agent 执行 → 流式渲染 + token 用量行
  （实测一例：输入 16.4k · 输出 475 · 缓存命中 11.6k）。
- ✅ agent 具备真实工具行为（会检查沙箱工作区文件后再要求用户提供简历）。
- ✅ `npm run build`（vue-tsc + vite）通过；静态数据 fallback 未破坏。
- 修复记录：终止事件按字段特征识别（payload 多数无 kind 字段）；技能系统提示只在
  新会话注入（多轮不重复注入、技能随对话固定）；流式占位消息在构造请求体之后 push。

## 运行 Trace 记录（2026-09-17 增补）

每次 `/api/chat` 运行自动三层留痕（`web/server/traces/`，`TRACES_DIR` 可覆盖，gitignore）：

1. `<runId>.events.jsonl`：实时协议流（带 sessionId 的请求/响应/通知 + runStart/runEnd），逐行落盘。
2. `<runId>.json`：终态时从 zcode SQLite 导出的权威 trace（session/summary/messages，schema 稳定）。
3. `index.jsonl`：每运行一行（outcome/duration/usage/toolCallCount/文件路径）——评测入口。

脚本：`npm run traces:summary`（按 skill 统计成功率/时长分位数/token/缓存命中率）、
`trace:md -- <runId>`（可读 MD）、`trace:backfill`（补导历史会话）、
`traces:prune -- --keep N`。outcome 取值：success / timeout / error / aborted / historical。

## 附：长期方向与决策记录

### 双 Runner（AgentRunner 抽象）

- 接口：`run(input): AsyncIterable<AgentEvent>`，事件统一为
  `text | tool_use | tool_result | usage | done | error`，转 SSE 推给前端。
- **ZcodeRunner**：面向内网演示——能力最强（多步规划、文件/shell、skills、MCP 全可用），
  但绑本机 CLI 登录态，额度共享、并发受限，不适合公网。
- **PiRunner**：面向对外部署——pi 作为 Node 库嵌入，可编程控制工具白名单与缓存断点，
  模型走 GLM Max（智谱 Anthropic 兼容端点 `https://open.bigmodel.cn/api/anthropic` +
  `ZHIPU_API_KEY`，模型如 `glm-4.7`），成本透明。
- 切换：`AGENT_RUNNER=zcode|pi` 环境变量；`/api/health` 暴露当前 runner。

### 无头调用的优劣（为什么双轨）

- 优：agent 引擎能力完整白嫖；spawn + stdout 集成成本低；`--resume` 可延续会话。
- 劣：每次调用装载系统提示 + 工具 + 全部插件描述（数万 token 固定开销，多步 O(n²) 增长，
  高度依赖 prompt cache 命中）；进程冷启动秒级；agent 有文件/shell 权限必须沙箱；
  受 CLI 登录态与版本漂移约束。
- 结论：低频重任务内网用 zcode；高频轻量对外用 pi + 直连 provider。

### token 成本注意点

- 插件越多固定开销越大（每个 skill 的触发描述都进上下文），无头场景考虑裁剪 profile。
- 缓存命中条件：请求前缀完全一致（同系统提示/工具集/历史）且在 TTL（约 5 分钟）内；
  `--resume` 多轮命中率最高。zcode 走自身网关，命中率以 `usage.log` 实测为准。
- v2 做成本对比：同一任务两 runner 各跑 3 次，汇总写 README。

### 安全边界

- MVP：cwd 限定 `web/server/workspace/` + 单次超时 + 内网使用。
- 公网部署前：容器隔离 + 工具白名单 + 用户体系（LoginModal 目前是假的）。
