<script setup lang="ts">
import { computed } from 'vue'
import type { ReportChart } from '../data/runsMock'

const props = defineProps<{ chart: ReportChart }>()

const rows = computed(() => props.chart.data.map((row, index) => ({
  label: String(row.label ?? row.name ?? row.date ?? row.x ?? index + 1),
  value: typeof row.value === 'number' ? row.value : Number(row.value ?? 0),
  code: row.code,
})).filter(row => Number.isFinite(row.value)))
const maxValue = computed(() => Math.max(...rows.value.map(row => row.value), 1))
const isBar = computed(() => ['bar', 'histogram', 'stackedBar'].includes(props.chart.type))
const unit = computed(() => props.chart.unit ?? props.chart.yAxis?.unit ?? '')
</script>

<template>
  <figure class="report-chart" :aria-label="chart.altText || chart.title">
    <figcaption>
      <strong>{{ chart.title }}</strong>
      <span v-if="chart.snapshotDate || chart.region">{{ [chart.region, chart.snapshotDate].filter(Boolean).join(' · ') }}</span>
    </figcaption>

    <div v-if="isBar && rows.length" class="report-chart-bars">
      <div v-for="row in rows" :key="row.label" class="report-chart-row">
        <span class="report-chart-label" :title="row.label">{{ row.label }}</span>
        <span class="report-chart-track"><i :style="{ width: `${Math.max(2, (row.value / maxValue) * 100)}%` }"></i></span>
        <b>{{ row.value }}{{ unit }}</b>
      </div>
    </div>
    <div v-else-if="rows.length" class="report-chart-data">
      <span v-for="row in rows" :key="row.label"><b>{{ row.label }}</b> {{ row.value }}{{ unit }}</span>
    </div>
    <p v-else class="report-chart-empty">暂无可绘制数据</p>

    <p v-if="chart.insight" class="report-chart-insight">{{ chart.insight }}</p>
    <p v-if="chart.caveat" class="report-chart-caveat">口径：{{ chart.caveat }}</p>
  </figure>
</template>
