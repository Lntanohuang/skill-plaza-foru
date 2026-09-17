<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import Icon from '../components/Icon.vue'
import { bySlug } from '../data/skills'
import { RUN_DETAILS_MOCK, RUNS_MOCK, OUTCOME_LABEL, type RunDetail, type RunToolPart } from '../data/runsMock'

/* 运行详情：概要 + 用量条 + 工具执行时间线（可展开入参/输出）+ 对话流。
   当前为演示数据；后端 GET /api/runs/:runId 就绪后切换。 */

const route = useRoute()
const runId = computed(() => String(route.params.runId ?? ''))

const detail = computed<RunDetail | undefined>(() => RUN_DETAILS_MOCK[runId.value])
const listItem = computed(() => RUNS_MOCK.find(r => r.runId === runId.value))

const skillName = computed(() => {
  const slug = listItem.value?.skill ?? 'industry-education-report'
  return bySlug.get(slug)?.name ?? slug
})

/* 时间线：从消息 parts 抽取工具调用（含入参/输出），按出现顺序 */
interface TimelineItem { part: RunToolPart; time: string }
const timeline = computed<TimelineItem[]>(() => {
  const items: TimelineItem[] = []
  for (const m of detail.value?.messages ?? []) {
    for (const p of m.parts ?? []) {
      if (p.type === 'tool') items.push({ part: p, time: m.time })
    }
  }
  return items
})

const openTool = ref<string | null>(null)
function toggleTool(callID: string) {
  openTool.value = openTool.value === callID ? null : callID
}

function partText(part: { type: string; text?: string }): string {
  return part.text ?? ''
}

function fmtDuration(ms?: number): string {
  if (ms === undefined) return '-'
  const s = Math.round(ms / 1000)
  if (s < 90) return `${s}s`
  return `${Math.floor(s / 60)} 分 ${s % 60} 秒`
}
function fmtTokens(n?: number): string {
  if (!n) return '0'
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}
function fmtTime(ts: string): string {
  return ts.slice(11, 19)
}
function fmtIO(value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 1)
  return text.length > 500 ? text.slice(0, 500) + `\n…（共 ${text.length} 字符）` : text
}

const usagePct = computed(() => {
  const u = detail.value?.usage ?? {}
  const input = u.inputTokens ?? 0
  const cache = Math.min(u.cacheReadTokens ?? 0, input)
  const output = u.outputTokens ?? 0
  const total = input + output || 1
  return {
    cache: Math.round((cache / total) * 100),
    input: Math.round(((input - cache) / total) * 100),
    output: Math.round((output / total) * 100),
  }
})
</script>

<template>
  <section class="page page-run-detail">
    <div class="wrap">
      <RouterLink class="crumb-back" :to="{ name: 'runs' }">
        <Icon name="back" :size="14" /> 返回运行记录
      </RouterLink>

      <template v-if="detail">
        <header class="rd-head">
          <div class="rd-head-copy">
            <p class="use-eyebrow">{{ skillName }} · 执行详情</p>
            <h1>{{ detail.session.title }}</h1>
            <p class="rd-meta">
              会话 <code>{{ detail.session.id }}</code> · 沙箱 <code>{{ detail.session.workspace }}</code> ·
              {{ fmtTime(detail.session.created) }} → {{ fmtTime(detail.session.updated) }}（{{ fmtDuration(listItem?.durationMs) }}）
            </p>
          </div>
          <span class="runs-outcome rd-outcome" :class="`is-${detail.outcome}`">{{ OUTCOME_LABEL[detail.outcome] }}</span>
        </header>

        <div class="rd-usage">
          <div class="rd-usage-bar" aria-hidden="true">
            <i class="rd-seg-cache" :style="{ width: usagePct.cache + '%' }"></i>
            <i class="rd-seg-input" :style="{ width: usagePct.input + '%' }"></i>
            <i class="rd-seg-output" :style="{ width: usagePct.output + '%' }"></i>
          </div>
          <div class="rd-usage-legend">
            <span><i class="rd-seg-cache"></i>缓存命中 {{ fmtTokens(detail.usage?.cacheReadTokens) }}</span>
            <span><i class="rd-seg-input"></i>输入 {{ fmtTokens((detail.usage?.inputTokens ?? 0) - (detail.usage?.cacheReadTokens ?? 0)) }}</span>
            <span><i class="rd-seg-output"></i>输出 {{ fmtTokens(detail.usage?.outputTokens) }}</span>
            <b>合计 {{ fmtTokens(detail.usage?.totalTokens) }} tokens</b>
          </div>
        </div>

        <div class="rd-layout">
          <aside class="rd-timeline">
            <h2>工具执行（{{ timeline.length }}）</h2>
            <ol class="rd-steps">
              <li v-for="(item, i) in timeline" :key="item.part.callID" class="rd-step" :class="{ 'is-open': openTool === item.part.callID }">
                <button type="button" class="rd-step-btn" @click="toggleTool(item.part.callID)">
                  <span class="rd-step-no" :class="`is-${item.part.state.status}`">{{ i + 1 }}</span>
                  <span class="rd-step-name">{{ item.part.tool }}</span>
                  <span class="rd-step-status" :class="`is-${item.part.state.status}`">{{ item.part.state.status === 'completed' ? '完成' : item.part.state.status === 'error' ? '失败' : item.part.state.status }}</span>
                  <span class="rd-step-time">{{ fmtTime(item.time) }}</span>
                  <svg class="ic" width="12" height="12" aria-hidden="true"><use href="#i-chev-down" /></svg>
                </button>
                <div v-if="openTool === item.part.callID" class="rd-step-body">
                  <p v-if="fmtIO(item.part.state.input)" class="rd-step-label">入参</p>
                  <pre v-if="fmtIO(item.part.state.input)" class="rd-step-io">{{ fmtIO(item.part.state.input) }}</pre>
                  <p v-if="fmtIO(item.part.state.output)" class="rd-step-label">输出</p>
                  <pre v-if="fmtIO(item.part.state.output)" class="rd-step-io">{{ fmtIO(item.part.state.output) }}</pre>
                </div>
              </li>
            </ol>
          </aside>

          <main class="rd-stream">
            <h2>对话流</h2>
            <template v-for="(m, mi) in detail.messages" :key="mi">
              <article v-if="(m.parts ?? []).some(p => p.type === 'text')" class="rd-msg" :class="`is-${m.role}`">
                <span class="rd-msg-role">{{ m.role === 'user' ? '任务' : 'AI' }}</span>
                <div class="rd-msg-body">
                  <template v-for="(p, pi) in m.parts" :key="pi">
                    <pre v-if="p.type === 'text'" class="rd-msg-text">{{ partText(p) }}</pre>
                    <details v-else-if="p.type === 'reasoning'" class="rd-reasoning">
                      <summary>思考过程</summary>
                      <pre>{{ partText(p) }}</pre>
                    </details>
                  </template>
                </div>
              </article>
            </template>
            <p class="rd-note">
              数据对应后端权威导出（消息 / 内容块 / 工具调用）。原始文件（events.jsonl / trace.json / markdown）下载入口在后端 API 就绪后提供。
            </p>
          </main>
        </div>
      </template>

      <div v-else class="rd-missing">
        <h1>该运行暂无详情</h1>
        <p>演示数据只包含两条完整详情（成功交付的产教报告与取证超时运行）。后端接入后，每次运行都可点开。</p>
        <RouterLink class="btn btn-primary" :to="{ name: 'runs' }">返回运行记录</RouterLink>
      </div>
    </div>
  </section>
</template>
