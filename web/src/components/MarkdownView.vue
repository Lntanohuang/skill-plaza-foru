<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { renderMd } from '../utils/markdown'

const props = defineProps<{ text: string }>()

/* 流式输出按 token 更新；合并短时间窗口，避免每个 token 都重新解析整篇 Markdown。 */
const renderedText = ref(props.text ?? '')
let pendingText = renderedText.value
let renderTimer: ReturnType<typeof setTimeout> | null = null

function scheduleRender(next: string) {
  pendingText = next
  if (renderTimer !== null) return
  renderTimer = setTimeout(() => {
    renderTimer = null
    renderedText.value = pendingText
  }, 50)
}

watch(() => props.text ?? '', next => scheduleRender(next))

onBeforeUnmount(() => {
  if (renderTimer !== null) clearTimeout(renderTimer)
})

const html = computed(() => renderMd(renderedText.value))
</script>

<template>
  <div class="md-body" v-html="html"></div>
</template>
