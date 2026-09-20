#!/usr/bin/env node
/* ============================================================
   SKILL 广场 · Node 后端（双引擎）
   ------------------------------------------------------------
   职责：把浏览器 /api/chat 桥接到本地 agent 引擎，SSE 流式回传。
   引擎（AgentRunner 抽象，见 lib/runner.ts）：
     · zcode —— zcode app-server（NDJSON，共享单进程，内网全能力）
     · pi   —— pi --mode rpc（每会话一进程，DeepSeek 直连）
   默认引擎由 AGENT_RUNNER 选择（缺省 pi），前端可在请求级覆盖；
   两个引擎共用同一套 SSE 协议与三层 trace 留痕。
   协议笔记：samples/PROTOCOL.md（zcode）、docs/pi-runner.md（pi）。
   ============================================================ */

import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  newRunId,
  appendIndex,
  RunRecorder,
  traceFilePath,
  TRACES_DIR,
  readIndex,
  type RunOutcome,
  type RunRecord,
  type UsageSummary,
} from './lib/traceExport.ts'
import { renderTraceMd } from './lib/traceMd.ts'
import { parseReport } from './lib/reportParse.ts'
import { resolveZcodeCli } from './lib/zcodeCli.ts'
import { loadLocalEnv } from './lib/env.ts'
import { SKILL_PROMPTS, INSTALLED_SKILLS } from './lib/skills.ts'
import { ZcodeRunner } from './lib/zcodeRunner.ts'
import { PiRunner, resolvePiCli, piModelRef } from './lib/piRunner.ts'
import type { AgentRunner, EngineName } from './lib/runner.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

/* web/.env 本地配置（模板见 .env.example，不进仓库）；外部环境变量优先于文件 */
loadLocalEnv()

const PORT = Number(process.env.PORT || 8767)
const RUN_TIMEOUT_MS = 10 * 60_000
/** 已安装真实技能的运行要读资料、做检索、跑脚本，放宽到 20 分钟（可用 RUN_TIMEOUT_MS 环境变量覆盖） */
const RUN_TIMEOUT_MS_INSTALLED = Number(process.env.RUN_TIMEOUT_MS || 20 * 60_000)
const HEARTBEAT_MS = 15_000
const MAX_BODY_BYTES = 512_000

/* ------------------------------------------------------------
   引擎注册：AGENT_RUNNER=zcode|pi 选默认（缺省 pi）；
   引擎缺依赖时不阻止服务启动，仅标记不可用（/api/health 暴露）
   ------------------------------------------------------------ */

type EngineEntry =
  | { runner: AgentRunner; available: true }
  | { available: false; reason: string }

const zcodeCli = resolveZcodeCli()
const piCli = resolvePiCli()
const RUNNERS: Partial<Record<EngineName, EngineEntry>> = {
  zcode: zcodeCli
    ? { runner: new ZcodeRunner(zcodeCli), available: true }
    : {
        available: false,
        reason: '未找到 zcode CLI（ZCODE_CLI 配置 / 常见安装位置 / PATH 均未命中）',
      },
  pi: piCli
    ? { runner: new PiRunner(piModelRef(), piCli), available: true }
    : { available: false, reason: '未找到 pi CLI（PI_CLI 配置 / PATH 均未命中）' },
}

const REQUESTED_RUNNER = (process.env.AGENT_RUNNER || 'pi').trim().toLowerCase()
if (REQUESTED_RUNNER !== 'zcode' && REQUESTED_RUNNER !== 'pi')
  console.warn(`忽略非法 AGENT_RUNNER=${REQUESTED_RUNNER}（仅支持 zcode|pi），回落到 pi`)
const DEFAULT_ENGINE: EngineName =
  RUNNERS[REQUESTED_RUNNER as EngineName]?.available === true
    ? (REQUESTED_RUNNER as EngineName)
    : RUNNERS.pi?.available === true
      ? 'pi'
      : 'zcode'

if (!Object.values(RUNNERS).some((e) => e?.available)) {
  console.error('zcode 与 pi 两个引擎都不可用，无法启动：')
  for (const [name, e] of Object.entries(RUNNERS)) console.error(`- ${name}：${e && !e.available ? e.reason : ''}`)
  process.exit(1)
}
if (REQUESTED_RUNNER === 'zcode' && DEFAULT_ENGINE !== 'zcode')
  console.warn(`AGENT_RUNNER=zcode 但 zcode 不可用，默认引擎回落为 ${DEFAULT_ENGINE}`)

function runnerOf(engine: EngineName): AgentRunner {
  const e = RUNNERS[engine]
  if (!e?.available) throw new Error(`「${engine}」引擎不可用：${e && !e.available ? e.reason : '未知'}`)
  return e.runner
}

/* ------------------------------------------------------------
   会话管理：浏览器 sessionId → 引擎会话 + 沙箱目录
   （会话与引擎绑定：中途换引擎会拒绝，需开启新会话）
   ------------------------------------------------------------ */

const sessions = new Map<
  string,
  { engine: EngineName; engineSessionId: string; workspaceDir: string; busy: boolean }
>()

function workspaceDirFor(clientSessionId: string): string {
  const dir = join(__dirname, 'workspace', clientSessionId)
  mkdirSync(dir, { recursive: true })
  return dir
}

/* ------------------------------------------------------------
   HTTP：GET /api/health、POST /api/chat（SSE）、GET /api/runs*
   ------------------------------------------------------------ */

const PRIVATE_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

function originAllowed(origin: string | undefined): boolean {
  if (!origin) return true // 同源或非浏览器
  try {
    const { hostname } = new URL(origin)
    if (PRIVATE_HOSTS.has(hostname) || hostname.endsWith('.local')) return true
    if (/^10\./.test(hostname)) return true
    if (/^192\.168\./.test(hostname)) return true
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true
    return false
  } catch {
    return false
  }
}

function sendJson(res: any, status: number, payload: any) {
  const data = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(data)
}

function readBody(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('请求内容过大。'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url || '').split('?')[0])
  const seg = path.split('/').filter(Boolean) // 如 ['api','runs',runId,'file',kind]
  if (req.method === 'GET' && path === '/api/health') {
    const defaultRunner = runnerOf(DEFAULT_ENGINE)
    sendJson(res, 200, {
      ok: true,
      model: defaultRunner.describe(),
      runner: DEFAULT_ENGINE,
      engines: (Object.entries(RUNNERS) as [EngineName, EngineEntry][]).map(
        ([id, e]) =>
          e?.available
            ? { id, available: true, model: e.runner.describe() }
            : { id, available: false, reason: e ? e.reason : '未注册' },
      ),
      message: 'API 已配置',
    })
    return
  }
  if (req.method === 'POST' && path === '/api/chat') {
    handleChat(req, res)
    return
  }
  /* ---- 运行记录（只读，评测用）---- */
  if (req.method === 'GET' && seg[0] === 'api' && seg[1] === 'runs') {
    if (!originAllowed(req.headers.origin)) {
      sendJson(res, 403, { error: '不允许跨站调用本地 API。' })
      return
    }
    handleRunsApi(req, res, seg)
    return
  }
  sendJson(res, 404, { error: '接口不存在。' })
})

/** GET /api/runs（列表）· /api/runs/:runId（详情）· /api/runs/:runId/file/:kind（下载，md 按需生成） */
function handleRunsApi(req: any, res: any, seg: string[]) {
  if (seg.length === 2) {
    const query = new URL(req.url, 'http://localhost').searchParams
    const limit = Math.max(1, Math.min(500, Number(query.get('limit')) || 100))
    const skill = query.get('skill') || undefined
    const outcome = query.get('outcome') || undefined
    const runs = readIndex()
      .reverse()
      .filter(r => (!skill || r.skill === skill) && (!outcome || r.outcome === outcome))
      .slice(0, limit)
    sendJson(res, 200, { runs })
    return
  }

  const runId = seg[2]
  const record = readIndex().find(r => r.runId === runId)
  if (!record) {
    sendJson(res, 404, { error: '运行记录不存在。' })
    return
  }

  if (seg.length === 3) {
    let trace: unknown = null
    try {
      if (record.files.trace && existsSync(record.files.trace))
        trace = JSON.parse(readFileSync(record.files.trace, 'utf8'))
    } catch {
      /* 文件损坏按无详情处理 */
    }
    sendJson(res, 200, { item: record, trace })
    return
  }

  if (seg.length === 5 && seg[3] === 'file') {
    const kind = seg[4]
    let file: string | null = null
    let type = 'text/plain; charset=utf-8'
    if (kind === 'events' && record.files.events && existsSync(record.files.events)) {
      file = record.files.events
      type = 'application/x-ndjson; charset=utf-8'
    } else if (kind === 'trace' && record.files.trace && existsSync(record.files.trace)) {
      file = record.files.trace
      type = 'application/json; charset=utf-8'
    } else if (kind === 'report' && record.files.report && existsSync(record.files.report)) {
      file = record.files.report
      type = 'application/json; charset=utf-8'
    } else if (kind === 'md' && record.files.trace && existsSync(record.files.trace)) {
      const mdFile = traceFilePath(runId, 'trace').replace(/\.json$/, '.md')
      if (!existsSync(mdFile)) {
        const trace = JSON.parse(readFileSync(record.files.trace, 'utf8'))
        writeFileSync(mdFile, renderTraceMd(trace))
      }
      file = mdFile
      type = 'text/markdown; charset=utf-8'
    }
    if (!file) {
      sendJson(res, 404, { error: '文件不存在。' })
      return
    }
    const data = readFileSync(file)
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': data.length,
      'Content-Disposition': `attachment; filename="${file.split('/').pop()}"`,
      'Cache-Control': 'no-store',
    })
    res.end(data)
    return
  }

  sendJson(res, 404, { error: '接口不存在。' })
}

async function handleChat(req: any, res: any) {
  let body: any
  try {
    if (!originAllowed(req.headers.origin)) {
      sendJson(res, 403, { error: '不允许跨站调用本地 API。' })
      return
    }
    body = JSON.parse((await readBody(req)).toString('utf8'))
  } catch (exc: any) {
    sendJson(res, 400, { error: exc.message || '请求格式不正确。' })
    return
  }

  const { skill, messages, sessionId } = body || {}
  if (!skill || !(skill in SKILL_PROMPTS)) {
    sendJson(res, 400, { error: '请选择有效的 SKILL。' })
    return
  }
  /* 引擎随请求可覆盖（缺省用 AGENT_RUNNER 默认）；同一会话与引擎绑定 */
  const engineRaw = typeof body.engine === 'string' ? body.engine : DEFAULT_ENGINE
  if (engineRaw !== 'zcode' && engineRaw !== 'pi') {
    sendJson(res, 400, { error: 'engine 仅支持 zcode 或 pi。' })
    return
  }
  const engine: EngineName = engineRaw
  if (!RUNNERS[engine]?.available) {
    const e = RUNNERS[engine]!
    sendJson(res, 400, { error: `「${engine}」引擎不可用：${e.available ? '' : e.reason}` })
    return
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    sendJson(res, 400, { error: '请至少输入一条消息。' })
    return
  }
  const latest = messages[messages.length - 1]
  if (latest?.role !== 'user' || typeof latest.content !== 'string' || !latest.content.trim()) {
    sendJson(res, 400, { error: '最后一条必须是有效的用户消息。' })
    return
  }

  // 切到 SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  const sse = (obj: any) => res.write(`data: ${JSON.stringify(obj)}\n\n`)
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(': ping\n\n')
  }, HEARTBEAT_MS)
  const finish = () => {
    clearInterval(heartbeat)
    if (!res.writableEnded) res.end()
  }

  const clientSessionId: string =
    typeof sessionId === 'string' && sessionId ? sessionId : randomUUID()
  const existingEntry = sessions.get(clientSessionId)
  if (existingEntry && existingEntry.engine !== engine) {
    sse({
      type: 'error',
      message: `该会话由「${existingEntry.engine}」引擎创建，请刷新页面用新会话使用「${engine}」。`,
    })
    finish()
    return
  }
  let entry = existingEntry
  let unlisten: () => void = () => {}
  let untap: () => void = () => {}
  let cleaned = false
  let clientGone = false
  let timeout: ReturnType<typeof setTimeout>

  const runner = runnerOf(engine)

  /* ---- trace 记录：实时流 + 终态导出 + 索引（见 lib/traceExport.ts） ---- */
  const runId = newRunId()
  const startedAt = Date.now()
  const promptDigest = String(latest.content).replace(/\s+/g, ' ').slice(0, 80)
  const recorder = new RunRecorder(runId, { clientSessionId, engine, skill, promptDigest })
  let lastUsage: UsageSummary | undefined
  let finalText = ''
  let runFinalized = false

  const finalizeRun = (outcome: RunOutcome) => {
    if (runFinalized) return
    runFinalized = true
    const durationMs = Date.now() - startedAt
    recorder.end(outcome, { durationMs, usage: lastUsage })
    const record: RunRecord = {
      runId,
      ts: new Date(startedAt).toISOString(),
      clientSessionId,
      engine,
      engineSessionId: entry?.engineSessionId,
      skill,
      promptDigest,
      outcome,
      durationMs,
      usage: lastUsage,
      files: { events: recorder.file },
    }
    void (async () => {
      try {
        if (entry?.engineSessionId) {
          const traceFile = traceFilePath(runId, 'trace')
          const result = await runner.exportTrace(entry.engineSessionId, traceFile)
          if (result) {
            record.toolCallCount = result.toolCallCount
            record.files.trace = traceFile
          }
        }
      } catch (exc: any) {
        recorder.note({ traceExportError: exc?.message ?? String(exc) })
      }
      /* MVP 直出模式：解析最终回复（报告全文）为结构化结果并落盘（pi 专属） */
      if (engine === 'pi' && finalText) {
        try {
          const parsed = parseReport(finalText)
          if (parsed) {
            record.report = {
              structurePass: parsed.structurePass,
              missingSections: parsed.missingSections,
              stats: parsed.stats,
            }
            record.files.report = traceFilePath(runId, 'report')
            writeFileSync(record.files.report, JSON.stringify(parsed, null, 1))
          }
        } catch (exc: any) {
          recorder.note({ reportParseError: exc?.message ?? String(exc) })
        }
      }
      appendIndex(record)
    })()
  }

  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    clearTimeout(timeout)
    unlisten()
    untap()
    if (entry) entry.busy = false
  }

  timeout = setTimeout(() => {
    if (entry) runner.stop(entry.engineSessionId)
    sse({ type: 'error', message: '任务超时，已停止。' })
    finalizeRun('timeout')
    cleanup()
    finish()
  }, INSTALLED_SKILLS.has(skill) ? RUN_TIMEOUT_MS_INSTALLED : RUN_TIMEOUT_MS)

  /* SSE 断连检测：res close 且响应未正常结束 = 客户端提前断开
     （req 的 close 在 body 读完后语义不可靠，勿用） */
  res.on('close', () => {
    if (res.writableEnded) return
    clientGone = true
    if (entry?.busy) {
      runner.stop(entry.engineSessionId)
      finalizeRun('aborted')
      cleanup()
    }
    clearInterval(heartbeat)
  })

  try {
    if (!entry) {
      const dir = workspaceDirFor(clientSessionId)
      const engineSessionId = await runner.createSession(dir, { skill })
      entry = { engine, engineSessionId, workspaceDir: dir, busy: false }
      sessions.set(clientSessionId, entry)
      recorder.note({ created: engineSessionId, engine, workspaceDir: dir })
      sse({ type: 'session', sessionId: clientSessionId })
    }
    if (entry.busy) {
      sse({ type: 'error', message: '该会话正在执行任务，请稍候。' })
      finalizeRun('error')
      cleanup()
      finish()
      return
    }
    entry.busy = true
    untap = runner.tapSession(entry.engineSessionId, (dir, msg) => recorder.proto(dir, msg))

    /* 创建期间客户端已断开：停止 turn，不再空跑 */
    if (clientGone) {
      runner.stop(entry.engineSessionId)
      finalizeRun('aborted')
      cleanup()
      finish()
      return
    }

    // 归一事件 → SSE（引擎差异已在各 Runner 内消化，这里五类事件统一）
    unlisten = runner.listen(entry.engineSessionId, (ev) => {
      if (ev.kind === 'text_delta') {
        sse({ type: 'text', delta: ev.delta })
      } else if (ev.kind === 'usage') {
        lastUsage = ev.usage ?? lastUsage
        sse({ type: 'usage', usage: ev.usage, content: ev.content })
      } else if (ev.kind === 'terminal') {
        lastUsage = ev.usage ?? lastUsage
        finalText = ev.response
        sse({ type: 'usage', usage: ev.usage })
        sse({ type: 'done', content: ev.response, resultType: ev.resultType })
        finalizeRun(clientGone ? 'aborted' : 'success')
        cleanup()
        finish()
      } else if (ev.kind === 'error') {
        sse({ type: 'error', message: ev.message })
        finalizeRun('error')
        cleanup()
        finish()
      }
    })

    await runner.send(entry.engineSessionId, runner.buildPrompt(skill, messages, !existingEntry))
  } catch (exc: any) {
    sse({ type: 'error', message: exc.message || '执行失败，请稍后重试。' })
    finalizeRun('error')
    cleanup()
    finish()
  }
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`SKILL 广场 Node 后端：http://127.0.0.1:${PORT}/`)
  console.log(`默认引擎：${DEFAULT_ENGINE}（AGENT_RUNNER=zcode|pi 可改）`)
  for (const [name, e] of Object.entries(RUNNERS)) {
    if (e?.available) {
      const r = e.runner
      console.log(`- ${name}：可用 · ${r.describe()}`)
    } else {
      console.log(`- ${name}：不可用 · ${e && !e.available ? e.reason : ''}`)
    }
  }
  if (RUNNERS.pi?.available)
    console.log('pi 凭据：模型 key 需在启动服务的 shell 环境中（如 DEEPSEEK_API_KEY），或写入 web/.env。')
  console.log(`trace 记录：${TRACES_DIR}`)
})

/* 服务退出时回收引擎会话进程（pi 每会话一进程，避免残留） */
server.on('close', () => {
  for (const entry of sessions.values()) {
    const e = RUNNERS[entry.engine]
    if (e?.available) e.runner.disposeSession(entry.engineSessionId)
  }
})
