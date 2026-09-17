<script setup lang="ts">
import { ref } from 'vue'
import { useCopy } from '../composables/useCopy'
import Icon from './Icon.vue'

const { copy } = useCopy()
const done = ref(false)

async function onClick() {
  const text = document.getElementById('install-text')?.textContent?.trim() ?? ''
  await copy(text, '已复制，发给你的 AI 工具即可安装')
  done.value = true
  setTimeout(() => { done.value = false }, 2200)
}
</script>

<template>
  <button type="button" class="install-btn" id="hero-copy" :class="{ 'is-done': done }" @click="onClick">
    <Icon v-if="done" name="check" :size="14" />{{ done ? '已复制' : '复制给 AI 安装' }}
  </button>
</template>
