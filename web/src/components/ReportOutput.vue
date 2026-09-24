<script setup lang="ts">
import { computed } from 'vue'
import HtmlReportView from './HtmlReportView.vue'
import MarkdownView from './MarkdownView.vue'
import ReportChart from './ReportChart.vue'
import type { ReportChart as ReportChartData } from '../data/runsMock'

const props = defineProps<{
  text: string
  charts?: ReportChartData[]
  streaming?: boolean
}>()

const isHtml = computed(() => /^\s*(?:<!doctype\s+html|<html[\s>])/i.test(props.text))
</script>

<template>
  <HtmlReportView v-if="isHtml" :html="text" />
  <MarkdownView v-else :class="{ 'is-streaming': streaming }" :text="text" />
  <div v-if="!isHtml && charts?.length" class="use-report-charts">
    <ReportChart v-for="chart in charts" :key="chart.id" :chart="chart" />
  </div>
</template>
