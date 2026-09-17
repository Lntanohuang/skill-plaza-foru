<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '../components/Icon.vue'
import { bySlug } from '../data/skills'
import { RUNS_MOCK, OUTCOME_LABEL, type RunOutcome } from '../data/runsMock'

/* 运行记录：每次在线运行的 outcome / 用量 / 工具调用一览。
   当前为演示数据（runsMock.ts）；后端 /api/runs 就绪后切换数据源。 */

const skillFilter = ref('all')
const outcomeFilter = ref<'all' | RunOutcome>('all')

const skillName = (slug: string) => bySlug.get(slug)?.name ?? slug

const filtered = computed(() =>
  RUNS_MOCK.filter(
    r =>
      (skillFilter.value === 'all' || r.skill === skillFilter.value) &&
      (outcomeFilter.value === 'all' || r.outcome === outcomeFilter.value),
  ),
)

const stats = computed(() => {
  const runs = RUNS_MOCK
  const finished = runs.filter(r => r.outcome === 'success')
  const input = runs.reduce((a, r) => a + (r.usage?.inputTokens ?? 0), 0)
  const cache = runs.reduce((a, r) => a + (r.usage?.cacheReadTokens ?? 0), 0)
  return {
    total: runs.length,
    successRate: runs.length ? Math.round((finished.length / runs.length) * 100) : 0,
    tools: runs.reduce((a, r) => a + (r.toolCallCount ?? 0), 0),
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
  return RUNS_MOCK.filter(r => r.outcome === o).length
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
        <span class="runs-demo-tag">演示数据</span>
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
            <option v-for="run in RUNS_MOCK.filter((r, i, arr) => arr.findIndex(x => x.skill === r.skill) === i)" :key="run.skill" :value="run.skill">{{ skillName(run.skill) }}</option>
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
      </div>

      <div class="runs-table" role="table" aria-label="运行记录列表">
        <div class="runs-row runs-row-head" role="row">
          <span>时间</span><span>SKILL</span><span>任务</span><span>结果</span>
          <span>时长</span><span>输入 / 输出</span><span>缓存</span><span>工具</span>
        </div>
        <RouterLink
          v-for="run in filtered" :key="run.runId" class="runs-row" role="row"
          :to="{ name: 'runDetail', params: { runId: run.runId } }">
          <span class="runs-cell-time">{{ fmtTime(run.ts) }}</span>
          <span>{{ skillName(run.skill) }}</span>
          <span class="runs-cell-task" :title="run.promptDigest">{{ run.promptDigest }}</span>
          <span><em class="runs-outcome" :class="`is-${run.outcome}`">{{ OUTCOME_LABEL[run.outcome] }}</em></span>
          <span>{{ fmtDuration(run.durationMs) }}</span>
          <span class="runs-cell-tok">{{ fmtTokens(run.usage?.inputTokens) }} / {{ fmtTokens(run.usage?.outputTokens) }}</span>
          <span>{{ run.usage?.cacheReadTokens ? fmtTokens(run.usage.cacheReadTokens) : '-' }}</span>
          <span><b class="runs-tools">{{ run.toolCallCount ?? 0 }}</b></span>
        </RouterLink>
        <p v-if="filtered.length === 0" class="runs-empty">没有符合筛选条件的运行。</p>
      </div>

      <p class="runs-note">
        列表对应后端 <code>traces/index.jsonl</code>；详情对应每次运行的权威导出。当前页面为前端演示数据（取材自两次真实运行），
        后端 <code>/api/runs</code> 就绪后自动切换。
      </p>
    </div>
  </section>
</template>
