# Skill搭子 · SKILL 广场（产教领域）

展示产教领域公开 SKILL 的目录站点，并提供**在线真实运行**：浏览器提交任务 → Node 后端桥接本机 agent 引擎（**pi · DeepSeek** 或 **zcode · GLM**，可切换）→ SSE 流式看到多步 agent 执行 → 运行留痕可回看。

- 前端：`web/`，Vue 3 + TypeScript + Vite
- 后端：`web/server/index.ts`，node:http 零第三方依赖；`AgentRunner` 抽象基类（`lib/runner.ts`）下挂两个引擎：
  - **pi**（默认）：每会话一个 `pi --mode rpc` 常驻子进程（JSONL over stdio），模型 DeepSeek（`deepseek/deepseek-v4-pro`）
  - **zcode**：全局共享一个 `zcode app-server` 子进程（NDJSON 协议），GLM Coding Plan
- 技能：`.agents/skills/` 已随仓库分发，clone 即有（zcode 用 Skill 工具自动发现加载，pi 用 `--skill` + `/skill:` 命令）；`.agents/skills/` 是跨引擎中性约定，不绑定任何一家

## 架构

```
Vue SPA ── POST /api/chat {skill, messages, engine?} ──> Node 后端 (8767)
                              │  AgentRunner 抽象（lib/runner.ts）
                              │    ├─ PiRunner（默认）：每会话 spawn pi --mode rpc
                              │    │    prompt → message_update(text_delta) → agent_settled
                              │    └─ ZcodeRunner：全局共享 zcode app-server
                              │         session/create → subscribe → send → session/event
                              │  引擎事件归一为 text/usage/terminal/error → SSE 推给浏览器
                              ├─ GET /api/health（默认引擎 + 可用引擎清单）
                              └─ GET /api/runs（运行记录只读 API，含 engine 字段）
```

默认引擎由 `AGENT_RUNNER=zcode|pi` 选择（缺省 pi）；`/experience`、`/use` 页面可按运行切换引擎（不可用的引擎置灰并提示原因），会话与引擎绑定。

开发期 Vite（4188）把 `/api` 代理到 8767；前端只访问同源 `/api/*`，不感知后端形态。

## 快速开始

### 前置条件

| 依赖 | 说明 |
| --- | --- |
| Node.js ≥ 22.18（建议 24+） | 后端用 `node` 直接运行 TypeScript（内置 type stripping），不用 tsx |
| pi CLI（默认引擎） | `npm i -g @earendil-works/pi-coding-agent`；模型 key 走环境变量（如 `DEEPSEEK_API_KEY`），自检 `pi auth check --provider deepseek` |
| ZCode 客户端（可选引擎） | AI 执行走本机 ZCode 无头模式，**鉴权是各自本机的 ZCode 登录态（GLM Coding Plan），不进仓库、不需要共享密钥** |

两个引擎只要有一个可用，后端即可启动；均不可用才报错退出。

### 启动步骤

```bash
# 1. 准备引擎（至少其一）：
#    pi（默认）：npm i -g @earendil-works/pi-coding-agent，并保证启动后端的
#    shell 环境里有 DEEPSEEK_API_KEY（或写入 web/.env）
#    zcode：安装并登录 ZCode 桌面客户端（~/.zcode/cli/config.json）

# 2. 克隆仓库后安装依赖
cd web
npm install

# 3. 终端 1：启动 Node 后端（8767）
npm run server

# 4. 终端 2：启动前端开发服务（4188，/api 自动代理到 8767）
npm run dev
```

打开 http://127.0.0.1:4188 。后端未启动时页面不报错：运行记录页自动回落演示数据，在线运行页会提示启动方式。

### CLI 路径（自动检测，跨平台）

后端启动时自动定位 zcode CLI，无需手动配置。检测顺序：

1. `ZCODE_CLI` 显式配置（环境变量或 `web/.env`，优先级最高）
2. 当前平台常见安装位置：macOS 的 `/Applications/ZCode.app/...` 与 `~/Applications/...`、Windows 的 `%LOCALAPPDATA%\Programs\ZCode\...` 与 `C:\Program Files\ZCode\...`、Linux 的 `/opt/ZCode/...` 等，以及 `~/.zcode/cli/`
3. `PATH` 扫描（`zcode` / `zcode.exe` / `zcode.cmd` / `zcode.cjs`）

检测结果不落盘：每次启动重新检测，环境变化（升级、换安装位置、PATH 变更）自动适配；显式配置的 `ZCODE_CLI` 即使路径无效也不回落，仅在启动日志警告。

同事 clone 后想确认环境是否就绪，先跑自检（同时检查 CLI 位置与 `~/.zcode/cli/config.json` 登录态）：

```bash
cd web && npm run detect:cli
```

找不到 CLI 时服务启动即报错并给出指引；CLI 装在自定义位置时，在 `web/.env` 里设置 `ZCODE_CLI` 兜底（见下节）。

## 配置（web/.env）

后端支持 `web/.env` 本地配置文件：复制模板 `cp web/.env.example web/.env` 后按需取消注释。`.env` 已 gitignore 不进仓库；外部环境变量（shell 里 export 的）优先于 `.env` 文件。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `AGENT_RUNNER` | `pi` | 默认引擎（`zcode`\|`pi`）；前端页面仍可按运行切换 |
| `PI_CLI` | 自动检测（PATH） | pi CLI 路径 |
| `PI_MODEL` | `deepseek/deepseek-flash` | pi 运行模型，格式 `provider/model`（要更强推理可切 `deepseek/deepseek-v4-pro`） |
| `PI_THINKING` | `low` | pi 思考档位（`off`..`max`）。长推理是 token 大头，MVP 演示建议 `low` |
| `PI_IDLE_MS` | 30 分钟 | pi 会话进程空闲回收阈值（pi 每会话一进程） |
| `DEEPSEEK_API_KEY` | — | pi 引擎的模型 key（也可放 shell 环境；pi 按 `pi auth` 的读取顺序） |
| `ZCODE_CLI` | 自动检测（见上节） | zcode CLI 路径，仅检测失败或需固定版本时设置 |
| `PORT` | `8767` | 后端端口（Vite 代理目标需同步改） |
| `RUN_TIMEOUT_MS` | 已安装技能 20 分钟，其余 10 分钟 | 单次运行超时 |
| `TRACES_DIR` | `web/server/traces/` | 运行留痕目录（已 gitignore） |

## 页面

| 路由 | 内容 |
| --- | --- |
| `/` | 首页 |
| `/skills`、`/skill/:slug` | SKILL 目录与详情 |
| `/experience` | 在线对话（多轮，流式输出） |
| `/use/:slug?` | 在线运行（结构化表单 → 真实 agent 执行 → 流式渲染 + token 用量） |
| `/runs`、`/runs/:runId` | 运行记录列表与详情（后端离线时回落演示数据） |
| `/guide` | 使用指南 |

## 后端 API

| 接口 | 说明 |
| --- | --- |
| `GET /api/health` | 就绪状态（默认引擎、模型、可用引擎清单及不可用原因） |
| `POST /api/chat` | `{ skill, messages, engine? }` → SSE 流式返回（text_delta / usage / 终止）；`engine` 缺省用默认引擎，会话与引擎绑定 |
| `GET /api/runs` | 运行列表（来自 traces/index.jsonl） |
| `GET /api/runs/:runId` | 运行详情 |
| `GET /api/runs/:runId/file/:kind` | 下载留痕文件（md 可读版按需生成） |

## 技能安装状态

- **industry-education-report**：已 vendored 到仓库 `.agents/skills/`，clone 自带，zcode 自动发现，首轮指示 agent 用 Skill 工具加载。
- **classroom-assistant / ai-interview / training-data-qa**：尚未安装为真实技能，运行时回落到后端内置的方法论提示词。

## 运行留痕（traces）

每次 `/api/chat` 自动三层留痕到 `web/server/traces/`（gitignore）：

1. `<runId>.events.jsonl` — 实时协议流（请求/响应/事件 + runStart/runEnd，两引擎都有）
2. `<runId>.json` — 权威 trace（zcode：从其 SQLite 导出；pi：从 RPC `get_messages` 导出，形状同构）
3. `index.jsonl` — 每运行一行（engine / outcome / duration / usage / toolCallCount），评测入口

配套脚本：`npm run traces:summary`（按 skill 统计成功率、时长分位数、token 与缓存命中率）、`npm run trace:md -- <runId>`（可读 MD）、`npm run trace:backfill`（补导历史会话）、`npm run traces:prune -- --keep N`。

## 沙箱与安全边界

- agent 的文件操作限定在 `web/server/workspace/<会话>/` 下，单次运行有超时。
- 当前定位是**内网自用**：绑本机 CLI 登录态，额度共享、并发受限。公网部署前需要容器隔离 + 工具白名单 + 真实用户体系。

## 构建与部署

```bash
cd web
npm run build   # vue-tsc 类型检查 + vite build，产物在 web/dist/
```

产物为纯静态站点，可直接静态托管；在线运行与运行记录功能仍需 8767 后端在 `/api` 同路径提供服务。

## 旧版演示（根目录）

根目录的 `index.html` / `app.js` / `server.py` 是早期无 npm 的静态演示版（Youcai API 本地代理），已被 `web/` 版取代，仅作历史保留。设计背景见 `skills/foru-web-ui/`；后端方案与协议笔记见 `web/docs/agent-backend-mvp.md`、`web/docs/pi-runner.md`、`web/server/samples/PROTOCOL.md`。

---

更新：2026-09-18 — 双引擎落地：AgentRunner 抽象 + PiRunner（pi --mode rpc · DeepSeek，默认）+ ZcodeRunner 保留；前端可切换引擎。
更新：2026-09-17 — README 重写，对齐 zcode 无头后端 + 运行记录页的当前架构。
