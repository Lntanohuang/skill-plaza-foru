<script setup lang="ts">
import { computed } from 'vue'
import MarkdownView from './MarkdownView.vue'
import ReportChart from './ReportChart.vue'
import type { ReportChart as ReportChartData } from '../data/runsMock'

const props = defineProps<{
  text: string
  charts?: ReportChartData[]
  streaming?: boolean
  reportUrl?: string
  htmlMode?: boolean
}>()

const isHtml = computed(() => props.htmlMode || /^\s*(?:<!doctype\s+html|<html[\s>])/i.test(props.text))
const isRawHtml = computed(() => /^\s*(?:<!doctype\s+html|<html[\s>])/i.test(props.text))
const htmlStatus = computed(() => {
  if (props.reportUrl) return '就业指导报告已生成。'
  if (props.streaming) return '就业指导报告正在生成，完成后可查看。'
  /* 新协议的失败原因由服务端放在 done.content；旧记录的普通文本也应保留。 */
  if (props.text && !isRawHtml.value) return props.text
  return '报告未生成或没有保存查看链接，请重新运行。'
})
</script>

<template>
  <p v-if="isHtml" class="report-ready">
    {{ htmlStatus }}
    <a v-if="reportUrl" :href="reportUrl">点击查看具体报告</a>
  </p>
  <MarkdownView v-else :class="{ 'is-streaming': streaming }" :text="text" />
  <div v-if="!isHtml && charts?.length" class="use-report-charts">
    <ReportChart v-for="chart in charts" :key="chart.id" :chart="chart" />
  </div>
</template>
