<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { bySlug, catOf, SKILLS, GENERAL_SKILL_ID, type Skill } from '../data/skills'
import { checkHealth, streamChat } from '../composables/useChatApi'
import Icon from '../components/Icon.vue'
import MarkdownView from '../components/MarkdownView.vue'
import { useSession } from '../composables/session'
import { useCopy } from '../composables/useCopy'
import { toast } from '../composables/toast'

/* 在线体验：后端就绪时真实流式运行 SKILL（Pi + DeepSeek），
   后端未启动时回落为演示摘要输出，并引导安装到本地 AI 工具。 */
const { user, openLogin } = useSession()
const { copy } = useCopy()

interface Msg { role: 'user' | 'ai'; text: string; skill?: Skill; done: boolean; real?: boolean }
interface Conv { id: number; title: string; messages: Msg[]; updatedAt: number }

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
/* 真实运行阶段实时状态（status 事件驱动）：思考/调工具/生成正文 */
const runStatus = ref('')
const elapsedMs = ref(0)
let elapsedTimer: ReturnType<typeof setInterval> | null = null
function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}分${String(seconds % 60).padStart(2, '0')}秒`
}
function beginRun() {
  if (elapsedTimer) clearInterval(elapsedTimer)
  const started = Date.now()
  elapsedMs.value = 0
  elapsedTimer = setInterval(() => { elapsedMs.value = Date.now() - started }, 250)
}
function endRun() {
  if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null }
}
const messages = ref<Msg[]>([])
const activeId = ref<number | null>(null)
const conversations = ref<Conv[]>([])
const streamEl = ref<HTMLElement | null>(null)
let streamTimer: ReturnType<typeof setInterval> | null = null
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
const HKEY = 'skill-plaza:history'

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

/* ---- 后端就绪探测：就绪则真实流式，否则演示输出 ---- */
const apiReady = ref(false)
const apiModel = ref('')
/** 每个对话对应一个 Pi 后端会话（多轮上下文保留）。 */
const convSessions = new Map<string, string>()
const convSlugs = new Map<number, string>()

async function probeApi() {
  const result = await checkHealth()
  apiReady.value = result.ok
  apiModel.value = result.ok ? (result.model ?? '') : ''
  if (result.ok) {
    MODELS[0].name = '智能体搭子 Agent（真实运行）'
  }
}

function scrollTop() {
  /* 整页滚动：滚到文档底部（输入框吸底在流下方） */
  nextTick(() => { window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }) })
}

/* ---- 历史对话：登录后持久化到 localStorage，未登录仅内存 ---- */
function persist() {
  if (!user.value) return
  try { localStorage.setItem(HKEY, JSON.stringify(conversations.value.slice(0, 20))) } catch { /* 忽略 */ }
}
function loadPersisted(): Conv[] {
  try {
    const raw = localStorage.getItem(HKEY)
    if (raw) return JSON.parse(raw) as Conv[]
  } catch { /* 忽略 */ }
  return []
}
watch(user, u => {
  if (u) {
    /* 登录：合并存储与内存对话（按 id 去重） */
    const stored = loadPersisted()
    const merged = [...conversations.value]
    for (const c of stored) if (!merged.some(m => m.id === c.id)) merged.push(c)
    conversations.value = merged.sort((a, b) => b.updatedAt - a.updatedAt)
    persist()
  } else {
    /* 退出：清空历史与存储 */
    conversations.value = []
    activeId.value = null
    messages.value = []
    try { localStorage.removeItem(HKEY) } catch { /* 忽略 */ }
  }
})

function stopTyping() {
  if (streamTimer) { clearInterval(streamTimer); streamTimer = null }
  const last = messages.value[messages.value.length - 1]
  if (last && last.role === 'ai' && !last.done) last.done = true
  sending.value = false
}
function syncToConv() {
  if (activeId.value === null) return
  const conv = conversations.value.find(c => c.id === activeId.value)
  if (conv) { conv.messages = messages.value.map(m => ({ ...m, done: true })); conv.updatedAt = Date.now() }
  persist()
}
function truncate(text: string, n: number) { return text.length > n ? text.slice(0, n) + '…' : text }

function newChat() {
  stopTyping()
  syncToConv()
  activeId.value = null
  messages.value = []
  textarea.value = ''
}
function openConv(id: number) {
  if (sending.value) return
  const conv = conversations.value.find(c => c.id === id)
  if (!conv) return
  stopTyping()
  syncToConv()
  activeId.value = id
  messages.value = conv.messages.map(m => ({ ...m, done: true }))
}
function delConv(id: number) {
  conversations.value = conversations.value.filter(c => c.id !== id)
  if (activeId.value === id) { activeId.value = null; messages.value = [] }
  persist()
}
function fmtTime(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (d.toDateString() === now.toDateString()) return hm
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return '昨天'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/* 侧栏按时间桶分组（今天 / 昨天 / 更早） */
const groupedConversations = computed(() => {
  const now = new Date()
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  const groups: { label: string; items: Conv[] }[] = [
    { label: '今天', items: [] },
    { label: '昨天', items: [] },
    { label: '更早', items: [] },
  ]
  for (const conv of conversations.value) {
    const d = new Date(conv.updatedAt)
    if (d.toDateString() === now.toDateString()) groups[0].items.push(conv)
    else if (d.toDateString() === yest.toDateString()) groups[1].items.push(conv)
    else groups[2].items.push(conv)
  }
  return groups.filter(g => g.items.length > 0)
})

/* ---- 发送 ---- */
function startAiMsg(skill: Skill | undefined, real: boolean): Msg {
  messages.value.push({ role: 'ai', text: '', skill, done: false, real })
  const msg = messages.value[messages.value.length - 1]
  scrollTop()
  syncToConv()
  return msg
}

/* 演示输出：逐字打字机效果 */
function typeInto(msg: Msg, reply: string) {
  if (reducedMotion.matches) {
    msg.text = reply
    msg.done = true
    sending.value = false
    syncToConv()
    return
  }
  streamTimer = setInterval(() => {
    msg.text = reply.slice(0, msg.text.length + 3)
    scrollTop()
    if (msg.text.length >= reply.length) {
      msg.text = reply
      msg.done = true
      sending.value = false
      if (streamTimer) { clearInterval(streamTimer); streamTimer = null }
      syncToConv()
    }
  }, 24)
}

/* 真实运行：走本地 Node 后端 → Pi，SSE 流式回填 */
async function runReal(text: string, slug: string, skill: Skill | undefined) {
  const convId = activeId.value
  const msg = startAiMsg(skill, true)
  if (convId === null) return
  convSlugs.set(convId, slug)
  const sessionKey = `pi:${convId}`
  beginRun()
  try {
    await streamChat({
      skill: slug,
      messages: [{ role: 'user', content: text }],
      sessionId: convSessions.get(sessionKey),
      onEvent: event => {
        if (event.type === 'started') {
          elapsedMs.value = Math.max(0, Date.now() - event.startedAt)
          runStatus.value = '正在启动运行环境…'
        } else if (event.type === 'session') {
          convSessions.set(sessionKey, event.sessionId)
        } else if (event.type === 'status') {
          if (event.phase === 'initializing') runStatus.value = event.message ?? '正在启动运行环境…'
          else if (event.phase === 'thinking') runStatus.value = `思考中 · ${event.chars ?? 0} 字`
          else if (event.phase === 'tool') runStatus.value = `调用工具 ${event.tool ?? ''}`
          else runStatus.value = '正在生成结果…'
        } else if (event.type === 'text') {
          msg.text += event.delta
          scrollTop()
        } else if (event.type === 'done') {
          if (!msg.text && event.content) msg.text = event.content
        } else if (event.type === 'error') {
          throw new Error(event.message)
        }
      },
    })
    msg.done = true
  } catch (error) {
    if (!msg.text) {
      /* 一字未出就失败：回落到演示输出，保证页面可用 */
      msg.real = false
      toast(error instanceof Error ? error.message : '真实运行失败，已切换为演示输出')
      const demo = DEMOS.find(d => d.slug === slug)
      typeInto(msg, demo ? demo.reply : FALLBACK)
      return
    }
    msg.done = true
  } finally {
    endRun()
    if (msg.done) {
      sending.value = false
      syncToConv()
    }
  }
}

function send(raw?: string) {
  const text = (raw ?? textarea.value).trim()
  if (!text || sending.value) return
  if (!user.value) toast('当前为未登录演示，登录后可保存体验记录')

  /* 无当前对话时新建一条历史 */
  if (activeId.value === null || !conversations.value.some(c => c.id === activeId.value)) {
    const conv: Conv = { id: Date.now(), title: truncate(text, 22), messages: [], updatedAt: Date.now() }
    conversations.value.unshift(conv)
    activeId.value = conv.id
  }
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
    const convId = activeId.value
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

onMounted(() => {
  document.addEventListener('click', onDocClick)
  if (user.value) conversations.value = loadPersisted()
  void probeApi()
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  if (streamTimer) clearInterval(streamTimer)
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
        <template v-for="group in groupedConversations" :key="group.label">
          <p class="exp-hist-group">{{ group.label }}</p>
          <div
            v-for="conv in group.items"
            :key="conv.id"
            class="exp-hist-item"
            :class="{ 'is-active': conv.id === activeId }"
            role="button"
            tabindex="0"
            :title="`${conv.title} · ${fmtTime(conv.updatedAt)}`"
            @click="openConv(conv.id)"
            @keydown.enter="openConv(conv.id)"
          >
            <Icon name="msg" :size="15" />
            <span class="exp-hist-title">{{ conv.title }}</span>
            <button type="button" class="exp-hist-del" aria-label="删除对话" @click.stop="delConv(conv.id)">
              <Icon name="x" :size="12" />
            </button>
          </div>
        </template>
        <p v-if="conversations.length === 0" class="exp-side-empty">{{ user ? '暂无历史对话' : '登录后可保存历史对话' }}</p>
      </div>
      <p v-if="!user" class="exp-side-login">
        <button type="button" class="text-btn" @click="openLogin">登录 →</button>
      </p>
    </aside>

    <div class="wrap-exp" :class="{ 'is-empty': messages.length === 0 }">
      <div class="exp-shell">
        <div class="exp-top" :class="{ 'is-compact': messages.length > 0 }">
          <h1 class="exp-title">智能体搭子，把产教领域的方法装进你的 AI</h1>
          <p class="exp-sub">默认由通用智能体直接回答，输入 $ 可挂载专业技能</p>
        </div>

        <div v-if="messages.length === 0" class="exp-examples">
          <span class="exp-examples-label">试试这些：</span>
          <button v-for="ex in EXAMPLES" :key="ex.slug" type="button" class="exp-example" @click="fill(ex.slug)">
            {{ ex.question }}
          </button>
        </div>

        <div v-if="messages.length > 0" ref="streamEl" class="exp-stream">
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
                <MarkdownView :text="msg.text" :streaming="!msg.done" />
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
