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
</script>

<template>
  <p v-if="isHtml" class="report-ready">
    {{ reportUrl ? '就业指导报告已生成。' : '就业指导报告正在生成，完成后可查看。' }}
    <a v-if="reportUrl" :href="reportUrl">点击查看具体报告</a>
  </p>
  <MarkdownView v-else :class="{ 'is-streaming': streaming }" :text="text" />
  <div v-if="!isHtml && charts?.length" class="use-report-charts">
    <ReportChart v-for="chart in charts" :key="chart.id" :chart="chart" />
  </div>
</template>
