/* ============================================================
   report-meta 侧车：报告双轨输出（校验字段与用户内容分离）
   ------------------------------------------------------------
   设计记录：.agents/skills/plaza-dev-notes/references/
   001-report-meta-sidecar.md（schema、取舍、图表路线）。
   模型在报告 Markdown 最后附 ```json:report-meta 围栏块；
   本模块负责提取剥离（extractSidecar）、引用完整性校验
   （validateMeta）、提示词注入（sidecarInstruction）。
   引擎/技能无关；接入开关在 skills.ts 的 SIDECAR_SKILLS。
   ============================================================ */

/** 围栏信息串（流式隐藏与提取都按此识别，区别于普通 ```json 块） */
export const SIDECAR_MARKER = '```json:report-meta'

export interface MetaSource {
  id: string
  title: string
  /** 快照/文档日期（内置文档快照必注） */
  snapshotDate?: string
  /** 定位（章节号、表名等） */
  locator?: string
}

/** 正文每个关键数字一条；sourceIds 必填且须能解析到 sources */
export interface MetaMetric {
  id: string
  name: string
  value: number | string
  unit?: string
  period?: string
  region?: string
  sourceIds: string[]
}

/** 结论条目；kind 对应正文 [事实]/[推断]/[建议] 分级 */
export interface MetaClaim {
  id: string
  kind: 'fact' | 'inference' | 'recommendation'
  sourceIds?: string[]
  sectionId?: string
}

/** 开发侧依据链；只落在侧车，不展示在用户正文。 */
export interface MetaEvidence {
  id: string
  claim?: string
  requirement?: string
  support?: string
  status?: 'matched' | 'partial' | 'gap' | 'unknown'
  sourceIds?: string[]
  sectionId?: string
}

/** 机器可渲染的图表描述；只允许数据和声明，不允许 HTML/JS。 */
export interface MetaChart {
  id: string
  type: 'bar' | 'stackedBar' | 'histogram' | 'line' | 'map'
  title: string
  sectionId?: string
  xAxis?: { name?: string; unit?: string }
  yAxis?: { name?: string; unit?: string }
  unit?: string
  data: Array<Record<string, unknown>>
  sourceIds: string[]
  snapshotDate?: string
  region?: string
  caveat?: string
  altText?: string
  insight?: string
}

export interface ReportMeta {
  schema: 'report-meta/1' | 'report-meta/2'
  skill: string
  sources: MetaSource[]
  metrics: MetaMetric[]
  claims: MetaClaim[]
  /** 岗位要求/用户材料与结论的对应关系，供开发人员优化。 */
  evidence: MetaEvidence[]
  /** 可选图表规格；由前端渲染，模型不得输出 HTML/JS。 */
  charts: MetaChart[]
}

export interface SidecarExtract {
  /** 解析成功且形状为对象才有；块缺失/JSON 损坏均为 null */
  meta: ReportMeta | null
  /** 剥离侧车块后的正文（块存在但损坏时同样剥离） */
  cleanText: string
  /** 块存在但解析失败/形状不对时的原因 */
  error?: string
}

export interface MetaValidation {
  pass: boolean
  errors: string[]
  counts: {
    sources: number
    metrics: number
    facts: number
    inferences: number
    recommendations: number
    charts: number
  }
}

export const EMPTY_META_COUNTS: MetaValidation['counts'] = {
  sources: 0,
  metrics: 0,
  facts: 0,
  inferences: 0,
  recommendations: 0,
  charts: 0,
}

/** 取最后一个侧车围栏块：提取 JSON 并从正文剥离。
    无块 → 原文直通；块损坏 → 照样剥离（用户不该看到坏 JSON），记 error。 */
export function extractSidecar(text: string): SidecarExtract {
  const start = text.lastIndexOf(SIDECAR_MARKER)
  if (start < 0) return { meta: null, cleanText: text }

  const bodyStart = text.indexOf('\n', start)
  const close = bodyStart < 0 ? -1 : text.indexOf('```', bodyStart + 1)
  const end = close < 0 ? text.length : close + 3
  const cleanText = (text.slice(0, start) + (close < 0 ? '' : text.slice(end))).trimEnd()

  if (bodyStart < 0 || close < 0)
    return { meta: null, cleanText, error: '侧车围栏未闭合' }

  try {
    const parsed = JSON.parse(text.slice(bodyStart + 1, close))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return { meta: null, cleanText, error: '侧车 JSON 不是对象' }
    const arr = (v: unknown): any[] => (Array.isArray(v) ? v : [])
    return {
      meta: {
        schema: parsed.schema === 'report-meta/2' ? 'report-meta/2' : 'report-meta/1',
        skill: String(parsed.skill ?? ''),
        sources: arr(parsed.sources),
        metrics: arr(parsed.metrics),
        claims: arr(parsed.claims),
        evidence: arr(parsed.evidence),
        charts: arr(parsed.charts),
      },
      cleanText,
    }
  } catch (exc: any) {
    return { meta: null, cleanText, error: `侧车 JSON 解析失败：${exc?.message ?? exc}` }
  }
}

const KINDS = new Set(['fact', 'inference', 'recommendation'])
/** 错误清单上限：防模型输出大量坏条目把 note/report 撑爆 */
const MAX_ERRORS = 20

/** 引用完整性校验：来源 id 唯一、metric.sourceIds 非空且可解析、claim.kind 合法，evidence.sourceIds 可解析。
    不做正文↔侧车数值一致性核对（flash 级模型容错）。 */
export function validateMeta(meta: ReportMeta): MetaValidation {
  const errors: string[] = []
  const push = (msg: string) => {
    if (errors.length < MAX_ERRORS) errors.push(msg)
  }

  const sourceIds = new Set<string>()
  for (const s of meta.sources ?? []) {
    const id = typeof s?.id === 'string' ? s.id.trim() : ''
    if (!id) push('来源条目缺少 id')
    else if (sourceIds.has(id)) push(`来源 id 重复：${id}`)
    else sourceIds.add(id)
    if (!s?.title) push(`来源 ${id || '?'} 缺少 title`)
  }

  const resolves = (ids: unknown, owner: string, required: boolean) => {
    const list = Array.isArray(ids) ? ids : []
    if (required && list.length === 0) {
      push(`${owner} 缺少 sourceIds`)
      return
    }
    for (const sid of list) {
      if (!sourceIds.has(String(sid))) push(`${owner} 引用了不存在的来源：${sid}`)
    }
  }

  if (meta.schema !== 'report-meta/1' && meta.schema !== 'report-meta/2') {
    push(`schema 不受支持：${meta.schema}`)
  }

  let metrics = 0
  for (const m of meta.metrics ?? []) {
    metrics++
    const id = typeof m?.id === 'string' && m.id ? m.id : `metrics[${metrics - 1}]`
    resolves(m?.sourceIds, `指标 ${id}`, true)
  }

  let facts = 0
  let inferences = 0
  let recommendations = 0
  for (const c of meta.claims ?? []) {
    if (c?.kind === 'fact') facts++
    else if (c?.kind === 'inference') inferences++
    else if (c?.kind === 'recommendation') recommendations++
    else push(`结论 ${c?.id || '?'} 的 kind 非法：${c?.kind}`)
    if (c?.sourceIds) resolves(c.sourceIds, `结论 ${c.id || '?'}`, false)
  }

  for (const e of meta.evidence ?? []) {
    const id = e?.id || '?'
    if (!e?.claim && !e?.requirement) push(`依据 ${id} 缺少 claim 或 requirement`)
    if (e?.sourceIds) resolves(e.sourceIds, `依据 ${id}`, false)
  }

  const chartTypes = new Set(['bar', 'stackedBar', 'histogram', 'line', 'map'])
  const charts = Array.isArray(meta.charts) ? meta.charts : []
  if (charts.length > 20) push('图表数量超过 20 个')
  for (const chart of charts) {
    const id = chart?.id || '?'
    if (!chart?.title) push(`图表 ${id} 缺少 title`)
    if (!chartTypes.has(String(chart?.type))) push(`图表 ${id} 的 type 非法：${chart?.type}`)
    if (!Array.isArray(chart?.data) || chart.data.length === 0) push(`图表 ${id} 缺少 data`)
    if (Array.isArray(chart?.data) && chart.data.length > 20) push(`图表 ${id} 数据点超过 20 个`)
    resolves(chart?.sourceIds, `图表 ${id}`, true)
    if (chart?.type === 'line' && Array.isArray(chart.data) && chart.data.some(row => !('label' in row || 'date' in row || 'x' in row)))
      push(`图表 ${id} 为 line，但数据缺少时间/横轴字段`)
    if (chart?.type === 'map' && Array.isArray(chart.data) && chart.data.some(row => !('code' in row)))
      push(`图表 ${id} 为 map，但数据缺少行政区 code`)
  }

  return {
    pass: errors.length === 0,
    errors,
    counts: {
      sources: sourceIds.size,
      metrics,
      facts,
      inferences,
      recommendations,
      charts: charts.length,
    },
  }
}

/** 注入首轮提示词的侧车输出指令（紧凑；schema 细节见 plaza-dev-notes 001） */
export function sidecarInstruction(skill: string): string {
  return (
    '最后，在报告全文结束后另起一行输出一个机器校验块（系统会剥离，用户不可见）：' +
    '围栏必须精确为 ```json:report-meta（不是普通 json 代码块），块内是单个 JSON 对象、块外不附加任何说明，形如\n' +
    '{"schema":"report-meta/2","skill":"' + skill + '",' +
    '"sources":[{"id":"DS1","title":"…","snapshotDate":"…","locator":"…"}],' +
    '"metrics":[{"id":"M1","name":"…","value":0,"unit":"…","period":"…","region":"…","sourceIds":["DS1"]}],' +
    '"claims":[{"id":"C1","kind":"fact","sourceIds":["DS1"],"sectionId":"…"}], ' +
    '"evidence":[{"id":"E1","requirement":"…","support":"…","status":"matched","sourceIds":["DS1"]}], ' +
    '"charts":[{"id":"CH1","type":"bar","title":"…","data":[{"label":"…","value":0}],"sourceIds":["DS1"],"unit":"%","caveat":"…","altText":"…"}]}\n' +
    '要求：sources 列出本报告引用的全部数据来源（内置文档注明快照日期与定位章节，用户提供的材料注明提供方）；' +
    'metrics 覆盖正文每个关键数字，值/单位/时期/地域随正文口径，sourceIds 必填；' +
    'claims 逐条对应正文中面向用户呈现的关键事实、判断和建议，kind 依次为 fact/inference/recommendation；' +
    'evidence 记录岗位要求/用户材料与判断的对应关系，status 使用 matched/partial/gap/unknown；' +
    '需要图表时只输出 charts 结构化规格：type 只能是 bar/stackedBar/histogram/line/map，data 最多 20 个点；' +
    '图表必须引用 sources，注明单位、快照日期和 caveat；不要输出 HTML、SVG、JavaScript 或图片 Base64；' +
    '依据只写入侧车，不要为了生成侧车在正文添加机器标签。' +
    '编号沿用正文已有习惯且与正文一致（来源 DS1…、指标 M1…、结论 C1…）。' +
    '可选字段能省则省，紧凑输出，不要在侧车里复述正文文字。'
  )
}
