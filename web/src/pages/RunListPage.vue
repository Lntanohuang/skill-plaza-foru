<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Icon from '../components/Icon.vue'
import { bySlug, GENERAL_SKILL_NAME } from '../data/skills'
import { OUTCOME_LABEL, type RunListItem, type RunOutcome } from '../data/runsMock'
import { fetchRuns, deleteRun } from '../api/runsApi'
import { toast } from '../composables/toast'

/* 运行记录：每次在线运行的 outcome / 用量 / 工具调用一览。
   数据来自后端 /api/runs（真实 trace）；后端未启动时回落演示数据。
   归档视图（?archived=1）可查看被侧栏归档的会话并删除单条记录。 */

const runs = ref<import('../data/runsMock').RunListItem[]>([])
const live = ref(false)
const loading = ref(true)
const viewMode = ref<'normal' | 'archived'>('normal')

async function load() {
  loading.value = true
  const result = await fetchRuns({ archived: viewMode.value === 'archived' })
  runs.value = result.runs
  live.value = result.live
  loading.value = false
}

onMounted(() => { void load() })

function toggleView() {
  viewMode.value = viewMode.value === 'archived' ? 'normal' : 'archived'
  skillFilter.value = 'all'
  outcomeFilter.value = 'all'
  confirmRunId.value = null
  void load()
}

/* 删除两步确认（与在线对话侧栏同款）：首击显确认态，2.5 秒内再击才执行 */
const confirmRunId = ref<string | null>(null)
let confirmTimer: ReturnType<typeof setTimeout> | null = null
function onDeleteRun(run: RunListItem) {
  if (confirmRunId.value !== run.runId) {
    confirmRunId.value = run.runId
    if (confirmTimer) clearTimeout(confirmTimer)
    confirmTimer = setTimeout(() => { confirmRunId.value = null }, 2500)
    return
  }
  if (confirmTimer) { clearTimeout(confirmTimer); confirmTimer = null }
  confirmRunId.value = null
  void runDelete(run)
}
async function runDelete(run: RunListItem) {
  if (!(await deleteRun(run.runId))) {
    toast('删除失败，请稍候重试')
    return
  }
  toast('运行记录已删除')
  void load()
}

const skillFilter = ref('all')
const outcomeFilter = ref<'all' | RunOutcome>('all')

const skillName = (slug: string) =>
  bySlug.get(slug)?.name ?? (slug === 'unknown' ? '历史会话' : slug === 'general' ? GENERAL_SKILL_NAME : slug)

const filtered = computed(() =>
  runs.value.filter(
    r =>
      (skillFilter.value === 'all' || r.skill === skillFilter.value) &&
      (outcomeFilter.value === 'all' || r.outcome === outcomeFilter.value),
  ),
)

const stats = computed(() => {
  const all = runs.value
  const finished = all.filter(r => r.outcome === 'success')
  const input = all.reduce((a, r) => a + (r.usage?.inputTokens ?? 0), 0)
  const cache = all.reduce((a, r) => a + (r.usage?.cacheReadTokens ?? 0), 0)
  return {
    total: all.length,
    successRate: all.length ? Math.round((finished.length / all.length) * 100) : 0,
    tools: all.reduce((a, r) => a + (r.toolCallCount ?? 0), 0),
    cacheRate: input ? Math.round((cache / input) * 100) : 0,
  }
})

const OUTCOME_ORDER: RunOutcome[] = ['success', 'timeout', 'aborted', 'error', 'historical']

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 1000)
  if (s < 90) return `${s}s`
  return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`
}

function fmtTokens(n?: number): string {
  if (!n) return '-'
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function fmtTime(ts: string): string {
  const d = new Date(ts)
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`
}

function outcomeRuns(o: RunOutcome): number {
  return runs.value.filter(r => r.outcome === o).length
}

/* 引擎徽标悬停提示：版本 · 模型 · 思考档位（无环境快照则不提示） */
function engineTitle(run: RunListItem): string | undefined {
  const env = run.agentEnv
  if (!env) return undefined
  return [env.agentVersion, env.model, env.thinking].filter(Boolean).join(' · ') || undefined
}
</script>

<template>
  <section class="page page-runs">
    <div class="wrap">
      <header class="runs-head">
        <div>
          <p class="use-eyebrow">评测与优化</p>
          <h1>运行记录</h1>
          <p class="runs-sub">每次在线运行的完整留痕：结果、时长、token 用量与工具调用，可点开查看逐步执行过程。</p>
        </div>
        <span class="runs-demo-tag" :class="{ 'is-live': live }">{{ live ? '实时数据' : '演示数据' }}</span>
      </header>

      <div class="runs-stats">
        <div class="runs-stat"><b>{{ stats.total }}</b><span>运行总数</span></div>
        <div class="runs-stat"><b>{{ stats.successRate }}%</b><span>成功率</span></div>
        <div class="runs-stat"><b>{{ stats.tools }}</b><span>工具调用</span></div>
        <div class="runs-stat"><b>{{ stats.cacheRate }}%</b><span>缓存命中率</span></div>
      </div>

      <div class="runs-filters">
        <label class="runs-filter">
          <span>SKILL</span>
          <select v-model="skillFilter">
            <option value="all">全部</option>
            <option v-for="run in runs.filter((r, i, arr) => arr.findIndex(x => x.skill === r.skill) === i)" :key="run.skill" :value="run.skill">{{ skillName(run.skill) }}</option>
          </select>
          <Icon name="chev-down" :size="14" />
        </label>
        <div class="runs-chips" role="group" aria-label="按结果筛选">
          <button type="button" class="runs-chip" :class="{ 'is-on': outcomeFilter === 'all' }" @click="outcomeFilter = 'all'">全部</button>
          <button
            v-for="o in OUTCOME_ORDER" :key="o" type="button" class="runs-chip"
            :class="[`is-${o}`, { 'is-on': outcomeFilter === o }]" @click="outcomeFilter = o">
            {{ OUTCOME_LABEL[o] }} {{ outcomeRuns(o) }}
          </button>
        </div>
        <button
          type="button" class="runs-chip runs-arch-toggle"
          :class="{ 'is-on': viewMode === 'archived' }"
          @click="toggleView"
        >
          <Icon name="archive" :size="13" />
          {{ viewMode === 'archived' ? '返回常规视图' : '归档视图' }}
        </button>
      </div>

      <div class="runs-table" :class="{ 'is-archived': viewMode === 'archived' }" role="table" aria-label="运行记录列表">
        <div class="runs-row runs-row-head" role="row">
          <span>时间</span><span>SKILL</span><span>任务</span><span>结果</span>
          <span>时长</span><span>输入 / 输出</span><span>缓存</span><span>工具</span>
          <span v-if="viewMode === 'archived'">操作</span>
        </div>
        <RouterLink
          v-for="run in filtered" :key="run.runId" class="runs-row" role="row"
          :to="{ name: 'runDetail', params: { runId: run.runId } }">
          <span class="runs-cell-time">{{ fmtTime(run.ts) }}</span>
          <span>{{ skillName(run.skill) }}<em v-if="run.engine" class="runs-engine" :class="`is-${run.engine}`" :title="engineTitle(run)">{{ run.engine }}</em></span>
          <span class="runs-cell-task" :title="run.promptDigest">{{ run.promptDigest }}</span>
          <span><em class="runs-outcome" :class="`is-${run.outcome}`">{{ OUTCOME_LABEL[run.outcome] }}</em></span>
          <span>{{ fmtDuration(run.durationMs) }}</span>
          <span class="runs-cell-tok">{{ fmtTokens(run.usage?.inputTokens) }} / {{ fmtTokens(run.usage?.outputTokens) }}</span>
          <span>{{ run.usage?.cacheReadTokens ? fmtTokens(run.usage.cacheReadTokens) : '-' }}</span>
          <span><b class="runs-tools">{{ run.toolCallCount ?? 0 }}</b></span>
          <span v-if="viewMode === 'archived'" class="runs-cell-act" @click.prevent.stop>
            <button
              type="button" class="runs-del"
              :class="{ 'is-confirm': confirmRunId === run.runId }"
              :title="confirmRunId === run.runId ? '再次点击确认删除' : '删除这条运行记录'"
              @click.prevent.stop="onDeleteRun(run)"
            >{{ confirmRunId === run.runId ? '确认删除' : '删除' }}</button>
          </span>
        </RouterLink>
        <p v-if="loading" class="runs-empty">正在读取运行记录…</p>
        <p v-else-if="filtered.length === 0" class="runs-empty">
          {{ viewMode === 'archived' ? '没有已归档的运行记录。' : '没有符合筛选条件的运行。' }}
        </p>
      </div>

      <p class="runs-note">
        列表对应后端 <code>traces/index.jsonl</code>；详情对应每次运行的权威导出。
        <template v-if="!live">当前后端未启动，显示为演示数据（取材自两次真实运行）。</template>
        <template v-else>数据实时来自本地后端；点任意运行查看逐步执行过程。</template>
      </p>
    </div>
  </section>
</template>
