/* ============================================================
   模型对话接入（Node 后端 → ZCode app-server）
   ------------------------------------------------------------
   浏览器只访问本机 /api/*：后端持有 ZCode CLI 与模型配置，不进前端。
   /api/chat 为 SSE 流式：text 增量 → usage 用量 → done 收尾。
   未启动本地服务时，工作台会提示如何启动，不影响表单预览。
   ============================================================ */

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export type ApiState = 'checking' | 'ready' | 'offline' | 'nokey'
export type EngineId = 'zcode' | 'pi'
import type { ReportChart } from '../data/runsMock'

export interface EngineInfo {
  id: EngineId
  available: boolean
  model?: string
  reason?: string
}

export interface HealthResult {
  ok: boolean
  model?: string
  runner?: EngineId
  /** 可用引擎清单（默认引擎 = runner）；不可用项带 reason */
  engines?: EngineInfo[]
  /** 未就绪时的原因：nokey = 服务在但没读到密钥；offline = 服务没启动 */
  reason?: 'nokey' | 'offline'
  message?: string
}

/* SSE 事件（与 server/index.ts 的输出一一对应） */
export type ChatEvent =
  | { type: 'session'; sessionId: string }
  | { type: 'status'; phase: 'thinking' | 'tool' | 'text'; chars?: number; tool?: string }
  | { type: 'text'; delta: string }
  | { type: 'usage'; usage: Record<string, number | string> }
  | { type: 'done'; content: string; resultType?: string; charts?: ReportChart[] }
  | { type: 'error'; message: string }

export async function checkHealth(): Promise<HealthResult> {
  try {
    const response = await fetch('/api/health', { cache: 'no-store' })
    const data = (await response.json()) as HealthResult
    if (!response.ok || !data.ok) {
      const message = data.message || 'API 未配置'
      return { ok: false, reason: message.includes('密钥') ? 'nokey' : 'offline', message }
    }
    return { ok: true, model: data.model, runner: data.runner, engines: data.engines }
  } catch {
    return { ok: false, reason: 'offline', message: '需要启动本地服务' }
  }
}

export interface ChatAttachment {
  /** 展示名（原始文件名） */
  name: string
  /** 相对会话沙箱目录的路径（由 /api/upload 返回，如 uploads/resume.pdf） */
  path: string
}

export interface StreamChatOptions {
  skill: string
  messages: ChatMessage[]
  /** 复用会话（多轮）；缺省由后端新建并通过 session 事件返回 */
  sessionId?: string
  /** 执行引擎；缺省用后端默认引擎（AGENT_RUNNER） */
  engine?: EngineId
  /** 本次消息随带的附件（已上传到会话沙箱） */
  attachments?: ChatAttachment[]
  onEvent: (event: ChatEvent) => void
  signal?: AbortSignal
}

/** 流式对话：消费 /api/chat 的 SSE，逐事件回调。 */
export async function streamChat(options: StreamChatOptions): Promise<void> {
  const { skill, messages, sessionId, engine, attachments, onEvent, signal } = options
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skill, messages, sessionId, engine, attachments }),
    signal,
  })
  if (!response.ok || !response.body) {
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || '请求失败，请稍后重试。')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue
        try {
          onEvent(JSON.parse(line.slice(6)) as ChatEvent)
        } catch {
          /* 跳过无法解析的行 */
        }
      }
    }
  }
}

/** 非流式调用（兼容旧用法）：聚齐流式事件后一次性返回。 */
export async function sendChat(skill: string, messages: ChatMessage[]): Promise<string> {
  let text = ''
  let lastError: string | null = null
  await streamChat({
    skill,
    messages,
    onEvent: event => {
      if (event.type === 'text') text += event.delta
      else if (event.type === 'done') text = event.content || text
      else if (event.type === 'error') lastError = event.message
    },
  })
  if (lastError && !text) throw new Error(lastError)
  if (!text) throw new Error('模型接口返回了无法识别的数据。')
  return text
}
