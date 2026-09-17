/* ============================================================
   模型对话接入（本地代理）
   ------------------------------------------------------------
   浏览器只访问本机 /api/*，密钥由 Python 服务读取，不进前端。
   未启动本地服务时，工作台会提示如何启动，不影响表单预览。
   ============================================================ */

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export type ApiState = 'checking' | 'ready' | 'offline' | 'nokey'

export interface HealthResult {
  ok: boolean
  model?: string
  /** 未就绪时的原因：nokey = 服务在但没读到密钥；offline = 服务没启动 */
  reason?: 'nokey' | 'offline'
  message?: string
}

export async function checkHealth(): Promise<HealthResult> {
  try {
    const response = await fetch('/api/health', { cache: 'no-store' })
    const data = (await response.json()) as HealthResult
    if (!response.ok || !data.ok) {
      const message = data.message || 'API 未配置'
      return { ok: false, reason: message.includes('密钥') ? 'nokey' : 'offline', message }
    }
    return { ok: true, model: data.model }
  } catch {
    return { ok: false, reason: 'offline', message: '需要启动本地服务' }
  }
}

export async function sendChat(skill: string, messages: ChatMessage[]): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skill, messages }),
  })
  const data = (await response.json().catch(() => ({}))) as { content?: string; error?: string }
  if (!response.ok) throw new Error(data.error || '请求失败，请稍后重试。')
  if (!data.content) throw new Error('模型接口返回了无法识别的数据。')
  return data.content
}
