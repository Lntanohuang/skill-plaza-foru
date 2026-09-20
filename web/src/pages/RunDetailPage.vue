<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Icon from '../components/Icon.vue'
import { bySlug } from '../data/skills'
import { OUTCOME_LABEL, type RunDetail, type RunListItem, type RunToolPart } from '../data/runsMock'
import { fetchRunDetail, runFileUrl } from '../api/runsApi'

/* 运行详情：概要 + 用量条 + 工具执行时间线（可展开入参/输出）+ 对话流。
   数据来自 GET /api/runs/:runId（item = 索引记录，trace = 权威导出）；
   后端未启动时回落演示数据。 */

const route = useRoute()
const runId = computed(() => String(route.params.runId ?? ''))

const item = ref<RunListItem | undefined>()
const trace = ref<RunDetail | undefined>()
const live = ref(false)
const loading = ref(true)

async function load() {
  loading.value = true
  const result = await fetchRunDetail(runId.value)
  item.value = result.item
  trace.value = result.trace
  live.value = result.live
  loading.value = false
}
onMounted(load)
watch(runId, load)

const skillName = computed(() => {
  const slug = item.value?.skill ?? 'industry-education-report'
  const known = bySlug.get(slug)?.name
  if (known) return known
  return slug === 'unknown' || slug === 'historical' ? '历史会话' : slug
})

/* 时间线：从消息 parts 抽取工具调用（含入参/输出），按出现顺序 */
interface TimelineItem { part: RunToolPart; time: string }
const timeline = computed<TimelineItem[]>(() => {
  const items: TimelineItem[] = []
  for (const m of trace.value?.messages ?? []) {
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
function fmtTime(ts?: string): string {
  return ts ? ts.slice(11, 19) : '-'
}
function fmtIO(value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 1)
  return text.length > 500 ? text.slice(0, 500) + `\n…（共 ${text.length} 字符）` : text
}

const usagePct = computed(() => {
  const u = item.value?.usage ?? {}
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

const hasData = computed(() => Boolean(item.value && trace.value))
</script>

<template>
  <section class="page page-run-detail">
    <div class="wrap">
      <RouterLink class="crumb-back" :to="{ name: 'runs' }">
        <Icon name="back" :size="14" /> 返回运行记录
      </RouterLink>

      <p v-if="loading" class="rd-missing">正在读取运行详情…</p>

      <template v-else-if="hasData && item && trace">
        <header class="rd-head">
          <div class="rd-head-copy">
            <p class="use-eyebrow">{{ skillName }} · 执行详情</p>
            <h1>{{ trace.session.title }}</h1>
            <p class="rd-meta">
              会话 <code>{{ trace.session.id }}</code> · 沙箱 <code>{{ trace.session.workspace }}</code> ·
              {{ fmtTime(trace.session.created) }} → {{ fmtTime(trace.session.updated) }}（{{ fmtDuration(item.durationMs) }}）
            </p>
          </div>
          <span class="rd-head-badges">
            <em v-if="item.engine" class="runs-engine" :class="`is-${item.engine}`">{{ item.engine }}</em>
            <span class="runs-outcome rd-outcome" :class="`is-${item.outcome}`">{{ OUTCOME_LABEL[item.outcome] }}</span>
          </span>
        </header>

        <div class="rd-usage">
          <div class="rd-usage-bar" aria-hidden="true">
            <i class="rd-seg-cache" :style="{ width: usagePct.cache + '%' }"></i>
            <i class="rd-seg-input" :style="{ width: usagePct.input + '%' }"></i>
            <i class="rd-seg-output" :style="{ width: usagePct.output + '%' }"></i>
          </div>
          <div class="rd-usage-legend">
            <span><i class="rd-seg-cache"></i>缓存命中 {{ fmtTokens(item.usage?.cacheReadTokens) }}</span>
            <span><i class="rd-seg-input"></i>输入 {{ fmtTokens((item.usage?.inputTokens ?? 0) - (item.usage?.cacheReadTokens ?? 0)) }}</span>
            <span><i class="rd-seg-output"></i>输出 {{ fmtTokens(item.usage?.outputTokens) }}</span>
            <b>合计 {{ fmtTokens(item.usage?.totalTokens) }} tokens</b>
          </div>
        </div>

        <div v-if="item.report" class="rd-parse" :class="{ 'is-fail': !item.report.structurePass }">
          <div class="rd-parse-head">
            <h2>报告解析</h2>
            <em class="runs-outcome" :class="item.report.structurePass ? 'is-success' : 'is-error'">
              {{ item.report.structurePass ? '结构完整' : `缺 ${item.report.missingSections?.length ?? 0} 章` }}
            </em>
          </div>
          <ul class="rd-parse-stats">
            <li><b>{{ item.report.stats.sections }}</b><span>章节</span></li>
            <li><b>{{ item.report.stats.facts }}</b><span>事实</span></li>
            <li><b>{{ item.report.stats.inferences }}</b><span>推断</span></li>
            <li><b>{{ item.report.stats.recommendations }}</b><span>建议</span></li>
            <li><b>{{ item.report.stats.gaps }}</b><span>缺口</span></li>
            <li><b>{{ item.report.stats.sources }}</b><span>来源</span></li>
          </ul>
          <p v-if="item.report.missingSections?.length" class="rd-parse-missing">
            缺失：{{ item.report.missingSections.join('、') }}
          </p>
          <a v-if="item.files?.report" class="rd-parse-dl" :href="runFileUrl(runId, 'report')" target="_blank" rel="noopener">下载解析结果（JSON）</a>
        </div>

        <div class="rd-layout">
          <aside class="rd-timeline">
            <h2>工具执行（{{ timeline.length }}）</h2>
            <ol class="rd-steps">
              <li v-for="(entry, i) in timeline" :key="entry.part.callID" class="rd-step" :class="{ 'is-open': openTool === entry.part.callID }">
                <button type="button" class="rd-step-btn" @click="toggleTool(entry.part.callID)">
                  <span class="rd-step-no" :class="`is-${entry.part.state.status}`">{{ i + 1 }}</span>
                  <span class="rd-step-name">{{ entry.part.tool }}</span>
                  <span class="rd-step-status" :class="`is-${entry.part.state.status}`">{{ entry.part.state.status === 'completed' ? '完成' : entry.part.state.status === 'error' ? '失败' : entry.part.state.status }}</span>
                  <span class="rd-step-time">{{ fmtTime(entry.time) }}</span>
                  <svg class="ic" width="12" height="12" aria-hidden="true"><use href="#i-chev-down" /></svg>
                </button>
                <div v-if="openTool === entry.part.callID" class="rd-step-body">
                  <p v-if="fmtIO(entry.part.state.input)" class="rd-step-label">入参</p>
                  <pre v-if="fmtIO(entry.part.state.input)" class="rd-step-io">{{ fmtIO(entry.part.state.input) }}</pre>
                  <p v-if="fmtIO(entry.part.state.output)" class="rd-step-label">输出</p>
                  <pre v-if="fmtIO(entry.part.state.output)" class="rd-step-io">{{ fmtIO(entry.part.state.output) }}</pre>
                </div>
              </li>
            </ol>
          </aside>

          <main class="rd-stream">
            <h2>对话流</h2>
            <template v-for="(m, mi) in trace.messages" :key="mi">
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
            <div v-if="live && item.files" class="rd-files">
              <span class="rd-files-label">原始数据：</span>
              <a v-if="item.files.events" :href="runFileUrl(runId, 'events')" download>events.jsonl</a>
              <a v-if="item.files.trace" :href="runFileUrl(runId, 'trace')" download>trace.json</a>
              <a v-if="item.files.trace" :href="runFileUrl(runId, 'md')" download>trace.md</a>
            </div>
            <p v-else class="rd-note">演示数据不含原始文件下载；接入后端后每次运行可下载 events.jsonl / trace.json / trace.md。</p>
          </main>
        </div>
      </template>

      <div v-else class="rd-missing">
        <h1>该运行暂无详情</h1>
        <p>索引中找不到这次运行，或该运行还没有权威导出（历史早期运行）。</p>
        <RouterLink class="btn btn-primary" :to="{ name: 'runs' }">返回运行记录</RouterLink>
      </div>
    </div>
  </section>
</template>
