/*
 * Career-guidance HTML report checks.
 *
 * The report is intentionally kept as agent-authored HTML/SVG.  This module
 * validates the persisted file contract and records structural problems so a
 * missing chart cannot disappear silently from the developer-side run record.
 */

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

export type HeatmapReportStatus = 'present' | 'unassessed' | 'omitted'

export interface HtmlReportFigure {
  chartSkill?: string
  chartId?: string
  chartStatus?: string
}

export interface HtmlReportValidation {
  /** Structural validity of figure markers that are present in the document. */
  pass: boolean
  errors: string[]
  warnings: string[]
  figures: HtmlReportFigure[]
  heatmap: {
    status: HeatmapReportStatus
    figureCount: number
    failureReason?: string
  }
}

const MAX_ERRORS = 20
const MAX_WARNINGS = 20
export const MAX_HTML_REPORT_BYTES = 8 * 1024 * 1024

export type WorkspaceHtmlReport =
  | { found: true; html: string }
  | { found: false; error?: string }

/**
 * Read only the server-owned report.html at the root of a session workspace.
 * The agent never supplies a path: symlinks and non-regular files are rejected
 * so a report cannot escape the workspace sandbox.
 */
export function readWorkspaceHtmlReport(workspaceDir: string): WorkspaceHtmlReport {
  let workspaceRoot: string
  try {
    workspaceRoot = realpathSync(resolve(workspaceDir))
  } catch {
    return { found: false }
  }

  const candidate = join(workspaceRoot, 'report.html')
  if (!existsSync(candidate)) return { found: false }

  try {
    const realCandidate = realpathSync(candidate)
    if (realCandidate !== candidate) {
      return { found: false, error: '拒绝读取工作区之外的 report.html 路径' }
    }
    const stat = statSync(realCandidate)
    if (!stat.isFile()) return { found: false, error: 'workspace/report.html 不是普通文件' }
    if (!Number.isFinite(stat.size) || stat.size <= 0 || stat.size > MAX_HTML_REPORT_BYTES) {
      return { found: false, error: `workspace/report.html 超过 ${MAX_HTML_REPORT_BYTES} 字节上限或为空` }
    }
    return { found: true, html: readFileSync(realCandidate, 'utf8') }
  } catch (exc: any) {
    return { found: false, error: exc?.message ?? String(exc) }
  }
}

/**
 * Compatibility path for older agents that returned HTML in the terminal
 * response instead of writing workspace/report.html. Plain short status text
 * deliberately returns null and must never become a fake report.
 */
export function normalizeLegacyHtmlDocument(text: string): string | null {
  const trimmed = String(text ?? '')
    .trim()
    .replace(/^```html\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  if (!trimmed) return null

  const looksLikeHtml = /<!doctype\s+html\b|<html\b|<body\b|<figure\b|<svg\b|<h[1-6]\b|data-chart-skill\s*=/i.test(trimmed)
  if (!looksLikeHtml) return null

  if (/<html\b/i.test(trimmed)) {
    if (!/<\/html\s*>/i.test(trimmed)) return null
    return /^<!doctype\s+html\b/i.test(trimmed) ? trimmed : `<!doctype html>\n${trimmed}`
  }

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${trimmed}</body></html>`
}

function attribute(attrs: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`\\b${escaped}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(attrs)
  return match?.[2]?.trim() || undefined
}

function textContent(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&(?:amp|lt|gt|quot|#39);/gi, (entity) => {
      const decoded: Record<string, string> = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
      }
      return decoded[entity.toLowerCase()] ?? entity
    })
    .replace(/\s+/g, ' ')
    .trim()
}

function failureReason(html: string): string | undefined {
  /* Keep the text after the status heading/line and stop at the next section. */
  const marker = /热点图\s*(?:[:：]\s*)?未评估/i.exec(html)
  if (!marker || marker.index === undefined) return undefined

  /* Prefer the containing paragraph/list item/caption so unrelated later
     report sections are not mistaken for the query failure reason. */
  const before = html.slice(0, marker.index)
  let block: { tag: string; index: number } | undefined
  const blockRe = /<(li|p|figcaption)\b[^>]*>/gi
  for (const match of before.matchAll(blockRe)) {
    if (match.index !== undefined) block = { tag: match[1].toLowerCase(), index: match.index + match[0].length }
  }
  if (block) {
    const close = new RegExp(`</${block.tag}\\s*>`, 'i').exec(html.slice(marker.index))
    if (close?.index !== undefined) {
      const scoped = textContent(html.slice(marker.index + marker[0].length, marker.index + close.index))
      const reason = scoped.replace(/^[：:。；;、,，\s]+/, '').replace(/[\s。；;]+$/, '').trim()
      if (reason) return reason
    }
  }

  let rest = html.slice(marker.index + marker[0].length)
  const stop = rest.search(/<h[1-6]\b|<section\b|<figure\b/i)
  if (stop >= 0) rest = rest.slice(0, stop)
  const reason = textContent(rest)
    .replace(/^[：:。；;、,，\s]+/, '')
    .replace(/[\s。；;]+$/, '')
    .trim()
  return reason || undefined
}

/**
 * Inspect the figure contract of a career-guidance HTML report.
 *
 * `omitted` is deliberately a non-error: overseas and unknown locations may
 * legitimately omit the China-only heatmap.  If a report says the heatmap was
 * not assessed, the status and the adjacent reason are captured.  A present
 * heatmap must use the stable CH_CITY id so downstream checks can find it.
 */
export function validateHtmlReport(html: string): HtmlReportValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const pushError = (message: string) => {
    if (errors.length < MAX_ERRORS) errors.push(message)
  }
  const pushWarning = (message: string) => {
    if (warnings.length < MAX_WARNINGS) warnings.push(message)
  }

  if (!html || !html.trim()) {
    return {
      pass: false,
      errors: ['HTML 报告为空'],
      warnings: [],
      figures: [],
      heatmap: { status: 'omitted', figureCount: 0 },
    }
  }

  const figures: HtmlReportFigure[] = []
  const heatmapBlocks: Array<{ body: string; status?: string }> = []
  const figureRe = /<figure\b([^>]*)>([\s\S]*?)<\/figure\s*>/gi
  for (const match of html.matchAll(figureRe)) {
    const attrs = match[1] ?? ''
    const body = match[2] ?? ''
    const chartSkill = attribute(attrs, 'data-chart-skill')
    const chartId = attribute(attrs, 'data-chart-id')
    const chartStatus = attribute(attrs, 'data-chart-status')
    const figure: HtmlReportFigure = { chartSkill, chartId }
    if (chartStatus) figure.chartStatus = chartStatus
    figures.push(figure)

    if (!chartSkill) pushError(`figure 缺少 data-chart-skill${chartId ? `（${chartId}）` : ''}`)
    else if (chartStatus?.toLowerCase() !== 'unassessed' && !/<svg\b/i.test(body))
      pushError(`${chartSkill} 图表缺少内联 SVG`)

    if (chartSkill?.toLowerCase() === 'heatmap-chart') {
      const normalizedStatus = chartStatus?.toLowerCase()
      heatmapBlocks.push({ body, status: normalizedStatus })
      if (chartId !== 'CH_CITY') pushError(`热点图 data-chart-id 必须为 CH_CITY（当前为 ${chartId ?? '缺失'}）`)
      if (!/<figcaption\b/i.test(body)) pushError('热点图缺少 figcaption 口径说明')
      /* A failed/unfinished query may be represented by a figure status block;
         it still needs the visible reason, but does not have SVG geometry. */
      if (normalizedStatus !== 'unassessed') {
        if (!/<svg\b/i.test(body)) pushError('热点图缺少内联 SVG')
        if (!/<title\b/i.test(body)) pushError('热点图 SVG 缺少 title')
        if (!/<desc\b/i.test(body)) pushError('热点图 SVG 缺少 desc')
      }
    }
  }

  const plain = textContent(html)
  const reason = failureReason(html)
  const hasUnassessed = /热点图\s*(?:[:：]\s*)?未评估/i.test(plain)
  const failureHint = /(?:跨城市查询|city-distribution|城市分布(?:查询|统计|结果)|热点图).{0,100}(?:失败|超时|不可用|未返回|无结果|未获得|未获取|无法)/i.test(plain)

  let status: HeatmapReportStatus = 'omitted'
  if (heatmapBlocks.some((block) => block.status === 'unassessed')) status = 'unassessed'
  else if (heatmapBlocks.length > 0) status = 'present'
  else if (hasUnassessed) status = 'unassessed'
  else pushWarning('未发现 data-chart-skill="heatmap-chart"；若中国跨城市查询已成功，报告应生成 CH_CITY 热点图')

  const hasAssessedHeatmap = heatmapBlocks.some((block) => block.status !== 'unassessed')
  if (hasAssessedHeatmap && hasUnassessed)
    pushError('报告同时包含热点图和“热点图未评估”，状态互相矛盾')
  if (failureHint && !hasUnassessed)
    pushError('跨城市查询失败时必须显示“热点图未评估”及失败原因')
  if (status === 'unassessed' && !reason)
    pushError('“热点图未评估”缺少失败原因')

  return {
    pass: errors.length === 0,
    errors,
    warnings,
    figures,
    heatmap: {
      status,
      figureCount: heatmapBlocks.length,
      failureReason: status === 'unassessed' ? reason : undefined,
    },
  }
}

/** Validate the complete document contract used for persisted report files. */
export function validateCompleteHtmlReport(html: string): HtmlReportValidation {
  const result = validateHtmlReport(html)
  const errors = [...result.errors]
  const add = (message: string) => {
    if (!errors.includes(message) && errors.length < MAX_ERRORS) errors.push(message)
  }
  if (!/^\s*<!doctype\s+html\b/i.test(html)) add('HTML 报告缺少 <!doctype html>')
  if (!/<html\b[^>]*>/i.test(html)) add('HTML 报告缺少 <html> 根元素')
  if (!/<head\b[^>]*>/i.test(html)) add('HTML 报告缺少 <head>')
  if (!/<body\b[^>]*>/i.test(html)) add('HTML 报告缺少 <body>')
  if (!/<\/html\s*>/i.test(html)) add('HTML 报告缺少 </html> 结束标签')
  return errors.length ? { ...result, pass: false, errors } : result
}
