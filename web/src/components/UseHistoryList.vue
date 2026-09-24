<script setup lang="ts">
import { computed } from 'vue'
import { OUTCOME_LABEL, type RunListItem } from '../data/runsMock'
import { bySlug } from '../data/skills'

/* 在线运行历史选择器：只负责展示索引并把用户选择交给页面。详情由 UsePage 统一加载，
   避免在侧栏小区域展开长文本，也让表单/对话模式共享同一份历史结果状态。 */
const props = withDefaults(defineProps<{
  runs: RunListItem[]
  selectedId?: string | null
  disabled?: boolean
}>(), {
  selectedId: null,
  disabled: false,
})

const emit = defineEmits<{ select: [run: RunListItem] }>()

const skillName = (slug: string) => bySlug.get(slug)?.name ?? (slug === 'unknown' ? '历史会话' : slug)

function fmtTime(ts: string): string {
  const d = new Date(ts)
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`
}

const rows = computed(() => props.runs)
</script>

<template>
  <div class="use-hist-list" role="list" aria-label="历史运行记录">
    <div v-for="run in rows" :key="run.runId" class="use-hist-item"
      :class="{ 'is-selected': selectedId === run.runId }">
      <button type="button" class="use-hist-row" :disabled="disabled"
        @click="emit('select', run)">
        <strong class="use-hist-title">{{ run.promptDigest || '（无任务摘要）' }}</strong>
        <small class="use-hist-meta">
          <b>{{ skillName(run.skill) }}</b>
          <span>{{ fmtTime(run.ts) }}</span>
          <em class="runs-outcome" :class="`is-${run.outcome}`">{{ OUTCOME_LABEL[run.outcome] ?? run.outcome }}</em>
          <i v-if="selectedId === run.runId" class="use-hist-selected">已选</i>
        </small>
      </button>
    </div>
  </div>
</template>
