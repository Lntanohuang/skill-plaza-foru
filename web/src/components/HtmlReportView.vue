<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ html: string }>()

function stripFence(value: string): string {
  const trimmed = value.trim()
  const match = trimmed.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i)
  return match ? match[1].trim() : trimmed
}

const srcdoc = computed(() => {
  const body = stripFence(props.html)
  if (/<html[\s>]/i.test(body)) return body
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${body}</body></html>`
})
</script>

<template>
  <iframe
    class="html-report-frame"
    :srcdoc="srcdoc"
    sandbox=""
    title="就业指导报告"
  />
</template>
