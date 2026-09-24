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
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, basename, resolve, sep } from 'node:path'
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
import { serverEnv } from './lib/agentEnv.ts'
import { resolveZcodeCli } from './lib/zcodeCli.ts'
import { loadLocalEnv } from './lib/env.ts'
import { SKILL_PROMPTS, INSTALLED_SKILLS, SIDECAR_SKILLS } from './lib/skills.ts'
import {
  extractSidecar,
  validateMeta,
  SIDECAR_MARKER,
  EMPTY_META_COUNTS,
  type SidecarExtract,
} from './lib/reportMeta.ts'
import { ZcodeRunner } from './lib/zcodeRunner.ts'
import { PiRunner, resolvePiCli, piModelRef } from './lib/piRunner.ts'
import type { AgentRunner, EngineName, RunnerEvent } from './lib/runner.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

/* web/.env 本地配置（模板见 .env.example，不进仓库）；外部环境变量优先于文件 */
loadLocalEnv()

const PORT = Number(process.env.PORT || 8767)
const RUN_TIMEOUT_MS = 10 * 60_000
/** 已安装真实技能的运行要读资料、做检索、跑脚本，放宽到 20 分钟（可用 RUN_TIMEOUT_MS 环境变量覆盖） */
const RUN_TIMEOUT_MS_INSTALLED = Number(process.env.RUN_TIMEOUT_MS || 20 * 60_000)
const HEARTBEAT_MS = 15_000
const MAX_BODY_BYTES = 512_000

/* 附件上传：文件落会话沙箱 workspace/<sessionId>/uploads/；
   base64 膨胀 4/3，6MB 文件 ≈ 8MB body，上限放宽到 10MB */
const MAX_UPLOAD_BODY_BYTES = 10_000_000
const MAX_UPLOAD_FILE_BYTES = 6 * 1024 * 1024
const UPLOAD_EXT_WHITELIST = new Set(['.pdf', '.docx', '.doc', '.md', '.txt'])

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

/* ------------------------------------------------------------
   沙箱 AGENTS.md：会话工作目录的服务端说明（Agent 从 cwd 收集
   AGENTS.md——pi resource-loader 与 zcode 同一约定）。目前只声明
   MySQL 只读查询工具；MYSQL_* 未配置时（如公开部署无凭据）不写
   工具节，避免给 Agent 一把坏工具。内容确定性覆盖，每次创建重写。
   ------------------------------------------------------------ */
const MYSQL_QUERY_TOOL = join(__dirname, '../../scripts/mysql-query.mjs')

function mysqlConfigured(): boolean {
  return Boolean(
    process.env.MYSQL_HOST && process.env.MYSQL_USER && process.env.MYSQL_PASSWORD && process.env.MYSQL_DATABASE,
  )
}

function sandboxAgentsMd(): string {
  const lines = [
    '# 会话沙箱',
    '',
    '这是本次会话的独立工作目录；uploads/ 内是用户上传的附件。',
  ]
  if (mysqlConfigured()) {
    lines.push(
      '',
      '## MySQL 只读查询工具',
      '',
      `用 bash 执行 \`node "${MYSQL_QUERY_TOOL}" "SQL"\` 可查询岗位库（只读，JSON 输出：columns/rows/truncated）。`,
      '选项：`--max-rows N`（默认 200）、`--max-cell-chars N`（默认 400）、`--format table`、`--timeout-ms N`。',
      '约定：先小范围探查（LIMIT / COUNT）再聚合；无索引列全表 GROUP BY 可能数十秒；',
      '中文岗位名检索用 LIKE（FULLTEXT 未装 ngram 分词，MATCH 中文无效）。',
      '报告类技能（industry-education-report / career-guidance）默认以内置口径文档为准，除非用户明确要求查库。',
    )
  }
  return lines.join('\n') + '\n'
}

function workspaceDirFor(clientSessionId: string): string {
  const dir = join(__dirname, 'workspace', clientSessionId)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'AGENTS.md'), sandboxAgentsMd())
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

function readBody(req: any, limit: number = MAX_BODY_BYTES): Promise<Buffer> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > limit) {
        reject(new Error('请求内容过大。'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolveBody(Buffer.concat(chunks)))
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
            ? { id, available: true, model: e.runner.describe(), version: e.runner.envInfo().agentVersion }
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
  if (req.method === 'POST' && path === '/api/upload') {
    handleUpload(req, res)
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

/** POST /api/upload：{ sessionId?, filename, dataBase64 } → 文件落会话沙箱 uploads/ 目录。
    不写 sessions map——引擎会话仍由 /api/chat 首次调用创建（isFirstTurn 判定不受影响），
    workspace 目录名即 sessionId，后续 chat 天然复用同一目录。 */
async function handleUpload(req: any, res: any) {
  if (!originAllowed(req.headers.origin)) {
    sendJson(res, 403, { error: '不允许跨站调用本地 API。' })
    return
  }
  let body: any
  try {
    body = JSON.parse((await readBody(req, MAX_UPLOAD_BODY_BYTES)).toString('utf8'))
  } catch (exc: any) {
    sendJson(res, 400, { error: exc.message || '请求格式不正确。' })
    return
  }
  const { sessionId, filename, dataBase64, dataText } = body || {}
  const hasContent = typeof dataBase64 === 'string' || typeof dataText === 'string'
  if (typeof filename !== 'string' || !hasContent) {
    sendJson(res, 400, { error: '缺少文件名或文件内容。' })
    return
  }
  /* 消毒：只取 basename，去控制字符；扩展必须在白名单内 */
  const cleaned = (filename.split(/[/\\]/).pop() ?? '')
    .replace(/[\u0000-\u001f<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const dot = cleaned.lastIndexOf('.')
  const ext = dot >= 0 ? cleaned.slice(dot).toLowerCase() : ''
  if (!cleaned || cleaned === '.' || cleaned === '..' || !UPLOAD_EXT_WHITELIST.has(ext)) {
    sendJson(res, 400, { error: '仅支持 pdf / docx / doc / md / txt 文件。' })
    return
  }
  let data: Buffer
  try {
    if (typeof dataText === 'string') {
      /* 文本直传（内置演示附件用），按 UTF-8 字节数限长 */
      data = Buffer.from(dataText, 'utf8')
    } else {
      /* 兼容 FileReader.readAsDataURL 带的 data URL 前缀与裸 base64 两种输入 */
      const bare = dataBase64.includes(',')
        ? dataBase64.slice(dataBase64.indexOf(',') + 1)
        : dataBase64
      data = Buffer.from(bare, 'base64')
    }
  } catch {
    sendJson(res, 400, { error: '文件内容无法解码。' })
    return
  }
  if (!data.length) {
    sendJson(res, 400, { error: '文件内容为空。' })
    return
  }
  if (data.length > MAX_UPLOAD_FILE_BYTES) {
    sendJson(res, 400, { error: '文件超过 6MB 上限。' })
    return
  }
  const clientSessionId =
    typeof sessionId === 'string' && sessionId ? sessionId : newRunId('sess-')
  const uploadsDir = join(workspaceDirFor(clientSessionId), 'uploads')
  mkdirSync(uploadsDir, { recursive: true })
  /* 同名不覆盖：追加 -1 / -2 序号 */
  let target = join(uploadsDir, cleaned)
  for (let i = 1; existsSync(target); i++) {
    const stem = dot > 0 ? cleaned.slice(0, dot) : cleaned
    target = join(uploadsDir, `${stem}-${i}${ext}`)
  }
  writeFileSync(target, data)
  sendJson(res, 200, {
    sessionId: clientSessionId,
    name: basename(target),
    path: `uploads/${basename(target)}`,
    size: data.length,
  })
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

  /* 浏览器未带 sessionId 时新开一个：时间格式，兼作沙箱目录名（便于按时间定位 workspace） */
  const clientSessionId: string =
    typeof sessionId === 'string' && sessionId ? sessionId : newRunId('sess-')
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
  /* 附件说明在 digest 之后注入 prompt：路径必须落在本会话沙箱内（防穿越）；
     .md/.txt 直接内联内容（截断 16000 字保底），其余格式指示引擎读工作目录文件 */
  const attachmentNotes: string[] = []
  const attachmentNames: string[] = []
  if (Array.isArray((body as any).attachments)) {
    const workspaceRoot = resolve(workspaceDirFor(clientSessionId))
    for (const item of ((body as any).attachments as any[]).slice(0, 5)) {
      const rel = typeof item?.path === 'string' ? item.path : ''
      if (!rel) continue
      const abs = resolve(workspaceRoot, rel)
      if (!abs.startsWith(workspaceRoot + sep) || !existsSync(abs)) continue
      const name = typeof item.name === 'string' && item.name ? item.name : basename(abs)
      attachmentNames.push(name)
      if (/\.(md|txt)$/i.test(abs)) {
        const text = readFileSync(abs, 'utf8').slice(0, 16_000)
        attachmentNotes.push(`[附件 ${name}（${rel}）内容]\n${text}${text.length >= 16_000 ? '\n（内容超长，已截断）' : ''}`)
      } else {
        attachmentNotes.push(`用户已上传附件 ${rel}（${name}），文件在当前工作目录内，请先读取该文件再继续任务。`)
      }
    }
    if (attachmentNotes.length) {
      latest.content = `${latest.content}\n\n${attachmentNotes.join('\n\n')}`
    }
  }
  const recorder = new RunRecorder(runId, { clientSessionId, engine, skill, promptDigest })
  let lastUsage: UsageSummary | undefined
  let finalText = ''
  let runFinalized = false
  /* 侧车流式隐藏：围栏标记可能跨 delta 到达，未确认出现前扣留尾部
     （长度 = 标记-1）不转发；确认出现后从标记处截断，用户全程看不到 */
  let fullText = ''
  let forwarded = 0
  let hiddenFrom = -1
  let sidecar: SidecarExtract | null = null

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
      attachments: attachmentNames.length ? attachmentNames : undefined,
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
      /* MVP 直出模式：解析最终回复（报告全文）为结构化结果并落盘（pi 专属）。
         章节契约 REPORT_SECTIONS 属于 industry-education-report，其他技能（如就业指导）
         没有对应模板，解析只会得到整份缺失，因此只对该技能执行 */
      if (engine === 'pi' && skill === 'industry-education-report' && finalText) {
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
      /* report-meta 侧车：SIDECAR_SKILLS 命中时校验并落盘
         （设计记录 .agents/skills/plaza-dev-notes 001；正文已在 terminal 剥离） */
      if (engine === 'pi' && SIDECAR_SKILLS.has(skill) && sidecar) {
        try {
          if (sidecar.meta) {
            const v = validateMeta(sidecar.meta)
            record.report = {
              meta: { pass: v.pass, errors: v.errors, counts: v.counts, charts: v.pass ? sidecar.meta.charts : [] },
            }
            record.files.report = traceFilePath(runId, 'report')
            writeFileSync(
              record.files.report,
              JSON.stringify({ skill, meta: sidecar.meta, validation: v }, null, 1),
            )
            recorder.note({
              sidecar: { pass: v.pass, ...v.counts, errors: v.errors.length ? v.errors : undefined },
            })
          } else if (sidecar.error) {
            record.report = { meta: { pass: false, errors: [sidecar.error], counts: EMPTY_META_COUNTS } }
            recorder.note({ sidecarError: sidecar.error })
          } else {
            /* 无块无错：模型本轮没输出侧车（如多轮简短追问），不算失败 */
            recorder.note({ sidecar: 'absent' })
          }
        } catch (exc: any) {
          recorder.note({ sidecarError: exc?.message ?? String(exc) })
        }
      }
      /* 环境快照：版本探测首次触发（此后命中缓存）；失败字段自然缺省 */
      const agentEnv = { ...serverEnv(), ...runner.envInfo() }
      record.agentEnv = agentEnv
      recorder.note({ agentEnv })
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

    // 归一事件 → SSE（引擎差异已在各 Runner 内消化，这里统一映射）
    const onEvent = (ev: RunnerEvent) => {
      if (ev.kind === 'text_delta') {
        /* 侧车隐藏：累积全文检测围栏标记；未出现前扣留标记长度-1 的尾部
           （标记可能跨 delta 到达），出现后从标记处截断不再转发 */
        fullText += ev.delta
        if (hiddenFrom < 0) {
          const at = fullText.indexOf(SIDECAR_MARKER)
          if (at >= 0) {
            hiddenFrom = at
            const visible = fullText.slice(0, at)
            if (visible.length > forwarded) {
              sse({ type: 'text', delta: visible.slice(forwarded) })
              forwarded = visible.length
            }
          } else {
            const safeEnd = Math.max(forwarded, fullText.length - (SIDECAR_MARKER.length - 1))
            if (safeEnd > forwarded) {
              sse({ type: 'text', delta: fullText.slice(forwarded, safeEnd) })
              forwarded = safeEnd
            }
          }
        }
      } else if (ev.kind === 'status') {
        /* 思考/工具阶段的过程信号：正文 delta 之前前端也有"正在推进"的体感 */
        sse({ type: 'status', phase: ev.phase, chars: ev.chars, tool: ev.tool })
      } else if (ev.kind === 'usage') {
        lastUsage = ev.usage ?? lastUsage
        sse({ type: 'usage', usage: ev.usage, content: ev.content })
      } else if (ev.kind === 'terminal') {
        lastUsage = ev.usage ?? lastUsage
        /* 剥离侧车：done 只发干净正文；全文见 traces/<runId>.events.jsonl */
        sidecar = extractSidecar(ev.response)
        finalText = sidecar.cleanText
        if (hiddenFrom < 0 && fullText.length > forwarded) {
          /* 未出现围栏：补发被扣留的尾部（ExperiencePage 等按 delta 聚合展示） */
          sse({ type: 'text', delta: fullText.slice(forwarded) })
        }
        sse({ type: 'usage', usage: ev.usage })
        sse({ type: 'done', content: finalText, resultType: ev.resultType })
        finalizeRun(clientGone ? 'aborted' : 'success')
        cleanup()
        finish()
      } else if (ev.kind === 'error') {
        sse({ type: 'error', message: ev.message })
        finalizeRun('error')
        cleanup()
        finish()
      }
    }
    unlisten = runner.listen(entry.engineSessionId, onEvent)

    try {
      await runner.send(entry.engineSessionId, runner.buildPrompt(skill, messages, !existingEntry))
    } catch (exc: any) {
      /* pi 会话进程被空闲回收/退出后，浏览器仍持旧 sessionId——此前每次运行都会
         立刻报错，只能刷新页面。这里透明重建引擎会话并按首轮重注入技能指令
         （引擎侧多轮上下文已随进程丢失，无法恢复），替代报错要求手动刷新。 */
      const gone = /会话不存在|会话进程已退出/.test(String(exc?.message ?? ''))
      if (!gone) throw exc
      runner.disposeSession(entry.engineSessionId)
      const engineSessionId = await runner.createSession(entry.workspaceDir, { skill })
      entry.engineSessionId = engineSessionId
      sessions.set(clientSessionId, entry)
      recorder.note({ sessionRecreated: engineSessionId })
      unlisten()
      untap()
      untap = runner.tapSession(engineSessionId, (dir, msg) => recorder.proto(dir, msg))
      unlisten = runner.listen(engineSessionId, onEvent)
      await runner.send(engineSessionId, runner.buildPrompt(skill, messages, true))
    }
  } catch (exc: any) {
    sse({ type: 'error', message: exc.message || '执行失败，请稍后重试。' })
    finalizeRun('error')
    cleanup()
    finish()
  }
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`SKILL 广场 Node 后端：http://127.0.0.1:${PORT}/`)
  /* PLAZA_ENV 前后端共用（前端经 vite envPrefix 暴露）；test 时工作台带演示默认值 */
  const plazaEnv = (process.env.PLAZA_ENV || '').trim().toLowerCase() || 'prod'
  console.log(`运行环境：${plazaEnv}${plazaEnv === 'test' ? '（测试环境：工作台自动带入示例与测试简历）' : '（生产环境：不预填演示默认值）'}`)
  console.log(`默认引擎：${DEFAULT_ENGINE}（AGENT_RUNNER=zcode|pi 可改）`)
  for (const [name, e] of Object.entries(RUNNERS)) {
    if (e?.available) {
      const r = e.runner
      /* 顺带预热版本探测缓存（run 记录 /api/health 共用） */
      const v = r.envInfo().agentVersion
      console.log(`- ${name}：可用 · ${r.describe()}${v ? ` · v${v}` : ''}`)
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
