<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { bySlug, catOf, SKILLS, GENERAL_SKILL_ID, GENERAL_SKILL_NAME, type Skill } from '../data/skills'
import { checkHealth, streamChat, type ChatAttachment, type ChatEvent } from '../composables/useChatApi'
import { takePendingFormTask } from '../composables/pendingTask'
import { fetchRunDetail, fetchRuns, runReportUrl, setConversationArchived, deleteConversation } from '../api/runsApi'
import { OUTCOME_LABEL, type RunListItem } from '../data/runsMock'
import type { ReportChart as ReportChartData } from '../data/runsMock'
import Icon from '../components/Icon.vue'
import ReportOutput from '../components/ReportOutput.vue'
import ToolCallGroup from '../components/ToolCallGroup.vue'
import { useCopy } from '../composables/useCopy'
import { toast } from '../composables/toast'

/* 在线对话：广场的唯一对话与运行呈现面。
   后端就绪时真实流式运行（Pi + DeepSeek）：默认通用智能体，$ 挂载技能；
   「任务配置」表单页提交的任务也交接到这里运行。
   历史展示服务端运行记录（/api/runs），后端未启动时回落为演示摘要输出。 */
const { copy } = useCopy()

interface Msg {
  role: 'user' | 'ai'
  text: string
  skill?: Skill
  done: boolean
  real?: boolean
  /** done 事件带回的图表与报告链接（表单任务/报告技能） */
  charts?: ReportChartData[]
  reportUrl?: string
  /** 历史恢复的 AI 消息携带的工具调用摘要（名称+成败+起止耗时，030 边界内） */
  tools?: Array<{ tool: string; failed: boolean; startedAt?: number; endedAt?: number }>
}

interface Demo { slug: string; question: string; reply: string }
const DEMOS: Demo[] = [
  {
    slug: 'industry-education-report',
    question: '帮我做一份新能源汽车产业的产教决策报告',
    reply: `【演示输出 · 产教决策报告】\n\n■ 产业与岗位\n· 新能源汽车产业岗位需求持续增长，三电系统维修、智能网联测试为缺口最大的两类岗位\n· 数据来源与统计口径已登记，可回溯\n\n■ 专业与课程建议\n· 建议新增「智能网联汽车检测与维修」培养方向\n· 现有课程体系缺口：车载总线诊断、电池管理系统\n\n■ 待验证项\n· 区域产业规模需补充本地统计年鉴口径后复核\n\n——以上为演示摘要。完整报告（含来源引用与结构校验）请在本地 AI 工具中运行获得。`,
  },
  {
    slug: 'classroom-assistant',
    question: '把这节课的资料变成课堂练习和答疑助手',
    reply: `【演示输出 · 课堂助教】\n\n■ 已基于授权资料生成\n· 课堂要点 12 条，按教学顺序排列\n· 练习题 8 道（选择 5 / 简答 3），附答案与出处页码\n· 高频疑问 5 条，已整理成答疑口径\n\n■ 说明\n· 每条结论均附资料定位引用，可回原文核对\n\n——以上为演示摘要。完整课堂网站（含练习作答与统计）请在本地 AI 工具中运行获得。`,
  },
  {
    slug: 'ai-interview',
    question: '模拟一轮产品经理岗位的 AI 面试',
    reply: `【演示输出 · AI 面试练习】\n\n■ 面试报告摘要\n· 覆盖题目 6 道：项目深挖 2 / 情景应对 2 / 岗位认知 2\n· 每道题支持追问与重答，回答均保留原话引用\n\n■ 能力地图\n· 表达结构：良好｜岗位认知：待加强｜项目量化：待补充\n\n■ 待验证项\n· "用户增长 30%" 缺少口径说明，已标记为待核实\n\n——以上为演示摘要。完整逐题问答与重练请在本地 AI 工具中运行获得。`,
  },
  {
    slug: 'career-guidance',
    question: '判断这个 Java 后端实习岗位我合不合适，再给一份行动计划',
    reply: `【演示输出 · 就业指导】\n\n■ 岗位匹配证据表\n· 已证明：Spring Boot 接口开发（校园项目可佐证）\n· 部分证明：MySQL 数据建模（有实践、缺规模）\n· 关键缺口：分布式与中间件经验（岗位标注"优先"）\n\n■ 30 天行动建议\n· 第 1 周：补消息队列入门，产出学习笔记\n· 第 2–3 周：项目补并发场景改造，重写简历项目段\n· 第 4 周：按每周 5 家投递并复盘\n\n■ 待核实\n· 岗位"转正后 8–12K"的口径与绩效占比\n\n——以上为演示摘要。完整证据表与周计划请在本地 AI 工具中运行获得。`,
  },
  {
    slug: 'training-data-qa',
    question: '构造一批客服领域的训练样本并做质检',
    reply: `【演示输出 · 训练样本构造与标注质检】\n\n■ 样本构造\n· 四类划分：指令跟随 / 事实问答 / 拒答 / 边界探索\n· 本批生成 200 条候选样本，机器质检通过率 86%\n\n■ 质检说明\n· 候选结果 ≠ 专家确认，全部样本待人工抽检\n· 全程保留来源与谱系，可追溯\n\n——以上为演示摘要。完整样本集与质检台账请在本地 AI 工具中运行获得。`,
  },
]

const FALLBACK = `这个问题需要在本地 AI 工具中调用对应的 SKILL 来完成。\n\n在线对话页展示的是各 SKILL 的结果形态（可点击上方示例问题查看）。要获得完整结果：\n\n1. 回到 智能体广场，找到匹配的 SKILL\n2. 复制安装提示词，发送给你的 AI 工具\n3. 用最小输入示例开始第一次运行`

const textarea = ref('')
const textareaEl = ref<HTMLTextAreaElement | null>(null)
const sending = ref(false)
const messages = ref<Msg[]>([])
/* 当前对话 id（后端会话与技能绑定的 key）；null = 下一条消息开新会话 */
const currentConvId = ref<number | null>(null)
const streamTimer: { value: ReturnType<typeof setInterval> | null } = { value: null }
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

/* 每个对话对应一个 Pi 后端会话（多轮上下文保留）；技能与会话绑定 */
const convSessions = new Map<string, string>()
const convSlugs = new Map<number, string>()

/* ---------- 运行进度（status 事件 → ToolCallGroup，只登记真实工具调用；安全边界见手记 030） ---------- */
interface ProgressItem {
  id: string
  phase: 'tool'
  state: 'active' | 'completed' | 'failed'
  title: string
  detail: string
  tool?: string
  startedAt: number
  finishedAt?: number
}
const progressEvents = ref<ProgressItem[]>([])
/** 正文首字到达后工具组自动折叠（066 交互） */
const proseStarted = ref(false)
/** 本轮工具组归属的 AI 消息：多轮对话里组只贴在发起运行的那条上 */
const progressOwner = ref<Msg | null>(null)
let progressSeq = 0

/* 运行阶段实时状态行 + 计时 */
const runStatus = ref('')
const elapsedMs = ref(0)
let elapsedTimer: ReturnType<typeof setInterval> | null = null
function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}分${String(seconds % 60).padStart(2, '0')}秒`
}
function beginRun() {
  if (elapsedTimer) clearInterval(elapsedTimer)
  progressEvents.value = []
  proseStarted.value = false
  progressSeq = 0
  const started = Date.now()
  elapsedMs.value = 0
  elapsedTimer = setInterval(() => { elapsedMs.value = Date.now() - started }, 250)
}
function endRun() {
  if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null }
}

/* 中性动词短语：实时状态行加「正在…」，历史工具行直接用（不再对已完成行显示"正在"） */
function toolProgress(tool?: string): { title: string; detail: string } {
  const name = (tool ?? '').toLowerCase()
  if (name.includes('career-market') || name.includes('mysql') || name.includes('query')) {
    return { title: '查询岗位库', detail: '分析岗位要求、经验和薪资结构' }
  }
  if (name === 'read' || name.includes('read')) {
    return { title: '读取参考资料', detail: '整理当前任务所需的技能规则和资料' }
  }
  if (name === 'write' || name.includes('write')) {
    return { title: '生成报告文件', detail: '写入并校验用户可查看的报告' }
  }
  if (name.includes('chart') || name.includes('visual')) {
    return { title: '生成数据图表', detail: '把已验证的数据整理为可读图表' }
  }
  if (name === 'bash' || name.includes('shell')) {
    return { title: '执行数据处理', detail: '运行受控的数据处理任务' }
  }
  return { title: '调用工具', detail: tool || '执行受控任务' }
}

function activeProgress(phase?: ProgressItem['phase'], id?: string): ProgressItem | undefined {
  return progressEvents.value.find(item => item.state === 'active' && ((!id || item.id === id) && (!phase || item.phase === phase)))
}

function handleProgressStatus(event: Extract<ChatEvent, { type: 'status' }>) {
  /* 面板只展示真实发生的工具调用（030 边界不变）：思考、写正文是每次运行的
     常态而非阶段，不再渲染占位行——是否调用工具由智能体按意图自行决定。 */
  const now = Date.now()
  if (event.phase === 'text') {
    /* 正文开始：兜底关闭未收到完成事件的工具行 */
    for (const item of progressEvents.value) if (item.state === 'active') {
      item.state = 'completed'
      item.finishedAt = now
    }
    return
  }
  if (event.phase !== 'tool') return
  if (event.state === 'active') {
    const copy = toolProgress(event.tool)
    progressEvents.value.push({ id: event.id ?? `p-${++progressSeq}`, phase: 'tool', state: 'active', title: copy.title, detail: copy.detail, tool: event.tool, startedAt: now })
  } else {
    const item = activeProgress('tool', event.id) ?? [...progressEvents.value].reverse().find(x => x.phase === 'tool' && x.state === 'active')
    if (item) {
      item.state = event.state === 'failed' ? 'failed' : 'completed'
      item.finishedAt = now
      const seconds = ((now - item.startedAt) / 1000).toFixed(1)
      item.detail = event.state === 'failed' ? `工具执行失败（${seconds}s）` : `工具执行完成（${seconds}s）`
    }
  }
}

/* ---------- 后端就绪探测：就绪则真实流式，否则演示输出 ---------- */
const apiReady = ref(false)
const apiModel = ref('')

async function probeApi() {
  const result = await checkHealth()
  apiReady.value = result.ok
  apiModel.value = result.ok ? (result.model ?? '') : ''
  if (result.ok) {
    MODELS[0].name = '智能体搭子 Agent（真实运行）'
  }
}

/* 模型选择器：演示选项，仅影响显示 */
const MODELS = [
  { id: 'skill-agent', name: '智能体搭子 Agent' },
  { id: 'deepseek', name: 'DeepSeek V4 Pro' },
  { id: 'gpt', name: 'GPT-5' },
  { id: 'qwen', name: '通义千问 Max' },
]
const model = ref(MODELS[0])
const modelOpen = ref(false)
function pickModel(id: string) {
  model.value = MODELS.find(m => m.id === id) ?? MODELS[0]
  modelOpen.value = false
}
function onDocClick(event: MouseEvent) {
  if (modelOpen.value && !(event.target as HTMLElement | null)?.closest('.exp-model')) modelOpen.value = false
  if (skillMenu.value && !(event.target as HTMLElement | null)?.closest('.exp-input-box')) skillMenu.value = false
}

const EXAMPLES = DEMOS.map(d => ({ slug: d.slug, question: d.question, skill: bySlug.get(d.slug) }))

/* ---- $ 技能选择：默认通用智能体（不挂技能），输入 $ 或点 $ 钮呼出选择器 ---- */
const activeSkill = ref<Skill | undefined>()
const skillMenu = ref(false)
const skillQuery = ref('')
const skillHighlight = ref(0)
const skillMatches = computed(() => {
  const q = skillQuery.value.trim().toLowerCase()
  const list = SKILLS.filter(s =>
    !q || s.slug.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.tags.some(t => t.toLowerCase().includes(q)))
  return list.slice(0, 8)
})
/* 光标前的未完成 $token（$ 起、空白止）命中时呼出选择器 */
const MENTION_RE = /(?:^|\s)\$([^\s$]*)$/
function syncSkillMenu() {
  const el = textareaEl.value
  if (!el) { skillMenu.value = false; return }
  const m = el.value.slice(0, el.selectionStart ?? el.value.length).match(MENTION_RE)
  if (m) {
    if (!skillMenu.value) skillHighlight.value = 0
    skillQuery.value = m[1]
    skillMenu.value = true
  } else {
    skillMenu.value = false
    skillQuery.value = ''
  }
}
function toggleSkillMenu() {
  if (skillMenu.value) { skillMenu.value = false; return }
  skillQuery.value = ''
  skillHighlight.value = 0
  skillMenu.value = true
  textareaEl.value?.focus()
}
function pickSkill(skill: Skill) {
  activeSkill.value = skill
  /* 移除触发选择的 $token（经 $ 钮呼出时没有 token，只挂载技能） */
  const el = textareaEl.value
  if (el) {
    const caret = el.selectionStart ?? el.value.length
    const m = el.value.slice(0, caret).match(MENTION_RE)
    if (m && m.index !== undefined) {
      const tokenStart = m.index + m[0].length - m[1].length - 1
      textarea.value = el.value.slice(0, tokenStart) + el.value.slice(caret)
      nextTick(() => { el.focus(); el.setSelectionRange(tokenStart, tokenStart) })
    } else {
      el.focus()
    }
  }
  skillMenu.value = false
  skillQuery.value = ''
}
function clearSkill() {
  activeSkill.value = undefined
  textareaEl.value?.focus()
}
function onTextareaKeydown(event: KeyboardEvent) {
  if (skillMenu.value && skillMatches.value.length) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const n = skillMatches.value.length
      skillHighlight.value = (skillHighlight.value + (event.key === 'ArrowDown' ? 1 : n - 1)) % n
      return
    }
    if ((event.key === 'Enter' || event.key === 'Tab') && !event.isComposing) {
      event.preventDefault()
      pickSkill(skillMatches.value[Math.min(skillHighlight.value, skillMatches.value.length - 1)])
      return
    }
  }
  if (event.key === 'Escape' && skillMenu.value) { skillMenu.value = false; return }
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    send()
  }
}

function scrollTop() {
  /* 整页滚动：滚到文档底部（输入框吸底在流下方） */
  nextTick(() => { window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }) })
}

function stopTyping() {
  if (streamTimer.value) { clearInterval(streamTimer.value); streamTimer.value = null }
  const last = messages.value[messages.value.length - 1]
  if (last && last.role === 'ai' && !last.done) last.done = true
  sending.value = false
}

function newChat() {
  stopTyping()
  clearHistorySelection()
  currentConvId.value = null
  messages.value = []
  textarea.value = ''
}

/* ---------- 演示输出：逐字打字机效果（后端未就绪时） ---------- */
function startAiMsg(skill: Skill | undefined, real: boolean): Msg {
  messages.value.push({ role: 'ai', text: '', skill, done: false, real })
  const msg = messages.value[messages.value.length - 1]
  scrollTop()
  return msg
}
function typeInto(msg: Msg, reply: string) {
  if (reducedMotion.matches) {
    msg.text = reply
    msg.done = true
    sending.value = false
    return
  }
  streamTimer.value = setInterval(() => {
    msg.text = reply.slice(0, msg.text.length + 3)
    scrollTop()
    if (msg.text.length >= reply.length) {
      msg.text = reply
      msg.done = true
      sending.value = false
      if (streamTimer.value) { clearInterval(streamTimer.value); streamTimer.value = null }
    }
  }, 24)
}

/* ---------- 真实运行：走本地 Node 后端 → Pi，SSE 流式回填 ---------- */
interface RunOptions { taskTitle?: string; attachments?: ChatAttachment[] }

function makeStreamHandler(msg: Msg, sessionKey: string) {
  return (event: ChatEvent) => {
    if (event.type === 'session') {
      /* 服务端发回本轮会话 id（首轮新建、被回收后重建都会发）：记住它，后续轮次带上下文多轮 */
      convSessions.set(sessionKey, event.sessionId)
    } else if (event.type === 'started') {
      elapsedMs.value = Math.max(0, Date.now() - event.startedAt)
      runStatus.value = '正在思考…'
    } else if (event.type === 'status') {
      handleProgressStatus(event)
      if (event.phase === 'tool') runStatus.value = `正在${toolProgress(event.tool).title}…`
      else if (event.phase === 'text') runStatus.value = ''
      else runStatus.value = '正在思考…'
    } else if (event.type === 'text') {
      proseStarted.value = true
      msg.text += event.delta
      scrollTop()
    } else if (event.type === 'done') {
      if (!msg.text && event.content) msg.text = event.content
      msg.charts = event.charts ?? []
      msg.reportUrl = event.reportUrl
    } else if (event.type === 'error') {
      for (const item of progressEvents.value) if (item.state === 'active') item.state = 'failed'
      throw new Error(event.message)
    }
  }
}

async function runReal(text: string, slug: string, skill: Skill | undefined, opts: RunOptions = {}) {
  const convId = currentConvId.value
  if (convId === null) return
  const msg = startAiMsg(skill, true)
  progressOwner.value = msg
  convSlugs.set(convId, slug)
  const sessionKey = `pi:${convId}`
  beginRun()
  try {
    await streamChat({
      skill: slug,
      taskTitle: opts.taskTitle,
      messages: [{ role: 'user', content: text }],
      sessionId: convSessions.get(sessionKey),
      attachments: opts.attachments,
      onEvent: makeStreamHandler(msg, sessionKey),
    })
    msg.done = true
  } catch (error) {
    if (!msg.text) {
      /* 一字未出就失败：回落到演示输出，保证页面可用 */
      msg.real = false
      msg.charts = undefined
      msg.reportUrl = undefined
      progressEvents.value = []
      toast(error instanceof Error ? error.message : '真实运行失败，已切换为演示输出')
      const demo = skill ? DEMOS.find(d => d.slug === skill.slug) : undefined
      typeInto(msg, demo ? demo.reply : FALLBACK)
      return
    }
    msg.done = true
  } finally {
    endRun()
    if (msg.done) sending.value = false
  }
}

function send(raw?: string) {
  const text = (raw ?? textarea.value).trim()
  if (!text || sending.value) return

  if (currentConvId.value === null) currentConvId.value = Date.now()
  skillMenu.value = false

  messages.value.push({ role: 'user', text, done: true })
  textarea.value = ''
  sending.value = true
  runStatus.value = ''
  elapsedMs.value = 0

  /* 默认通用智能体；$ 挂载的技能只作用于后续消息 */
  const skill = activeSkill.value
  const requested = skill?.slug ?? GENERAL_SKILL_ID

  if (apiReady.value) {
    /* 会话与技能绑定：换技能即弃用旧后端会话（其上下文属于旧技能），下轮新建 */
    const convId = currentConvId.value
    if (convId !== null) {
      const bound = convSlugs.get(convId)
      if (bound !== requested) {
        if (bound !== undefined) convSessions.delete(`pi:${convId}`)
        convSlugs.set(convId, requested)
      }
    }
    void runReal(text, requested, skill)
    return
  }
  const demo = skill ? DEMOS.find(d => d.slug === skill.slug) : undefined
  typeInto(startAiMsg(skill, false), demo ? demo.reply : FALLBACK)
}

/* ---------- 表单任务承接：任务配置页 stash → 这里挂载技能并发起运行 ---------- */
function consumePendingFormTask() {
  const task = takePendingFormTask()
  if (!task) return
  const skill = bySlug.get(task.slug)
  activeSkill.value = skill
  stopTyping()
  clearHistorySelection()
  currentConvId.value = Date.now()
  messages.value = []
  textarea.value = ''

  messages.value.push({ role: 'user', text: task.prompt, done: true })
  sending.value = true
  runStatus.value = ''
  elapsedMs.value = 0
  convSlugs.set(currentConvId.value, task.slug)
  /* 沿用表单上传的沙箱会话：引擎才能读到已上传附件 */
  if (task.sessionId) convSessions.set(`pi:${currentConvId.value}`, task.sessionId)

  if (!apiReady.value) {
    const demo = skill ? DEMOS.find(d => d.slug === skill.slug) : undefined
    typeInto(startAiMsg(skill, false), demo ? demo.reply : FALLBACK)
    return
  }
  void runReal(task.prompt, task.slug, skill, { taskTitle: task.taskTitle, attachments: task.attachments })
}

function fill(slug: string) {
  const demo = DEMOS.find(d => d.slug === slug)
  if (demo) {
    textarea.value = demo.question
    /* 示例即技能问题：挂上对应技能，脱离 $ 的模糊匹配 */
    activeSkill.value = bySlug.get(slug)
    textareaEl.value?.focus()
  }
}
function copyInstall(slug: string) {
  const skill = bySlug.get(slug)
  if (skill) copy(skill.installPrompt, '安装提示词已复制')
}
const skillTitle = (slug: string) => bySlug.get(slug)?.name ?? ''
const skillCat = (slug: string) => { const s = bySlug.get(slug); return s ? catOf(s.categoryId).name : '' }

/* ---------- 历史运行记录：侧栏按对话（clientSessionId）分组，点开直接载入对话流 ---------- */
const historyRuns = ref<RunListItem[]>([])
const archivedRuns = ref<RunListItem[]>([])
const historyLive = ref(false)
const historyLoading = ref(true)
/** 当前选中的对话（key = clientSessionId，旧记录退化为其 runId） */
const selectedSessionKey = ref<string | null>(null)
/** 历史对话载入中（主区显示一行提示，避免空态示例闪现） */
const loadingConversation = ref(false)

/** 一个对话 = 同一 clientSessionId 的全部运行；换技能/新建对话会开新会话，天然分组边界 */
interface HistoryGroup {
  key: string
  title: string
  skill: string
  /** 最新一次运行（trace 是会话累计快照，最新记录包含完整对话） */
  latest: RunListItem
  count: number
  archived: boolean
}

interface HistoryDetail {
  conversation: Array<{ role: 'user' | 'assistant'; text: string; tools?: Array<{ tool: string; failed: boolean; startedAt?: number; endedAt?: number }> }>
  /** 该对话生成的 HTML 报告（内联在最后一条 AI 消息上，与实时对话一致） */
  reportUrl?: string
}
const historyDetails = reactive<Record<string, HistoryDetail>>({})
let selectionSeq = 0

const skillNameOf = (slug: string) => bySlug.get(slug)?.name ?? (slug === GENERAL_SKILL_ID ? GENERAL_SKILL_NAME : slug)

function fmtTime(ts: number | string): string {
  const d = new Date(ts)
  return d.toDateString() === new Date().toDateString()
    ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : `${d.getMonth() + 1}/${d.getDate()}`
}

/* 运行记录 → 对话分组（旧记录无 clientSessionId 时退化为单运行一组）；常规与归档列表共用 */
function groupRuns(runs: RunListItem[], archived: boolean): HistoryGroup[] {
  const bySession = new Map<string, RunListItem[]>()
  for (const run of runs) {
    const key = run.clientSessionId || run.runId
    const bucket = bySession.get(key)
    if (bucket) bucket.push(run)
    else bySession.set(key, [run])
  }
  const groups = [...bySession.values()].map(items => {
    const sorted = [...items].sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))
    const oldest = sorted[sorted.length - 1]
    return {
      key: oldest.clientSessionId || oldest.runId,
      title: oldest.taskTitle || oldest.promptDigest || '历史对话',
      skill: oldest.skill,
      latest: sorted[0],
      count: sorted.length,
      archived,
    }
  })
  return groups.sort((a, b) => Date.parse(b.latest.ts) - Date.parse(a.latest.ts))
}
const historyGroups = computed(() => groupRuns(historyRuns.value, false))
const archivedGroups = computed(() => groupRuns(archivedRuns.value, true))
/** 展开归档区时附加在常规分组之后 */
const showArchived = ref(false)
const sidebarSections = computed(() => {
  const sections: { label: string; items: HistoryGroup[] }[] = groupedHistory.value.map(b => ({ label: b.label, items: b.items }))
  if (showArchived.value && archivedGroups.value.length) sections.push({ label: '已归档', items: archivedGroups.value })
  return sections
})

/* 侧栏按时间桶分组（今天 / 昨天 / 更早），桶内按对话最新活动排序 */
const groupedHistory = computed(() => {
  const now = new Date()
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  const groups: { label: string; items: HistoryGroup[] }[] = [
    { label: '今天', items: [] },
    { label: '昨天', items: [] },
    { label: '更早', items: [] },
  ]
  for (const group of historyGroups.value) {
    const d = new Date(group.latest.ts)
    if (d.toDateString() === now.toDateString()) groups[0].items.push(group)
    else if (d.toDateString() === yest.toDateString()) groups[1].items.push(group)
    else groups[2].items.push(group)
  }
  return groups.filter(g => g.items.length > 0)
})

function clearHistorySelection() {
  selectedSessionKey.value = null
}

/* 历史恢复的工具行 → ProgressItem；trace 带起止时间（新运行）时还原每行耗时与组总时长，旧 trace 无计时则不显示 */
function historyToolItems(msg: Msg): ProgressItem[] {
  return (msg.tools ?? []).map((tool, i) => ({
    id: `ht-${i}`,
    phase: 'tool',
    state: tool.failed ? 'failed' : 'completed',
    title: toolProgress(tool.tool).title,
    detail: tool.failed ? '工具执行失败' : '',
    startedAt: tool.startedAt ?? 0,
    finishedAt: tool.endedAt,
  }))
}

/* 点开历史 = 把对话载入正常消息流（与 ChatGPT 一致）：无专门结果卡，
   报告链接内联在最后一条 AI 消息；同时恢复服务端会话，可直接继续对话。 */
async function selectHistory(group: HistoryGroup) {
  if (sending.value) {
    toast('当前运行进行中，完成后才能查看历史对话')
    return
  }
  if (selectedSessionKey.value === group.key) return
  selectedSessionKey.value = group.key
  const run = group.latest

  const restore = (detail: HistoryDetail) => {
    const skill = bySlug.get(group.skill)
    stopTyping()
    currentConvId.value = Date.now()
    convSlugs.set(currentConvId.value, group.skill)
    /* 服务端会话仍在内存时续聊带完整上下文；被回收则透明重开（旧上下文丢失） */
    if (run.clientSessionId) convSessions.set(`pi:${currentConvId.value}`, run.clientSessionId)
    activeSkill.value = skill
    let lastAi = -1
    detail.conversation.forEach((turn, i) => { if (turn.role === 'assistant') lastAi = i })
    messages.value = detail.conversation.map((turn, i) => turn.role === 'user'
      ? { role: 'user', text: turn.text, done: true }
      : { role: 'ai', text: turn.text, skill, done: true, real: true, reportUrl: i === lastAi ? detail.reportUrl : undefined, tools: turn.tools })
    progressOwner.value = null
    progressEvents.value = []
    scrollTop()
  }

  const cached = historyDetails[run.runId]
  if (cached) { restore(cached); return }

  const seq = ++selectionSeq
  loadingConversation.value = true
  try {
    const result = await fetchRunDetail(run.runId)
    if (seq !== selectionSeq) return
    /* live=false 是 mock 兜底数据，不能冒充真实历史 */
    if (!result.live || !(result.conversation ?? []).length) throw new Error('empty')
    const detail: HistoryDetail = {
      conversation: result.conversation ?? [],
      reportUrl: result.item?.files?.html ? runReportUrl(run.runId) : undefined,
    }
    historyDetails[run.runId] = detail
    restore(detail)
  } catch {
    if (seq === selectionSeq) {
      selectedSessionKey.value = null
      toast('历史对话加载失败，请稍候重试')
    }
  } finally {
    if (seq === selectionSeq) loadingConversation.value = false
  }
}

/* 防重入与显示态分开：初始 loading=true 只为避免空态闪现，不代表有请求在途 */
let historyReqInFlight = false
async function loadHistory() {
  if (historyReqInFlight) return
  historyReqInFlight = true
  historyLoading.value = true
  try {
    const [result, archived] = await Promise.all([fetchRuns(), fetchRuns({ archived: true })])
    /* live=false 是 mock 兜底数据，不冒充真实历史 */
    historyRuns.value = result.live ? result.runs : []
    archivedRuns.value = archived.runs
    historyLive.value = result.live
    if (!result.live) {
      clearHistorySelection()
      return
    }
    if (showArchived.value && archivedGroups.value.length === 0) showArchived.value = false
    /* 当前对话（新建/表单交接/历史恢复）在列表刷新后保持或获得高亮 */
    const activeSession = currentConvId.value !== null ? convSessions.get(`pi:${currentConvId.value}`) : undefined
    if (selectedSessionKey.value && !historyGroups.value.some(g => g.key === selectedSessionKey.value)) {
      clearHistorySelection()
    } else if (!selectedSessionKey.value && activeSession && historyGroups.value.some(g => g.key === activeSession)) {
      selectedSessionKey.value = activeSession
    }
  } finally {
    historyReqInFlight = false
    historyLoading.value = false
  }
}

/* ---------- 会话归档/删除（操作成功后刷新两个列表） ---------- */
const confirmDeleteKey = ref<string | null>(null)
let confirmDeleteTimer: ReturnType<typeof setTimeout> | null = null

async function archiveConversation(group: HistoryGroup, archived: boolean) {
  if (sending.value) {
    toast('当前运行进行中，完成后才能操作')
    return
  }
  const ok = await setConversationArchived(group.key, archived)
  if (!ok) {
    toast('操作失败，请稍候重试')
    return
  }
  toast(archived ? '已归档，可在侧栏底部「已归档对话」查看' : '已恢复到对话列表')
  void loadHistory()
}

function onDeleteClick(group: HistoryGroup) {
  if (sending.value) {
    toast('当前运行进行中，完成后才能操作')
    return
  }
  /* 两步确认：第一次点红显确认态，2.5 秒内再点才执行 */
  if (confirmDeleteKey.value !== group.key) {
    confirmDeleteKey.value = group.key
    if (confirmDeleteTimer) clearTimeout(confirmDeleteTimer)
    confirmDeleteTimer = setTimeout(() => { confirmDeleteKey.value = null }, 2500)
    return
  }
  if (confirmDeleteTimer) { clearTimeout(confirmDeleteTimer); confirmDeleteTimer = null }
  confirmDeleteKey.value = null
  void runDelete(group)
}
async function runDelete(group: HistoryGroup) {
  const ok = await deleteConversation(group.key)
  if (!ok) {
    toast('删除失败，请稍候重试')
    return
  }
  toast('对话已删除')
  delete historyDetails[group.latest.runId]
  if (selectedSessionKey.value === group.key) newChat()
  void loadHistory()
}

/* 运行结束后刷新历史列表（新记录入列） */
watch(sending, (now, was) => { if (was && !now) void loadHistory() })

onMounted(async () => {
  document.addEventListener('click', onDocClick)
  await probeApi()
  void loadHistory()
  consumePendingFormTask()
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  if (streamTimer.value) clearInterval(streamTimer.value)
  endRun()
})
</script>

<template>
  <section class="page page-exp">
    <aside class="exp-side">
      <button type="button" class="exp-new" @click="newChat">
        <Icon name="plus" :size="15" />
        新建对话
      </button>
      <div class="exp-history">
        <template v-for="section in sidebarSections" :key="section.label">
          <p class="exp-hist-group">{{ section.label }}</p>
          <div
            v-for="group in section.items"
            :key="group.key"
            class="exp-hist-item is-run"
            :class="{ 'is-active': group.key === selectedSessionKey }"
            role="button"
            tabindex="0"
            :title="group.title"
            @click="selectHistory(group)"
            @keydown.enter="selectHistory(group)"
          >
            <span class="exp-hist-ico"><Icon :name="bySlug.get(group.skill)?.categoryId ?? 'brand'" :size="14" /></span>
            <span class="exp-hist-copy">
              <span class="exp-hist-title">{{ group.title }}</span>
              <small>
                {{ skillNameOf(group.skill) }} ·
                {{ group.count > 1 ? `${group.count} 条消息` : fmtTime(group.latest.ts) }}
              </small>
            </span>
            <!-- 右列：结局徽章在上，操作按钮在右下角（常规=归档；已归档=恢复+删除） -->
            <span class="exp-hist-side">
              <span class="use-hist-outcome" :class="`is-${group.latest.outcome}`">{{ OUTCOME_LABEL[group.latest.outcome] ?? group.latest.outcome }}</span>
              <button
                v-if="!group.archived"
                type="button"
                class="exp-hist-inline"
                title="归档对话"
                aria-label="归档对话"
                @click.stop="archiveConversation(group, true)"
              ><Icon name="archive" :size="12" /></button>
              <span v-else class="exp-hist-side-acts">
                <button
                  type="button"
                  class="exp-hist-inline"
                  title="恢复到对话列表"
                  aria-label="恢复到对话列表"
                  @click.stop="archiveConversation(group, false)"
                ><Icon name="restore" :size="12" /></button>
                <button
                  type="button"
                  class="exp-hist-inline is-danger"
                  :class="{ 'is-confirm': confirmDeleteKey === group.key }"
                  :title="confirmDeleteKey === group.key ? '再次点击确认删除' : '删除对话'"
                  :aria-label="confirmDeleteKey === group.key ? '再次点击确认删除' : '删除对话'"
                  @click.stop="onDeleteClick(group)"
                >{{ confirmDeleteKey === group.key ? '确认' : '' }}<Icon name="trash" :size="12" /></button>
              </span>
            </span>
          </div>
        </template>
        <button
          v-if="!historyLoading && historyLive && (archivedGroups.length > 0 || showArchived)"
          type="button"
          class="exp-hist-archived"
          :class="{ 'is-open': showArchived }"
          @click="showArchived = !showArchived"
        >
          <Icon name="archive" :size="13" />
          已归档对话 · {{ archivedGroups.length }}
          <Icon name="chev-down" :size="12" />
        </button>
        <p v-if="historyLoading" class="exp-side-empty">正在加载运行记录…</p>
        <p v-else-if="!historyLive" class="exp-side-empty">启动本地服务后可查看运行记录</p>
        <p v-else-if="historyRuns.length === 0" class="exp-side-empty">还没有运行记录，跑一次任务后就会出现在这里</p>
      </div>
    </aside>

    <div class="wrap-exp" :class="{ 'is-empty': messages.length === 0 && !loadingConversation }">
      <div class="exp-shell">
        <div class="exp-top" :class="{ 'is-compact': messages.length > 0 || loadingConversation }">
          <h1 class="exp-title">智能体搭子，把产教领域的方法装进你的 AI</h1>
          <p class="exp-sub">默认由通用智能体直接回答，输入 $ 可挂载专业技能</p>
        </div>

        <div v-if="loadingConversation" class="exp-history-loading">正在读取对话…</div>
        <div v-else-if="messages.length === 0" class="exp-examples">
          <span class="exp-examples-label">试试这些：</span>
          <button v-for="ex in EXAMPLES" :key="ex.slug" type="button" class="exp-example" @click="fill(ex.slug)">
            {{ ex.question }}
          </button>
        </div>

        <div v-if="!loadingConversation && messages.length > 0" class="exp-stream">
          <template v-for="(msg, mi) in messages" :key="mi">
            <div v-if="msg.role === 'user'" class="exp-msg-user">{{ msg.text }}</div>
            <div v-else class="exp-msg-ai">
              <span class="exp-ai-avatar" :style="msg.skill ? { background: `var(--cat-${msg.skill.categoryId}-soft)`, color: `var(--cat-${msg.skill.categoryId})` } : {}">
                <Icon :name="msg.skill ? msg.skill.categoryId : 'brand'" :size="16" />
              </span>
              <div class="exp-ai-main">
                <div class="exp-ai-head">
                  <span class="exp-ai-name">{{ msg.skill ? skillTitle(msg.skill.slug) : '通用智能体' }}</span>
                  <span class="exp-ai-badge" v-if="msg.skill" :style="{ background: `var(--cat-${msg.skill.categoryId}-soft)`, color: `var(--cat-${msg.skill.categoryId})` }">
                    {{ skillCat(msg.skill.slug) }}
                  </span>
                  <span v-if="!msg.done && runStatus" class="exp-run-status">{{ runStatus }} · {{ formatElapsed(elapsedMs) }}</span>
                  <span v-else-if="msg.done" class="exp-demo-tag" :class="{ 'is-real': msg.real }">{{ msg.real ? '真实运行' : '演示输出' }}</span>
                </div>
                <ToolCallGroup v-if="msg === progressOwner && progressEvents.length" :items="progressEvents" :prose-started="proseStarted" />
                <ToolCallGroup v-else-if="msg.tools?.length" :items="historyToolItems(msg)" :prose-started="true" />
                <ReportOutput :text="msg.text" :charts="msg.charts" :report-url="msg.reportUrl"
                  :html-mode="msg.skill?.slug === 'career-guidance'" :streaming="!msg.done" />
                <div v-if="msg.done && msg.skill" class="exp-ai-actions">
                  <button type="button" class="exp-act exp-act-primary" @click="copyInstall(msg.skill.slug)">
                    <Icon name="copy" :size="14" />复制安装提示词
                  </button>
                  <RouterLink class="exp-act" :to="`/skill/${msg.skill.slug}`">查看详情<Icon name="arrow" :size="14" /></RouterLink>
                </div>
                <p v-if="msg.done && !msg.real" class="exp-ai-note">演示输出仅展示结果形态，完整产物请在本地 AI 工具中运行获得。</p>
                <p v-else-if="msg.done" class="exp-ai-note">{{ msg.skill ? '以上为 SKILL 真实运行输出' : '以上为通用智能体真实输出' }}（pi · {{ apiModel || '本地 Agent' }}）。</p>
              </div>
            </div>
          </template>
        </div>

        <div class="exp-input">
          <div class="exp-input-box">
            <div v-if="skillMenu" class="exp-skill-menu" role="listbox" aria-label="挂载 SKILL">
              <div
                v-for="(s, i) in skillMatches"
                :key="s.slug"
                class="exp-skill-item"
                :class="{ 'is-hot': i === skillHighlight }"
                role="option"
                :aria-selected="i === skillHighlight"
                @mousedown.prevent
                @click="pickSkill(s)"
              >
                <span class="exp-skill-ico" :style="{ background: `var(--cat-${s.categoryId}-soft)`, color: `var(--cat-${s.categoryId})` }">
                  <Icon :name="s.categoryId" :size="14" />
                </span>
                <span class="exp-skill-meta">
                  <b>{{ s.name }}</b>
                  <small>{{ s.summary }}</small>
                </span>
                <span class="exp-skill-slug">{{ s.slug }}</span>
              </div>
              <p v-if="skillMatches.length === 0" class="exp-skill-empty">没有匹配的 SKILL，试试其他关键词</p>
            </div>
            <textarea
              ref="textareaEl"
              v-model="textarea"
              class="exp-textarea"
              rows="2"
              placeholder="输入你的问题；输入 $ 挂载专业技能（如 $career-guidance）"
              @input="syncSkillMenu"
              @keydown="onTextareaKeydown"
            ></textarea>
            <div class="exp-input-bar">
              <button
                type="button"
                class="exp-skill-trigger"
                :class="{ 'is-on': skillMenu || activeSkill }"
                :title="activeSkill ? `已挂载 ${activeSkill.name}，点击更换` : '挂载 SKILL'"
                @click.stop="toggleSkillMenu"
              >$</button>
              <span v-if="activeSkill" class="exp-skill-chip" :style="{ background: `var(--cat-${activeSkill.categoryId}-soft)`, color: `var(--cat-${activeSkill.categoryId})` }">
                <Icon :name="activeSkill.categoryId" :size="13" />
                {{ activeSkill.name }}
                <button type="button" class="exp-skill-x" aria-label="取消挂载，回到通用智能体" @click="clearSkill">
                  <Icon name="x" :size="11" />
                </button>
              </span>
              <span class="exp-attach" title="演示环境不支持附件">
                <Icon name="paperclip" :size="16" />
              </span>
              <span class="exp-agent">
                <span class="exp-model">
                  <button type="button" class="exp-model-btn" :aria-expanded="modelOpen" aria-haspopup="menu" @click.stop="modelOpen = !modelOpen">
                    {{ model.name }}
                    <Icon name="chev-down" :size="13" />
                  </button>
                  <div v-if="modelOpen" class="exp-model-menu" role="menu">
                    <button
                      v-for="m in MODELS"
                      :key="m.id"
                      type="button"
                      class="exp-model-item"
                      :class="{ 'is-on': m.id === model.id }"
                      role="menuitem"
                      @click.stop="pickModel(m.id)"
                    >{{ m.name }}<span v-if="m.id !== 'skill-agent'" class="exp-model-tag">模拟</span></button>
                  </div>
                </span>
                <span class="exp-agent-dot" aria-hidden="true">·</span>
                <span class="exp-agent-label" :class="{ 'is-real': apiReady }">{{ apiReady ? (apiModel || '在线 Agent') : '演示' }}</span>
              </span>
              <button type="button" class="exp-send" :disabled="!textarea.trim() || sending" aria-label="发送" @click="send()">
                <Icon name="arrow-up" :size="16" />
              </button>
            </div>
          </div>
          <p class="exp-input-note">内容由 AI 生成，请仔细核对</p>
        </div>
      </div>
    </div>
  </section>
</template>
