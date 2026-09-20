<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SKILLS, bySlug, catOf } from '../data/skills'
import { configOf, type TaskField } from '../data/useTaskConfigs'
import { checkHealth, streamChat, type ApiState, type ChatMessage, type EngineId, type EngineInfo } from '../composables/useChatApi'
import { toast } from '../composables/toast'
import Icon from '../components/Icon.vue'

/* 「在线运行」工作台：结构化任务表单 + Mock 知识库选择 + 通过本地代理调用模型。
   页面只负责把任务边界写清楚；事实、推断与缺口由模型按 SKILL 规则处理。 */
const route = useRoute()
const router = useRouter()

const slug = computed(() => String(route.params.slug ?? ''))
const skill = computed(() => bySlug.get(slug.value) ?? SKILLS[0])
const config = computed(() => configOf(skill.value.slug) ?? configOf(SKILLS[0].slug)!)
const catName = computed(() => catOf(skill.value.categoryId).name)

type FormValues = Record<string, string | string[]>
const form = reactive<FormValues>({})
const knowledge = ref<string[]>([])
const keyword = ref('')
const apiState = ref<ApiState>('checking')
const modelName = ref('')
const busy = ref(false)
/* 执行引擎：默认取后端 AGENT_RUNNER，可按运行切换（切换后走新后端会话） */
const engine = ref<EngineId>('pi')
const engines = ref<EngineInfo[]>([])
const engineOf = (id: EngineId) => engines.value.find(e => e.id === id)
function pickEngine(id: EngineId) {
  if (engineOf(id)?.available) engine.value = id
}

interface RunMessage {
  role: 'user' | 'assistant' | 'error'
  content: string
  /** done 事件带回的最终一段文本（最后一条 assistant 消息）；有值时 content 的其余部分折叠为执行过程 */
  final?: string
}

/* 执行过程 = 全部流式文本去掉结尾的最终段（多轮工具执行时的旁白/边界复述） */
function procTextOf(msg: RunMessage): string {
  if (!msg.final) return ''
  const c = msg.content
  return (c.endsWith(msg.final) ? c.slice(0, c.length - msg.final.length) : c).trim()
}
/* 主结果 = 最终段；异常/中断（无 final）时退回整段 */
function mainTextOf(msg: RunMessage): string {
  return msg.final || msg.content
}
const sessions = reactive<Record<string, RunMessage[]>>({})
const session = computed<RunMessage[]>(() => sessions[skill.value.slug] ?? [])

/* ---------- 表单初始化 ---------- */
function resetForm() {
  for (const key of Object.keys(form)) delete form[key]
  for (const section of config.value.sections) {
    for (const field of section.fields) {
      form[field.id] = field.type === 'multi' ? [] : ''
    }
  }
  knowledge.value = config.value.knowledge.filter(item => item.default).map(item => item.id)
  keyword.value = ''
}

/* 表单必须同步初始化：首次渲染时就会读取必填进度，不能等到 onMounted */
watch(() => skill.value.slug, () => {
  resetForm()
  /* 配置了 autoFillExample 的 SKILL（如产教决策报告）进入页面即带入示例默认值 */
  if (config.value.autoFillExample) applyExample()
  void probe()
}, { immediate: true })

/* ---------- 必填与进度 ---------- */
const requiredFields = computed(() => config.value.sections.flatMap(s => s.fields).filter(f => f.required))
const multi = (id: string): string[] => (Array.isArray(form[id]) ? (form[id] as string[]) : [])
const filled = (field: TaskField) => {
  const value = form[field.id]
  return field.type === 'multi' ? multi(field.id).length > 0 : Boolean(String(value ?? '').trim())
}
const completed = computed(() => requiredFields.value.filter(filled).length)
const percent = computed(() =>
  requiredFields.value.length ? Math.round((completed.value / requiredFields.value.length) * 100) : 0)

const summaryRows = computed(() =>
  config.value.sections.flatMap(s => s.fields)
    .map(field => ({ label: field.label, value: valueLabel(field) }))
    .filter(row => row.value)
    .slice(0, 3))

function valueLabel(field: TaskField) {
  return Array.isArray(form[field.id]) ? multi(field.id).join('、') : String(form[field.id] ?? '').trim()
}

const canRun = computed(() => apiState.value === 'ready' && !busy.value)
const filteredKnowledge = computed(() => {
  const needle = keyword.value.trim().toLowerCase()
  if (!needle) return config.value.knowledge
  return config.value.knowledge.filter(item =>
    `${item.title} ${item.meta} ${item.tag}`.toLowerCase().includes(needle))
})

/* ---------- 交互 ---------- */
function applyExample() {
  for (const field of config.value.sections.flatMap(s => s.fields)) {
    const value = config.value.example[field.id]
    form[field.id] = Array.isArray(value) ? [...value] : (value ?? '')
  }
}

function fillExample() {
  applyExample()
  toast('示例信息已填入，可继续修改')
}

function clearForm() {
  resetForm()
  toast('表单已恢复为初始状态')
}

function toggleKnowledge(id: string) {
  knowledge.value = knowledge.value.includes(id)
    ? knowledge.value.filter(item => item !== id)
    : [...knowledge.value, id]
}

function toggleOption(fieldId: string, option: string) {
  const current = (form[fieldId] as string[]) ?? []
  form[fieldId] = current.includes(option)
    ? current.filter(item => item !== option)
    : [...current, option]
}

function buildPrompt(): string {
  const lines = config.value.sections.flatMap(s => s.fields)
    .map(field => (valueLabel(field) ? `- ${field.label}：${valueLabel(field)}` : ''))
    .filter(Boolean)
  const picked = config.value.knowledge
    .filter(item => knowledge.value.includes(item.id))
    .map(item => item.title)
  return [
    `使用 $${skill.value.identifier} 完成以下任务：`,
    ...lines,
    `- 可用知识库（当前为 Mock 选择）：${picked.length ? picked.join('、') : '未选择'}`,
    '',
    '请先复述任务边界与缺失信息，再按该 SKILL 的方法推进。',
  ].join('\n')
}

const missingField = computed(() => requiredFields.value.find(field => !filled(field)))

/* 注意：不能写 `sessions[slug] ?? (sessions[slug] = [])`——赋值表达式返回的是原始数组，
   往原始数组 push 不会触发响应式更新。必须先赋值，再通过代理读取。 */
function sessionOf(target: string): RunMessage[] {
  if (!sessions[target]) sessions[target] = []
  return sessions[target]
}

/* 后端按浏览器会话复用引擎会话（多轮上下文天然保留）；
   会话与引擎绑定，切换引擎自动开新会话（key 拼入引擎名） */
const sessionIds: Record<string, string> = {}
const sessionKey = (slug: string) => `${engine.value}:${slug}`
const lastUsage = ref('')

async function run() {
  if (busy.value) return
  if (!canRun.value) { toast('需要先启动本地服务'); return }
  if (missingField.value) {
    toast(`请先填写「${missingField.value.label}」`)
    return
  }
  const target = skill.value.slug
  const key = sessionKey(target)
  const list = sessionOf(target)
  list.push({ role: 'user', content: buildPrompt() })
  /* 先构造发往后端的消息（最后一条必须是刚加入的用户消息），再放流式占位 */
  const outgoing = list
    .filter(item => item.role === 'user' || item.role === 'assistant')
    .map(item => ({ role: item.role, content: item.content }))
  list.push({ role: 'assistant', content: '' })
  /* 必须通过响应式代理更新（push 后取回最后一个），直接改原始对象不会触发渲染 */
  const answer = list[list.length - 1]
  busy.value = true
  lastUsage.value = ''
  try {
    await streamChat({
      skill: target,
      messages: outgoing as ChatMessage[],
      sessionId: sessionIds[key],
      engine: engine.value,
      onEvent: event => {
        if (event.type === 'session') {
          sessionIds[key] = event.sessionId
        } else if (event.type === 'text') {
          answer.content += event.delta
        } else if (event.type === 'usage') {
          const u = event.usage as Record<string, number>
          const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
          lastUsage.value =
            `输入 ${k(u.inputTokens ?? 0)} · 输出 ${k(u.outputTokens ?? 0)} · 缓存命中 ${k(u.cacheReadTokens ?? 0)}`
        } else if (event.type === 'done') {
          if (event.content) answer.final = event.content
        } else if (event.type === 'error') {
          throw new Error(event.message)
        }
      },
    })
  } catch (error) {
    if (!answer.content) {
      list.splice(list.indexOf(answer), 1)
      list.push({ role: 'error', content: error instanceof Error ? error.message : '请求失败，请稍后重试。' })
    }
  } finally {
    busy.value = false
  }
}

function clearResult() {
  sessions[skill.value.slug] = []
}

async function probe() {
  apiState.value = 'checking'
  const result = await checkHealth()
  if (result.ok) {
    apiState.value = 'ready'
    modelName.value = result.model ?? ''
    engines.value = result.engines ?? []
    if (result.runner && engineOf(result.runner)?.available) engine.value = result.runner
    else if (!engineOf(engine.value)?.available) {
      const first = engines.value.find(e => e.available)
      if (first) engine.value = first.id
    }
    return
  }
  apiState.value = result.reason === 'nokey' ? 'nokey' : 'offline'
}

const statusText = computed(() => {
  if (apiState.value === 'checking') return '正在检查 API'
  if (apiState.value === 'ready') {
    const model = engineOf(engine.value)?.model ?? modelName.value
    return `API 已就绪${model ? ' · ' + model : ''}`
  }
  if (apiState.value === 'nokey') return '未读到模型配置'
  return '需要启动本地服务'
})

/* 各引擎的密钥/配置指引（nokey 或引擎不可用时展示） */
const engineHint = computed(() =>
  engine.value === 'pi'
    ? '确认启动后端的 shell 环境里有 DeepSeek Key（如 ~/.zshrc 的 DEEPSEEK_API_KEY），或将其写入 web/.env 后重启服务。'
    : '请确认 ~/.zcode/cli/config.json 已配置模型 provider（详见 server/samples/PROTOCOL.md），然后重启服务。')

const visibleMessages = computed(() => session.value.slice(-2))

function switchTo(target: string) {
  void router.push({ name: 'use', params: { slug: target } })
}

onMounted(() => {
  if (!slug.value || !configOf(slug.value)) {
    void router.replace({ name: 'use', params: { slug: SKILLS[0].slug } })
  }
})
</script>

<template>
  <section class="page page-use">
    <div class="wrap">
      <RouterLink class="crumb-back" :to="{ name: 'skills' }">
        <Icon name="back" :size="14" /> 返回 SKILL 广场
      </RouterLink>

      <header class="use-head">
        <span class="use-mark" :data-cat="skill.categoryId"><Icon :name="skill.categoryId" :size="22" /></span>
        <div class="use-head-copy">
          <p class="use-eyebrow">{{ config.eyebrow }} · {{ catName }}</p>
          <h1 class="use-name">{{ skill.name }}</h1>
          <p class="use-lead">{{ config.lead }}</p>
        </div>
        <div class="use-head-side">
          <div v-if="apiState === 'ready' && engines.length" class="engine-switch" role="group" aria-label="切换执行引擎">
            <button
              v-for="e in engines" :key="e.id" type="button" class="engine-btn"
              :class="{ 'is-on': e.id === engine }" :disabled="!e.available"
              :title="e.available ? `引擎 ${e.id} · ${e.model ?? ''}` : `不可用：${e.reason ?? ''}`"
              @click="pickEngine(e.id)">{{ e.id === 'pi' ? 'pi · DeepSeek' : 'zcode · GLM' }}</button>
          </div>
          <span class="use-api" :class="`is-${apiState}`"><i></i>{{ statusText }}</span>
          <RouterLink class="use-detail-link" :to="{ name: 'detail', params: { slug: skill.slug }, query: { from: 'use' } }">
            查看能力详情<Icon name="ext" :size="13" />
          </RouterLink>
        </div>
      </header>

      <div class="use-switch" role="group" aria-label="切换 SKILL">
        <button v-for="item in SKILLS" :key="item.slug" type="button" class="use-switch-btn"
          :class="{ 'is-on': item.slug === skill.slug }" :aria-pressed="item.slug === skill.slug"
          @click="switchTo(item.slug)">{{ item.name }}</button>
      </div>

      <ol class="use-steps">
        <li :class="{ 'is-on': completed > 0 }"><b>1</b>配置任务</li>
        <li :class="{ 'is-on': knowledge.length > 0 }"><b>2</b>选择知识库</li>
        <li :class="{ 'is-on': session.length > 0 }"><b>3</b>确认并运行</li>
      </ol>

      <p v-if="apiState === 'offline'" class="use-setup">
        <strong>在线运行需要本地后端。</strong>
        在 <code>web/</code> 目录执行 <code>npm run server</code> 后刷新页面；表单与 Mock 知识库仍可正常预览。
        <button type="button" class="text-btn" @click="probe">重新检查</button>
      </p>
      <p v-else-if="apiState === 'nokey'" class="use-setup">
        <strong>本地服务已启动，但没有读到模型配置。</strong>
        {{ engineHint }}
        <button type="button" class="text-btn" @click="probe">重新检查</button>
      </p>

      <div class="use-layout">
        <main class="use-builder">
          <form id="skill-task-form" class="use-form" @submit.prevent="run">
            <section v-for="section in config.sections" :key="section.number" class="use-section">
              <header class="use-section-head">
                <span class="use-section-no">{{ section.number }}</span>
                <div>
                  <h2>{{ section.title }}</h2>
                  <p>{{ section.description }}</p>
                </div>
              </header>

              <div class="use-fields">
                <template v-for="field in section.fields" :key="field.id">
                  <fieldset v-if="field.type === 'choice' || field.type === 'multi'"
                    class="use-field" :class="{ 'is-full': field.span === 'full' }">
                    <legend>{{ field.label }}<em v-if="field.required">必填</em></legend>
                    <div class="use-options">
                      <label v-for="option in field.options" :key="option" class="use-option"
                        :class="{ 'is-on': field.type === 'multi'
                          ? multi(field.id).includes(option)
                          : form[field.id] === option }">
                        <input v-if="field.type === 'multi'" type="checkbox" :value="option"
                          :checked="multi(field.id).includes(option)"
                          @change="toggleOption(field.id, option)" />
                        <input v-else type="radio" :name="field.id" :value="option"
                          :checked="form[field.id] === option" @change="form[field.id] = option" />
                        <span>{{ option }}</span>
                      </label>
                    </div>
                    <small v-if="field.help">{{ field.help }}</small>
                  </fieldset>

                  <label v-else-if="field.type === 'select'"
                    class="use-field" :class="{ 'is-full': field.span === 'full' }">
                    <span class="use-label">{{ field.label }}<em v-if="field.required">必填</em></span>
                    <span class="use-select">
                      <select :value="form[field.id] as string" @change="form[field.id] = ($event.target as HTMLSelectElement).value">
                        <option value="" disabled>请选择</option>
                        <option v-for="option in field.options" :key="option" :value="option">{{ option }}</option>
                      </select>
                      <Icon name="chev-down" :size="14" />
                    </span>
                    <small v-if="field.help">{{ field.help }}</small>
                  </label>

                  <label v-else-if="field.type === 'textarea'"
                    class="use-field" :class="{ 'is-full': field.span === 'full' }">
                    <span class="use-label">{{ field.label }}<em v-if="field.required">必填</em></span>
                    <textarea class="use-textarea" rows="4" maxlength="8000" :placeholder="field.placeholder"
                      :value="form[field.id] as string" @input="form[field.id] = ($event.target as HTMLTextAreaElement).value"></textarea>
                    <small v-if="field.help">{{ field.help }}</small>
                  </label>

                  <label v-else class="use-field" :class="{ 'is-full': field.span === 'full' }">
                    <span class="use-label">{{ field.label }}<em v-if="field.required">必填</em></span>
                    <input class="use-input" type="text" maxlength="500" :placeholder="field.placeholder"
                      :value="form[field.id] as string" @input="form[field.id] = ($event.target as HTMLInputElement).value" />
                    <small v-if="field.help">{{ field.help }}</small>
                  </label>
                </template>
              </div>
            </section>

            <section class="use-result" aria-live="polite">
              <header class="use-result-head">
                <div>
                  <span>运行结果</span>
                  <h2>{{ busy ? '正在调用 SKILL' : (session.length ? '本次运行已返回' : '尚未运行') }}</h2>
                </div>
                <button v-if="session.length && !busy" type="button" class="text-btn" @click="clearResult">清除结果</button>
              </header>

              <div v-if="visibleMessages.length || busy" class="use-result-body">
                <template v-for="(msg, i) in visibleMessages" :key="i">
                  <details v-if="msg.role === 'user'" class="use-task">
                    <summary>查看本次提交的结构化任务</summary>
                    <pre>{{ msg.content }}</pre>
                  </details>
                  <article v-else class="use-answer" :class="{ 'is-error': msg.role === 'error' }">
                    <span class="use-answer-mark">{{ msg.role === 'error' ? '!' : 'AI' }}</span>
                    <div>
                      <strong>{{ msg.role === 'error' ? '请求未完成' : skill.name }}</strong>
                      <details v-if="procTextOf(msg)" class="use-proc"
                        :open="busy && !msg.final && i === visibleMessages.length - 1">
                        <summary>执行过程（{{ procTextOf(msg).length }} 字）</summary>
                        <pre>{{ procTextOf(msg) }}</pre>
                      </details>
                      <p class="use-answer-text">{{ mainTextOf(msg) }}<span v-if="busy && !msg.final && i === visibleMessages.length - 1" class="use-caret">▌</span></p>
                      <small v-if="msg.role === 'assistant' && lastUsage && !busy" class="use-usage">{{ lastUsage }}</small>
                    </div>
                  </article>
                </template>
                <p v-if="busy" class="use-loading"><i></i>正在读取配置与知识库选择，生成结果…</p>
              </div>
              <p v-else class="use-result-empty">填写左侧任务信息后，运行结果会显示在这里。</p>
            </section>
          </form>
        </main>

        <aside class="use-side">
          <section class="card use-knowledge">
            <header class="use-side-head">
              <div>
                <span>知识库</span>
                <h2>选择参考资料</h2>
              </div>
              <b>Mock</b>
            </header>
            <p class="use-side-note">选择本次允许 SKILL 使用的资料范围。当前仅演示前端状态，不会上传或读取真实文档。</p>
            <label class="use-kb-search">
              <Icon name="search" :size="15" />
              <input v-model="keyword" type="search" placeholder="搜索知识库" aria-label="搜索知识库" />
            </label>
            <div class="use-kb-list">
              <label v-for="item in filteredKnowledge" :key="item.id" class="use-kb-item"
                :class="{ 'is-on': knowledge.includes(item.id) }">
                <input type="checkbox" :checked="knowledge.includes(item.id)" @change="toggleKnowledge(item.id)" />
                <span class="use-kb-check"><Icon name="check" :size="11" /></span>
                <span class="use-kb-copy">
                  <strong>{{ item.title }}</strong>
                  <small>{{ item.meta }}</small>
                </span>
                <em>{{ item.tag }}</em>
              </label>
              <p v-if="!filteredKnowledge.length" class="use-kb-empty">没有匹配的知识库</p>
            </div>
            <button type="button" class="use-kb-add" @click="toast('当前为前端 Mock，真实知识库接入将在下一阶段完成')">添加知识库</button>
          </section>

          <section class="card use-run">
            <div class="use-run-progress">
              <span>已完成 {{ completed }} / {{ requiredFields.length }} 项必填信息</span>
              <b>已选 {{ knowledge.length }} 个知识库</b>
            </div>
            <div class="use-track" role="progressbar" aria-label="任务信息完成度"
              aria-valuemin="0" aria-valuemax="100" :aria-valuenow="percent"><i :style="{ width: percent + '%' }"></i></div>
            <h3>执行摘要</h3>
            <ul class="use-summary">
              <li v-for="row in summaryRows" :key="row.label"><span>{{ row.label }}</span><strong>{{ row.value }}</strong></li>
              <li v-if="!summaryRows.length" class="is-empty">填写任务信息后，这里会生成执行摘要。</li>
            </ul>
            <p class="use-output"><span>预计产出</span><strong>{{ config.output }}</strong></p>
            <!-- 按钮在表单外的侧栏中，靠 form 属性关联提交 -->
            <button type="submit" form="skill-task-form" class="btn btn-primary use-run-btn" :disabled="!canRun">
              开始运行 SKILL<Icon name="arrow" :size="15" />
            </button>
            <div class="use-run-sub">
              <button type="button" class="btn btn-quiet use-run-quiet" @click="fillExample">填入示例</button>
              <button type="button" class="btn btn-quiet use-run-quiet" @click="clearForm">重置表单</button>
            </div>
            <small class="use-run-note">提交前请确认资料授权范围，不要填写敏感个人信息。</small>
          </section>
        </aside>
      </div>
    </div>
  </section>
</template>
