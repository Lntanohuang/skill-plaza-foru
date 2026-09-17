#!/usr/bin/env node
/* ============================================================
   SKILL 广场 · Node 后端（MVP）
   ------------------------------------------------------------
   职责：把浏览器 /api/chat 桥接到 ZCode app-server（GLM Coding Plan）。
   架构：node:http（无第三方依赖）+ 常驻 zcode app-server 子进程。
   协议：详见 samples/PROTOCOL.md（NDJSON，session/create→subscribe→send）。
   ============================================================ */

import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  newRunId,
  appendIndex,
  RunRecorder,
  exportSessionTrace,
  traceFilePath,
  TRACES_DIR,
  readIndex,
  type RunOutcome,
  type RunRecord,
  type UsageSummary,
} from './lib/traceExport.ts'
import { renderTraceMd } from './lib/traceMd.ts'
import { resolveZcodeCli } from './lib/zcodeCli.ts'
import { loadLocalEnv } from './lib/env.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

/* web/.env 本地配置（模板见 .env.example，不进仓库）；外部环境变量优先于文件 */
loadLocalEnv()

const PORT = Number(process.env.PORT || 8767)
/* zcode CLI 跨平台自动定位：ZCODE_CLI 配置 → 当前平台常见安装位置 → PATH（见 lib/zcodeCli.ts） */
const CLI = resolveZcodeCli()
if (!CLI) {
  console.error('未找到 zcode CLI：已依次检查 ZCODE_CLI 配置、当前平台常见安装位置与 PATH。')
  console.error('请先安装并登录 ZCode 客户端后重试；CLI 在自定义位置时，在 web/.env 配置')
  console.error('ZCODE_CLI=<路径>（模板见 .env.example），或运行 npm run detect:cli 查看检查明细。')
  process.exit(1)
}
const RUN_TIMEOUT_MS = 10 * 60_000
/** 已安装真实技能的运行要读资料、做检索、跑脚本，放宽到 20 分钟（可用 RUN_TIMEOUT_MS 环境变量覆盖） */
const RUN_TIMEOUT_MS_INSTALLED = Number(process.env.RUN_TIMEOUT_MS || 20 * 60_000)
const HEARTBEAT_MS = 15_000
const MAX_BODY_BYTES = 512_000

/* 与旧 server.py 保持一致的技能提示词 */
const SKILL_PROMPTS: Record<string, string> = {
  'industry-education-report':
    '你正在按 industry-education-report SKILL 工作。面向院校管理者、政府部门或产业园区，' +
    '围绕区域产业、岗位人才、重点企业、就业去向、专业课程与招商形成有证据的决策分析。' +
    '明确区分事实、推断、建议和缺失数据；所有统计结论都提示核验年份、范围、口径和来源；' +
    '资料不足时保留缺口，不编造数字。先确认任务对象、地区、报告用途和基期，再推进交付。',
  'classroom-assistant':
    '你正在按 classroom-assistant SKILL 工作。只在用户明确提供或授权的课程资料范围内完成' +
    '带定位引用的答疑、课堂要点、练习和答疑记录整理。资料不足或问题越界时，明确说明缺口，' +
    '不要用模型记忆补充课程事实，并把待确认事项整理给教师。',
  'ai-interview':
    '你正在按 ai-interview SKILL 工作。根据目标岗位、岗位要求和用户简历开展交互式模拟面试。' +
    '一次只问一题，根据用户的真实回答智能追问；不要替用户作答。练习结束后引用用户回答原文，' +
    '按能力维度给出证据化复盘、待验证项和可执行的改进建议。评分不代表录用概率。',
  'training-data-qa':
    '你正在按 training-data-qa SKILL 工作。根据治理数据、任务模板和标注规则构造黄金种子、' +
    '扩增样本与难例，规划训练/验证/测试/独立评测划分，并检查 Schema、事实证据、业务规则、' +
    '重复、泄漏和分布。未经专家确认的结果只能标为候选；负责数据构造与验收，不执行模型训练。',
}

/* 已安装为真实技能的 slug（仓库 .zcode/skills/ 下，zcode 可自动发现）：
   首轮指示 agent 用 Skill 工具加载；未安装的技能仍回落到上面的方法论文本 */
const INSTALLED_SKILLS = new Set(['industry-education-report'])

/* ------------------------------------------------------------
   ZCode app-server 桥：一个常驻子进程 + NDJSON 请求/通知
   ------------------------------------------------------------ */

type EventCb = (payload: any) => void

class ZcodeBridge {
  private proc: ReturnType<typeof spawn> | null = null
  private buf = ''
  private nextId = 1
  private pending = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: Error) => void; method: string; sid?: string }
  >()
  /** zcode sessionId → 事件回调集合 */
  private listeners = new Map<string, Set<EventCb>>()
  /** zcode sessionId → 协议 tap（trace 记录用） */
  private taps = new Map<string, (dir: 'out' | 'in', msg: any) => void>()

  tapSession(sessionId: string, fn: (dir: 'out' | 'in', msg: any) => void): () => void {
    this.taps.set(sessionId, fn)
    return () => {
      if (this.taps.get(sessionId) === fn) this.taps.delete(sessionId)
    }
  }

  private tapOf(sessionId: unknown): ((dir: 'out' | 'in', msg: any) => void) | undefined {
    return typeof sessionId === 'string' ? this.taps.get(sessionId) : undefined
  }

  start() {
    if (this.proc) return
    /* .cjs 等脚本用当前 node 运行；独立可执行文件直接 spawn；Windows .cmd 等需 shell */
    const command = CLI.mode === 'node' ? process.execPath : CLI.path
    const args = CLI.mode === 'node' ? [CLI.path, 'app-server'] : ['app-server']
    const proc = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'inherit'],
      ...(CLI.mode === 'shell' ? { shell: true } : {}),
    })
    this.proc = proc
    proc.stdout!.on('data', (d: Buffer) => {
      this.buf += d.toString('utf8')
      let i: number
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim()
        this.buf = this.buf.slice(i + 1)
        if (line) {
          try {
            this.handleLine(JSON.parse(line))
          } catch {
            // 协议外的行直接忽略
          }
        }
      }
    })
    proc.once('exit', () => {
      this.proc = null
      for (const p of this.pending.values())
        p.reject(new Error('zcode app-server 进程退出'))
      this.pending.clear()
      this.listeners.clear()
    })
  }

  private handleLine(msg: any) {
    // 服务端反向请求：必须应答，否则 15s 超时（实测两类，其余空对象兜底）
    if (msg.id !== undefined && msg.method) {
      this.tapOf(msg.params?.sessionId)?.('in', msg)
      let result: any = {}
      if (msg.method === 'session/requestRuntimePreferences')
        result = { nativeSearchEnhancementsEnabled: false }
      else if (msg.method === 'interaction/requestOfficialMcpAuthHeaders')
        result = { headers: {} }
      this.rawWrite({ id: msg.id, result })
      return
    }
    if (msg.id !== undefined) {
      const p = this.pending.get(msg.id)
      if (p) {
        this.pending.delete(msg.id)
        this.tapOf(p.sid)?.('in', msg.error ? { id: msg.id, method: p.method, error: msg.error } : { id: msg.id, method: p.method, result: msg.result })
        if (msg.error) p.reject(new Error(msg.error.message || 'zcode 协议错误'))
        else p.resolve(msg.result)
      }
      return
    }
    if (msg.method === 'session/event') {
      this.tapOf(msg.params?.sessionId)?.('in', msg)
      const cbs = this.listeners.get(msg.params?.sessionId)
      if (cbs) for (const cb of [...cbs]) cb(msg.params?.payload)
    }
  }

  private rawWrite(obj: any) {
    this.proc?.stdin?.write(JSON.stringify(obj) + '\n')
  }

  request(method: string, params: any): Promise<any> {
    this.start()
    const id = this.nextId++
    const sid: string | undefined =
      params && typeof params.sessionId === 'string' ? params.sessionId : undefined
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method, sid })
      this.tapOf(sid)?.('out', { id, method, params })
      this.rawWrite({ id, method, params })
    })
  }

  async createSession(workspaceDir: string): Promise<string> {
    const result = await this.request('session/create', {
      workspace: { workspacePath: workspaceDir, workspaceKey: workspaceDir },
      // 无头会话没有人工批准环节：yolo 让写文件/建目录在沙箱内直接放行
      mode: 'yolo',
    })
    const sid = result?.session?.sessionId
    if (!sid) throw new Error('session/create 未返回 sessionId')
    await this.request('session/subscribe', {
      sessionId: sid,
      deliveryKind: 'web-remote-replayable',
    })
    return sid
  }

  send(sessionId: string, content: string): Promise<any> {
    return this.request('session/send', { sessionId, content })
  }

  stop(sessionId: string) {
    this.request('session/stop', { sessionId }).catch(() => {})
  }

  listen(sessionId: string, cb: EventCb): () => void {
    let set = this.listeners.get(sessionId)
    if (!set) {
      set = new Set()
      this.listeners.set(sessionId, set)
    }
    set.add(cb)
    return () => set!.delete(cb)
  }
}

/* ------------------------------------------------------------
   会话管理：浏览器 sessionId → zcode 会话 + 沙箱目录
   ------------------------------------------------------------ */

const bridge = new ZcodeBridge()
const sessions = new Map<
  string,
  { zcodeSessionId: string; workspaceDir: string; busy: boolean }
>()

function workspaceDirFor(clientSessionId: string): string {
  const dir = join(__dirname, 'workspace', clientSessionId)
  mkdirSync(dir, { recursive: true })
  return dir
}

function buildPrompt(skill: string, messages: any[], isFirstTurn: boolean): string {
  // 复用 zcode 会话时历史天然保留，只发最新一条；技能指令仅在新会话首条注入
  const latest = messages[messages.length - 1]
  if (!isFirstTurn) return latest.content
  if (INSTALLED_SKILLS.has(skill)) {
    return (
      `请先用 Skill 工具加载 ${skill} 技能，然后严格按该技能的方法与输出契约执行以下任务；` +
      `技能自带的方法文档、参考资料与脚本优先于你的一般经验。\n\n${latest.content}`
    )
  }
  return `${SKILL_PROMPTS[skill]}\n\n${latest.content}`
}

/* ------------------------------------------------------------
   HTTP：GET /api/health、POST /api/chat（SSE）
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
    sendJson(res, 200, {
      ok: true,
      model: 'glm-5.3 (GLM Coding Plan)',
      runner: 'zcode',
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
  let entry = existingEntry
  let unlisten: () => void = () => {}
  let untap: () => void = () => {}
  let cleaned = false
  let clientGone = false
  let timeout: ReturnType<typeof setTimeout>

  /* ---- trace 记录：实时流 + 终态导出 + 索引（见 lib/traceExport.ts） ---- */
  const runId = newRunId()
  const startedAt = Date.now()
  const promptDigest = String(latest.content).replace(/\s+/g, ' ').slice(0, 80)
  const recorder = new RunRecorder(runId, { clientSessionId, skill, promptDigest })
  let lastUsage: UsageSummary | undefined
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
      zcodeSessionId: entry?.zcodeSessionId,
      skill,
      promptDigest,
      outcome,
      durationMs,
      usage: lastUsage,
      files: { events: recorder.file },
    }
    void (async () => {
      try {
        if (entry?.zcodeSessionId) {
          const traceFile = traceFilePath(runId, 'trace')
          const result = await exportSessionTrace(entry.zcodeSessionId, traceFile)
          if (result) {
            record.toolCallCount = result.toolCallCount
            record.files.trace = traceFile
          }
        }
      } catch (exc: any) {
        recorder.note({ traceExportError: exc?.message ?? String(exc) })
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
    if (entry) bridge.stop(entry.zcodeSessionId)
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
      bridge.stop(entry.zcodeSessionId)
      finalizeRun('aborted')
      cleanup()
    }
    clearInterval(heartbeat)
  })

  try {
    if (!entry) {
      const dir = workspaceDirFor(clientSessionId)
      const zcodeSessionId = await bridge.createSession(dir)
      entry = { zcodeSessionId, workspaceDir: dir, busy: false }
      sessions.set(clientSessionId, entry)
      recorder.note({ created: zcodeSessionId, workspaceDir: dir })
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
    untap = bridge.tapSession(entry.zcodeSessionId, (dir, msg) => recorder.proto(dir, msg))

    /* 创建期间客户端已断开：停止 turn，不再空跑 */
    if (clientGone) {
      bridge.stop(entry.zcodeSessionId)
      finalizeRun('aborted')
      cleanup()
      finish()
      return
    }

    // 事件 → SSE（只透出文本流/用量/收尾，MVP 不展示工具细节）
    // 注意：session/event 的 payload 多数没有 kind 字段，按字段特征区分（见 PROTOCOL.md）
    unlisten = bridge.listen(entry.zcodeSessionId, (payload) => {
      if (payload?.kind === 'text_delta') {
        if (payload.delta) sse({ type: 'text', delta: payload.delta })
      } else if (payload?.response !== undefined && payload.resultType !== undefined) {
        // 终止事件：{response, resultType, tokenCount, usage, ...}
        lastUsage = payload.usage ?? lastUsage
        sse({ type: 'usage', usage: payload.usage })
        sse({ type: 'done', content: String(payload.response ?? ''), resultType: payload.resultType })
        finalizeRun(clientGone ? 'aborted' : 'success')
        cleanup()
        finish()
      } else if (payload?.usage && payload.stopReason !== undefined) {
        lastUsage = payload.usage
        sse({ type: 'usage', usage: payload.usage, content: payload.content })
      }
    })

    await bridge.send(entry.zcodeSessionId, buildPrompt(skill, messages, !existingEntry))
  } catch (exc: any) {
    sse({ type: 'error', message: exc.message || '执行失败，请稍后重试。' })
    finalizeRun('error')
    cleanup()
    finish()
  }
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`SKILL 广场 Node 后端：http://127.0.0.1:${PORT}/`)
  console.log(
    `zcode CLI：${CLI.path}（${CLI.source}${CLI.mode === 'node' ? '，以 node 运行' : ''}）`
  )
  if (!existsSync(CLI.path))
    console.warn('警告：该路径不存在，请在 web/.env 配置 ZCODE_CLI 后重试。')
  console.log('模型经 ~/.zcode/cli/config.json 解析（当前为 GLM Coding Plan）。')
  console.log(`trace 记录：${TRACES_DIR}`)
})
