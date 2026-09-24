<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { bySlug, catOf, type Skill } from '../data/skills'
import { checkHealth, streamChat, type EngineId, type EngineInfo } from '../composables/useChatApi'
import Icon from '../components/Icon.vue'
import { useSession } from '../composables/session'
import { useCopy } from '../composables/useCopy'
import { toast } from '../composables/toast'

/* 在线体验：后端就绪时真实流式运行 SKILL（ZCode + GLM），
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

const FALLBACK = `这个问题需要在本地 AI 工具中调用对应的 SKILL 来完成。\n\n在线对话页展示的是各 SKILL 的结果形态（可点击上方示例问题查看）。要获得完整结果：\n\n1. 回到 SKILL 广场，找到匹配的 SKILL\n2. 复制安装提示词，发送给你的 AI 工具\n3. 用最小输入示例开始第一次运行`

const textarea = ref('')
const sending = ref(false)
/* 真实运行阶段实时状态（status 事件驱动）：思考/调工具/生成正文 */
const runStatus = ref('')
const messages = ref<Msg[]>([])
const activeId = ref<number | null>(null)
const conversations = ref<Conv[]>([])
const streamEl = ref<HTMLElement | null>(null)
let streamTimer: ReturnType<typeof setInterval> | null = null
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
const HKEY = 'skill-plaza:history'

/* 模型选择器：演示选项，仅影响显示 */
const MODELS = [
  { id: 'skill-agent', name: 'Skill搭子 Agent' },
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
}

const EXAMPLES = DEMOS.map(d => ({ slug: d.slug, question: d.question, skill: bySlug.get(d.slug) }))

/* ---- 后端就绪探测：就绪则真实流式，否则演示输出 ---- */
const apiReady = ref(false)
const apiModel = ref('')
const DEFAULT_SLUG = DEMOS[0].slug
/* 执行引擎：默认取后端 AGENT_RUNNER，可切换（切换后各对话走新后端会话） */
const engine = ref<EngineId>('pi')
const engines = ref<EngineInfo[]>([])
const engineOf = (id: EngineId) => engines.value.find(e => e.id === id)
function pickEngine(id: EngineId) {
  if (engineOf(id)?.available) engine.value = id
}
/** 每个对话对应一个后端会话（多轮上下文保留）；技能随对话固定；key 拼入引擎名，切换引擎自动开新会话 */
const convSessions = new Map<string, string>()
const convSlugs = new Map<number, string>()

async function probeApi() {
  const result = await checkHealth()
  apiReady.value = result.ok
  apiModel.value = result.ok ? (result.model ?? '') : ''
  if (result.ok) {
    MODELS[0].name = 'Skill搭子 Agent（真实运行）'
    engines.value = result.engines ?? []
    if (result.runner && engineOf(result.runner)?.available) engine.value = result.runner
  }
}

function matchDemo(text: string): Demo | null {
  const t = text.trim().toLowerCase()
  let best: { demo: Demo; score: number } | null = null
  for (const demo of DEMOS) {
    const skill = bySlug.get(demo.slug)
    if (!skill) continue
    let score = 0
    for (const kw of [skill.name, ...skill.tags, ...skill.compatibility]) {
      if (t.includes(kw.toLowerCase())) score += 2
    }
    for (const kw of demo.question.toLowerCase().split(/\s+/)) {
      if (kw.length > 2 && t.includes(kw)) score += 1
    }
    if (score > 0 && (!best || score > best.score)) best = { demo, score }
  }
  return best?.demo ?? null
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

/* 真实运行：走本地 Node 后端 → 所选引擎（pi/zcode），SSE 流式回填 */
async function runReal(text: string, slug: string, skill: Skill | undefined) {
  const convId = activeId.value
  const msg = startAiMsg(skill, true)
  if (convId === null) return
  convSlugs.set(convId, slug)
  const sessionKey = `${engine.value}:${convId}`
  try {
    await streamChat({
      skill: slug,
      messages: [{ role: 'user', content: text }],
      sessionId: convSessions.get(sessionKey),
      engine: engine.value,
      onEvent: event => {
        if (event.type === 'session') {
          convSessions.set(sessionKey, event.sessionId)
        } else if (event.type === 'status') {
          if (event.phase === 'thinking') runStatus.value = `思考中 · ${event.chars ?? 0} 字`
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

  messages.value.push({ role: 'user', text, done: true })
  textarea.value = ''
  sending.value = true
  runStatus.value = ''

  const demo = matchDemo(text)
  const skill = demo ? bySlug.get(demo.slug) : undefined
  const convId = activeId.value

  if (apiReady.value) {
    /* 首轮按内容匹配技能，后续轮沿用对话已固定的技能 */
    const slug = (convId !== null && convSlugs.get(convId)) || demo?.slug || DEFAULT_SLUG
    void runReal(text, slug, skill ?? bySlug.get(slug))
    return
  }
  typeInto(startAiMsg(skill, false), demo ? demo.reply : FALLBACK)
}

function fill(slug: string) {
  const demo = DEMOS.find(d => d.slug === slug)
  if (demo) textarea.value = demo.question
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
})
</script>

<template>
  <section class="page page-exp">
    <aside class="exp-side">
      <button type="button" class="exp-new" @click="newChat">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        新建对话
      </button>
      <p class="exp-side-label">最近对话</p>
      <div class="exp-history">
        <div
          v-for="conv in conversations"
          :key="conv.id"
          class="exp-hist-item"
          :class="{ 'is-active': conv.id === activeId }"
          role="button"
          tabindex="0"
          @click="openConv(conv.id)"
          @keydown.enter="openConv(conv.id)"
        >
          <span class="exp-hist-title">{{ conv.title }}</span>
          <span class="exp-hist-meta">
            <span class="exp-hist-time">{{ fmtTime(conv.updatedAt) }}</span>
            <button type="button" class="exp-hist-del" aria-label="删除对话" @click.stop="delConv(conv.id)">×</button>
          </span>
        </div>
        <p v-if="conversations.length === 0" class="exp-side-empty">{{ user ? '暂无历史对话' : '登录后可保存历史对话' }}</p>
      </div>
      <p v-if="!user" class="exp-side-login">
        <button type="button" class="text-btn" @click="openLogin">登录 →</button>
      </p>
    </aside>

    <div class="wrap-exp" :class="{ 'is-empty': messages.length === 0 }">
      <div class="exp-top" :class="{ 'is-compact': messages.length > 0 }">
        <h1 class="exp-title">Skill搭子，把产教领域的方法装进你的 AI</h1>
        <p class="exp-sub">输入你的问题，看看每个 SKILL 会产出什么样的结果</p>
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
            <div class="exp-ai-head">
              <span class="exp-ai-name">{{ msg.skill ? skillTitle(msg.skill.slug) : 'Skill搭子' }}</span>
              <span class="exp-ai-badge" :style="msg.skill ? { background: `var(--cat-${msg.skill.categoryId}-soft)`, color: `var(--cat-${msg.skill.categoryId})` } : {}">
                {{ msg.skill ? skillCat(msg.skill.slug) : (msg.real ? '在线' : '演示') }}
              </span>
              <template v-if="!msg.done">
                <span class="exp-typing" aria-label="正在输出"><i></i><i></i><i></i></span>
                <span v-if="runStatus" class="exp-run-status">{{ runStatus }}</span>
              </template>
              <span v-else class="exp-demo-tag" :class="{ 'is-real': msg.real }">{{ msg.real ? '真实运行' : '演示输出' }}</span>
            </div>
            <pre class="exp-ai-text">{{ msg.text }}<span v-if="!msg.done" class="exp-caret">▌</span></pre>
            <div v-if="msg.done && msg.skill" class="exp-ai-actions">
              <button type="button" class="exp-act exp-act-primary" @click="copyInstall(msg.skill.slug)">
                <Icon name="copy" :size="14" />复制安装提示词
              </button>
              <RouterLink class="exp-act" :to="`/skill/${msg.skill.slug}`">查看详情<Icon name="arrow" :size="14" /></RouterLink>
            </div>
            <p v-if="msg.done && !msg.real" class="exp-ai-note">演示输出仅展示结果形态，完整产物请在本地 AI 工具中运行获得。</p>
            <p v-else-if="msg.done" class="exp-ai-note">以上为 SKILL 真实运行输出（{{ engine }} · {{ apiModel || '本地 Agent' }}）。</p>
          </div>
        </template>
      </div>

      <div class="exp-input" :class="{ 'is-raised': messages.length > 0 }">
        <div class="exp-input-box">
          <textarea
            v-model="textarea"
            class="exp-textarea"
            rows="2"
            placeholder="输入你想完成的事，例如：帮我做一份产业决策报告…"
            @keydown.enter.exact.prevent="send()"
          ></textarea>
          <div class="exp-input-bar">
            <span class="exp-attach" title="演示环境不支持附件">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            </span>
            <span class="exp-agent">
              <span v-if="apiReady && engines.length > 1" class="engine-switch" role="group" aria-label="切换执行引擎">
                <button
                  v-for="e in engines" :key="e.id" type="button" class="engine-btn"
                  :class="{ 'is-on': e.id === engine }" :disabled="!e.available"
                  :title="e.available ? `引擎 ${e.id} · ${e.model ?? ''}` : `不可用：${e.reason ?? ''}`"
                  @click="pickEngine(e.id)">{{ e.id }}</button>
              </span>
              <span class="exp-model">
                <button type="button" class="exp-model-btn" :aria-expanded="modelOpen" aria-haspopup="menu" @click.stop="modelOpen = !modelOpen">
                  {{ model.name }}
                  <svg class="ic" width="13" height="13" aria-hidden="true"><use href="#i-chev-down" /></svg>
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
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
