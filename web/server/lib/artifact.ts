import { existsSync, lstatSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

export const ARTIFACT_FILENAME = 'report.artifact.json'
export const ARTIFACT_SCHEMA = 'artifact/1' as const
export const MAX_ARTIFACT_BYTES = 1_000_000

export type ArtifactStatus = 'complete' | 'partial' | 'failed'
export type ArtifactOutputStatus = 'complete' | 'partial' | 'failed' | 'unavailable'
export type ArtifactOutputType = 'text' | 'html' | 'markdown' | 'pdf' | 'docx' | 'doc' | 'json' | 'image' | 'zip'
export type ArtifactAudience = 'user' | 'system' | 'developer'
export type ClaimKind = 'fact' | 'inference' | 'recommendation'

export interface ArtifactOutput {
  id: string
  type: ArtifactOutputType
  audience: ArtifactAudience
  required?: boolean
  status: ArtifactOutputStatus
  path?: string
  error?: string
}

export interface ArtifactSource {
  id: string
  title: string
  kind?: string
  locator?: string
  uri?: string
  snapshotDate?: string
  publishedDate?: string
  scope?: string
}

export interface ArtifactMetric {
  id: string
  label: string
  value: number | string
  unit?: string
  period?: string
  region?: string
  population?: string
  definition?: string
  sourceIds: string[]
}

export interface ArtifactClaim {
  id: string
  kind: ClaimKind
  text?: string
  sourceIds?: string[]
  metricIds?: string[]
  evidenceIds?: string[]
  sectionId?: string
  limitation?: string
}

export interface ArtifactEvidence {
  id: string
  sourceIds?: string[]
  claimId?: string
  requirement?: string
  support?: string
  status?: 'matched' | 'partial' | 'gap' | 'unknown'
  sectionId?: string
}

export interface ArtifactGap {
  id: string
  description: string
  impact?: string
  status?: 'pending' | 'unverified' | 'resolved'
  verification?: string
}

export interface ArtifactDocument {
  schema: typeof ARTIFACT_SCHEMA
  kind: 'report'
  status: ArtifactStatus
  title: string
  producer?: { skill?: string; runId?: string; engine?: string }
  outputs: ArtifactOutput[]
  sources: ArtifactSource[]
  metrics: ArtifactMetric[]
  claims: ArtifactClaim[]
  evidence: ArtifactEvidence[]
  gaps: ArtifactGap[]
}

export interface ArtifactValidation {
  pass: boolean
  errors: string[]
  counts: {
    outputs: number
    sources: number
    metrics: number
    claims: number
    evidence: number
    gaps: number
  }
  status?: ArtifactStatus
  title?: string
}

export interface WorkspaceArtifact {
  document: ArtifactDocument | null
  raw: string | null
  error?: string
}

const OUTPUT_TYPES = new Set<ArtifactOutputType>([
  'text', 'html', 'markdown', 'pdf', 'docx', 'doc', 'json', 'image', 'zip',
])
const OUTPUT_STATUSES = new Set<ArtifactOutputStatus>(['complete', 'partial', 'failed', 'unavailable'])
const AUDIENCES = new Set<ArtifactAudience>(['user', 'system', 'developer'])
const CLAIM_KINDS = new Set<ClaimKind>(['fact', 'inference', 'recommendation'])
const MAX_ERRORS = 30

const arrayOf = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : []
const stringValue = (value: unknown): string => typeof value === 'string' ? value.trim() : ''

function add(errors: string[], message: string): void {
  if (errors.length < MAX_ERRORS) errors.push(message)
}

function uniqueIds<T extends { id?: unknown }>(items: T[], label: string, errors: string[]): Set<string> {
  const ids = new Set<string>()
  items.forEach((item, index) => {
    const id = stringValue(item?.id)
    if (!id) add(errors, `${label}[${index}] 缺少 id`)
    else if (ids.has(id)) add(errors, `${label} id 重复：${id}`)
    else ids.add(id)
  })
  return ids
}

function resolveIds(ids: unknown, known: Set<string>, owner: string, errors: string[], required = false): void {
  const values = Array.isArray(ids) ? ids : []
  if (required && values.length === 0) add(errors, `${owner} 缺少引用 id`)
  values.forEach((id) => {
    if (!known.has(String(id))) add(errors, `${owner} 引用了不存在的 id：${id}`)
  })
}

function validWorkspacePath(path: unknown): boolean {
  if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('://')) return false
  const normalized = path.replaceAll('\\', '/')
  return !normalized.split('/').includes('..') && relative('.', normalized) !== '..'
}

export function validateArtifact(input: unknown): ArtifactValidation {
  const errors: string[] = []
  const obj = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : null
  if (!obj) return { pass: false, errors: ['Artifact 必须是 JSON 对象'], counts: { outputs: 0, sources: 0, metrics: 0, claims: 0, evidence: 0, gaps: 0 } }

  if (obj.schema !== ARTIFACT_SCHEMA) add(errors, `不支持的 Artifact schema：${String(obj.schema ?? '')}`)
  if (obj.kind !== 'report') add(errors, 'Artifact kind 必须为 report')
  if (!['complete', 'partial', 'failed'].includes(String(obj.status))) add(errors, 'Artifact status 必须为 complete、partial 或 failed')
  if (!stringValue(obj.title)) add(errors, 'Artifact 缺少 title')

  const outputs = arrayOf<ArtifactOutput>(obj.outputs)
  const sources = arrayOf<ArtifactSource>(obj.sources)
  const metrics = arrayOf<ArtifactMetric>(obj.metrics)
  const claims = arrayOf<ArtifactClaim>(obj.claims)
  const evidence = arrayOf<ArtifactEvidence>(obj.evidence)
  const gaps = arrayOf<ArtifactGap>(obj.gaps)
  if (!outputs.length) add(errors, 'Artifact 至少需要一个 outputs 条目')

  uniqueIds(outputs, 'outputs', errors)
  const sourceIds = uniqueIds(sources, 'sources', errors)
  const metricIds = uniqueIds(metrics, 'metrics', errors)
  const claimIds = uniqueIds(claims, 'claims', errors)
  const evidenceIds = uniqueIds(evidence, 'evidence', errors)
  uniqueIds(gaps, 'gaps', errors)

  outputs.forEach((item, index) => {
    const owner = `outputs[${index}]`
    if (!OUTPUT_TYPES.has(item?.type)) add(errors, `${owner} type 不受支持：${String(item?.type ?? '')}`)
    if (!AUDIENCES.has(item?.audience)) add(errors, `${owner} audience 不受支持：${String(item?.audience ?? '')}`)
    if (!OUTPUT_STATUSES.has(item?.status)) add(errors, `${owner} status 不受支持：${String(item?.status ?? '')}`)
    if (item?.path !== undefined && !validWorkspacePath(item.path)) add(errors, `${owner} path 必须是 workspace 内相对路径`)
  })
  sources.forEach((item, index) => {
    if (!stringValue(item?.title)) add(errors, `sources[${index}] 缺少 title`)
  })
  metrics.forEach((item, index) => {
    const owner = `metrics[${index}]`
    if (!stringValue(item?.label)) add(errors, `${owner} 缺少 label`)
    if (typeof item?.value !== 'number' && typeof item?.value !== 'string') add(errors, `${owner} value 必须是数字或字符串`)
    resolveIds(item?.sourceIds, sourceIds, owner, errors, true)
  })
  claims.forEach((item, index) => {
    const owner = `claims[${index}]`
    if (!CLAIM_KINDS.has(item?.kind)) add(errors, `${owner} kind 不受支持：${String(item?.kind ?? '')}`)
    if (!item?.sourceIds?.length && !item?.metricIds?.length && !item?.evidenceIds?.length) add(errors, `${owner} 缺少来源、指标或证据引用`)
    resolveIds(item?.sourceIds, sourceIds, owner, errors)
    resolveIds(item?.metricIds, metricIds, owner, errors)
    resolveIds(item?.evidenceIds, evidenceIds, owner, errors)
  })
  evidence.forEach((item, index) => {
    const owner = `evidence[${index}]`
    if (!item?.claimId && !item?.requirement) add(errors, `${owner} 需要 claimId 或 requirement`)
    if (item?.claimId && !claimIds.has(item.claimId)) add(errors, `${owner} 引用了不存在的 claim：${item.claimId}`)
    resolveIds(item?.sourceIds, sourceIds, owner, errors)
    if (item?.status && !['matched', 'partial', 'gap', 'unknown'].includes(item.status)) add(errors, `${owner} status 不受支持`)
  })
  gaps.forEach((item, index) => {
    if (!stringValue(item?.description)) add(errors, `gaps[${index}] 缺少 description`)
    if (item?.status && !['pending', 'unverified', 'resolved'].includes(item.status)) add(errors, `gaps[${index}] status 不受支持`)
  })

  const requiredIncomplete = outputs.some((item) => item.required === true && item.status !== 'complete')
  if (obj.status === 'complete' && requiredIncomplete) add(errors, 'Artifact status 为 complete，但有必需产物未 complete')

  return {
    pass: errors.length === 0,
    errors,
    counts: { outputs: outputs.length, sources: sources.length, metrics: metrics.length, claims: claims.length, evidence: evidence.length, gaps: gaps.length },
    status: obj.status as ArtifactStatus,
    title: stringValue(obj.title) || undefined,
  }
}

export function parseArtifact(text: string): { document: ArtifactDocument | null; error?: string } {
  try {
    const parsed = JSON.parse(text) as ArtifactDocument
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { document: null, error: 'Artifact JSON 不是对象' }
    return { document: parsed, error: undefined }
  } catch (error: any) {
    return { document: null, error: `Artifact JSON 解析失败：${error?.message ?? String(error)}` }
  }
}

export function readWorkspaceArtifact(workspaceDir: string): WorkspaceArtifact {
  const path = join(workspaceDir, ARTIFACT_FILENAME)
  try {
    if (!existsSync(path)) return { document: null, raw: null }
    if (lstatSync(path).isSymbolicLink()) return { document: null, raw: null, error: 'Artifact 文件不能是符号链接' }
    const raw = readFileSync(path, 'utf8')
    if (Buffer.byteLength(raw, 'utf8') > MAX_ARTIFACT_BYTES) return { document: null, raw: null, error: `Artifact 超过 ${MAX_ARTIFACT_BYTES} 字节上限` }
    const parsed = parseArtifact(raw)
    return { document: parsed.document, raw, error: parsed.error }
  } catch (error: any) {
    return { document: null, raw: null, error: error?.message ?? String(error) }
  }
}
