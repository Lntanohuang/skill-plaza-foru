/* ============================================================
   运行记录数据层
   ------------------------------------------------------------
   优先请求后端 /api/runs（真实 trace）；后端不可用时回落到
   runsMock 演示数据，保证纯静态部署也能预览页面结构。
   ============================================================ */

import { RUNS_MOCK, RUN_DETAILS_MOCK, type RunListItem, type RunDetail } from '../data/runsMock'

export interface RunsResult {
  runs: RunListItem[]
  /** true = 后端真实数据；false = 演示数据兜底 */
  live: boolean
}

export async function fetchRuns(): Promise<RunsResult> {
  try {
    const res = await fetch('/api/runs?limit=200', { cache: 'no-store' })
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as { runs: RunListItem[] }
    if (!Array.isArray(data.runs) || data.runs.length === 0) throw new Error('empty')
    return { runs: data.runs, live: true }
  } catch {
    return { runs: RUNS_MOCK, live: false }
  }
}

export interface RunDetailResult {
  item?: RunListItem
  trace?: RunDetail
  live: boolean
}

export async function fetchRunDetail(runId: string): Promise<RunDetailResult> {
  try {
    const res = await fetch(`/api/runs/${encodeURIComponent(runId)}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as { item: RunListItem; trace?: RunDetail }
    if (!data.item) throw new Error('no item')
    return { item: data.item, trace: data.trace ?? undefined, live: true }
  } catch {
    return {
      item: RUNS_MOCK.find(r => r.runId === runId),
      trace: RUN_DETAILS_MOCK[runId],
      live: false,
    }
  }
}

/** 原始文件下载地址（仅真实数据可用） */
export function runFileUrl(runId: string, kind: 'events' | 'trace' | 'md'): string {
  return `/api/runs/${encodeURIComponent(runId)}/file/${kind}`
}
