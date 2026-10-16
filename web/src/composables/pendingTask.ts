/* ============================================================
   表单任务交接（在线运行表单页 → 在线对话页）
   ------------------------------------------------------------
   表单页提交时不本地运行，而是把构建好的任务（提示词、标题、
   附件与上传沙箱会话）经 sessionStorage 一次性交给在线对话页，
   由它挂载技能并发起 SSE 运行。取走即删：刷新不重发。
   ============================================================ */

export interface PendingFormTask {
  slug: string
  prompt: string
  taskTitle?: string
  /** 已上传到会话沙箱的附件（/api/upload 返回的相对路径） */
  attachments?: Array<{ name: string; path: string }>
  /** 上传产生的后端会话 id：在线对话沿用同一沙箱，附件才可读 */
  sessionId?: string
}

const KEY = 'skill-plaza:pending-form-task'

export function stashPendingFormTask(task: PendingFormTask): void {
  try { sessionStorage.setItem(KEY, JSON.stringify(task)) } catch { /* 忽略 */ }
}

export function takePendingFormTask(): PendingFormTask | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    return JSON.parse(raw) as PendingFormTask
  } catch {
    return null
  }
}
