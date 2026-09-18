/* ============================================================
   运行 Trace 记录与导出
   ------------------------------------------------------------
   三层：实时事件流（RunRecorder，逐行落盘）/ 权威导出
   （zcode SQLite → trace.json）/ 运行索引（index.jsonl）。
   目录：web/server/traces/（TRACES_DIR 环境变量可覆盖）。
   评测只依赖 index.jsonl 与 <runId>.json，schema 保持稳定。
   ============================================================ */

import { appendFileSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const TRACES_DIR = process.env.TRACES_DIR || join(__dirname, '..', 'traces')
const ZCODE_DB = process.env.ZCODE_DB || join(homedir(), '.zcode', 'cli', 'db', 'db.sqlite')

export interface UsageSummary {
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  totalTokens?: number
}

export type RunOutcome = 'success' | 'timeout' | 'error' | 'aborted' | 'historical'

export interface RunRecord {
  /** 索引与文件名共用的运行标识：YYYYMMDD-HHMMSS-xxxx */
  runId: string
  ts: string
  clientSessionId: string
  /** 执行引擎（zcode / pi）；历史记录缺省视为 zcode */
  engine?: 'zcode' | 'pi'
  engineSessionId?: string
  skill: string
  promptDigest: string
  outcome: RunOutcome
  durationMs: number
  usage?: UsageSummary
  toolCallCount?: number
  files: { events?: string; trace?: string }
}

export function newRunId(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const rand = Math.random().toString(36).slice(2, 6)
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${rand}`
}

export function appendIndex(rec: RunRecord): void {
  mkdirSync(TRACES_DIR, { recursive: true })
  appendFileSync(join(TRACES_DIR, 'index.jsonl'), JSON.stringify(rec) + '\n')
}

export function readIndex(): RunRecord[] {
  try {
    return readFileSync(join(TRACES_DIR, 'index.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as RunRecord)
  } catch {
    return []
  }
}

export function traceFilePath(runId: string, kind: 'events' | 'trace'): string {
  return join(TRACES_DIR, kind === 'events' ? `${runId}.events.jsonl` : `${runId}.json`)
}

/* ------------------------------------------------------------
   实时记录器：appendFileSync 逐行落盘，崩溃不丢已写内容
   ------------------------------------------------------------ */

export class RunRecorder {
  readonly file: string
  private closed = false

  constructor(runId: string, meta: Record<string, unknown>) {
    mkdirSync(TRACES_DIR, { recursive: true })
    this.file = traceFilePath(runId, 'events')
    this.line({ t: now(), kind: 'runStart', ...meta })
  }

  /** 协议交互（带 sessionId 的请求/响应/通知） */
  proto(dir: 'out' | 'in', msg: unknown): void {
    this.line({ t: now(), kind: 'proto', dir, msg })
  }

  /** 补记无法归属到协议方向的说明行 */
  note(msg: Record<string, unknown>): void {
    this.line({ t: now(), kind: 'note', ...msg })
  }

  end(outcome: RunOutcome, extra: Record<string, unknown> = {}): void {
    if (this.closed) return
    this.closed = true
    this.line({ t: now(), kind: 'runEnd', outcome, ...extra })
  }

  private line(obj: Record<string, unknown>): void {
    try {
      appendFileSync(this.file, JSON.stringify(obj) + '\n')
    } catch {
      /* 记录失败不影响主流程 */
    }
  }
}

function now(): string {
  return new Date().toISOString()
}

/* ------------------------------------------------------------
   权威导出：zcode SQLite（message/part/tool_usage）→ trace.json
   schema 与既有导出一致：session / summary / messages
   ------------------------------------------------------------ */

export interface SessionTrace {
  session: {
    id: string
    title: string
    workspace: string
    created: string
    updated: string
    trace_id?: string
  }
  summary: {
    messages: number
    toolCalls: Array<{ tool: string; status: string; read_only: boolean; started: string }>
  }
  messages: Array<{ seq: number | null; time: string; role?: string; parts: unknown[] }>
}

type Row = Record<string, unknown>

/** 只读打开 zcode 会话库；node:sqlite 优先，失败回落 python3 脚本 */
export async function exportSessionTrace(
  zcodeSessionId: string,
  outFile: string,
): Promise<{ toolCallCount: number } | null> {
  const trace = await readSessionFromDb(zcodeSessionId)
  if (!trace) return null
  writeFileSync(outFile, JSON.stringify(trace, null, 1))
  return { toolCallCount: trace.summary.toolCalls.length }
}

/** 列出属于本项目沙箱的全部会话（backfill 用） */
export async function listWorkspaceSessions(): Promise<
  Array<{ id: string; title: string; directory: string; time_created: number; time_updated: number }>
> {
  const { DatabaseSync } = (await import('node:sqlite')) as any
  const db = new DatabaseSync(ZCODE_DB, { readOnly: true })
  try {
    return db
      .prepare(
        `SELECT id, title, directory, time_created, time_updated FROM session
         WHERE directory LIKE ? ORDER BY time_created`,
      )
      .all(`%${join('web', 'server', 'workspace')}%`) as any
  } finally {
    db.close()
  }
}

async function readSessionFromDb(sid: string): Promise<SessionTrace | null> {
  try {
    const { DatabaseSync } = (await import('node:sqlite')) as any
    const db = new DatabaseSync(ZCODE_DB, { readOnly: true })
    try {
      return querySession((sql: string, ...args: unknown[]) =>
        db.prepare(sql).all(...args),
      )
    } finally {
      db.close()
    }
  } catch {
    return readSessionViaPython(sid)
  }
}

function querySession(
  all: (sql: string, ...args: unknown[]) => Row[],
): SessionTrace | null {
  const meta = all(
    'SELECT id, title, directory, time_created, time_updated, trace_id FROM session WHERE id = ?',
    sid,
  )[0]
  if (!meta) return null
  const messages = all(
    'SELECT id, sequence, time_created, data FROM message WHERE session_id = ? ORDER BY sequence, time_created',
    sid,
  )
  const parts = all(
    'SELECT p.message_id, p.sequence, p.data FROM part p WHERE p.session_id = ? ORDER BY p.message_id, p.sequence',
    sid,
  )
  const tools = all(
    'SELECT tool_name, status, read_only, started_at FROM tool_usage WHERE session_id = ? ORDER BY started_at',
    sid,
  )

  const byMsg = new Map<string, unknown[]>()
  for (const p of parts) {
    const list = byMsg.get(String(p.message_id)) ?? []
    list.push(JSON.parse(String(p.data)))
    byMsg.set(String(p.message_id), list)
  }

  return {
    session: {
      id: String(meta.id),
      title: String(meta.title),
      workspace: String(meta.directory),
      created: new Date(Number(meta.time_created)).toISOString(),
      updated: new Date(Number(meta.time_updated)).toISOString(),
      trace_id: meta.trace_id ? String(meta.trace_id) : undefined,
    },
    summary: {
      messages: messages.length,
      toolCalls: tools.map((t) => ({
        tool: String(t.tool_name),
        status: String(t.status),
        read_only: Boolean(t.read_only),
        started: new Date(Number(t.started_at)).toISOString(),
      })),
    },
    messages: messages.map((m) => {
      const data = JSON.parse(String(m.data))
      return {
        seq: (m.sequence as number | null) ?? null,
        time: new Date(Number(m.time_created)).toISOString(),
        role: data?.role,
        parts: byMsg.get(String(m.id)) ?? [],
      }
    }),
  }
}

function readSessionViaPython(sid: string): SessionTrace | null {
  const script = join(__dirname, '..', 'scripts', 'sqlite_dump.py')
  try {
    const r = spawnSync('python3', [script, ZCODE_DB, sid], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
    if (r.status !== 0 || !r.stdout.trim()) return null
    return JSON.parse(r.stdout) as SessionTrace
  } catch {
    return null
  }
}
