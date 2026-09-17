<script setup lang="ts">
import { ref } from 'vue'
import { useCopy } from '../composables/useCopy'
import Icon from './Icon.vue'

withDefaults(defineProps<{
  label: string
  text: string
  message: string
  primary?: boolean
}>(), { primary: false })

const { copied, failed, copy } = useCopy()
const preEl = ref<HTMLElement | null>(null)
</script>

<template>
  <div class="codebox">
    <div class="codebox-head">
      <span class="codebox-label">{{ label }}</span>
      <button
        type="button"
        class="copy-btn"
        :class="{ 'is-primary': primary, 'is-done': copied }"
        @click="copy(text, message, preEl)"
      >
        <Icon :name="copied ? 'check' : 'copy'" :size="14" />{{ copied ? '已复制' : failed ? '请手动复制' : '复制' }}
      </button>
    </div>
    <pre ref="preEl">{{ text }}</pre>
  </div>
</template>
