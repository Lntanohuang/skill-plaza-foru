<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 16 })
</script>

<template>
  <svg class="ic" :width="size" :height="size" aria-hidden="true"><use :href="`#i-${name}`" /></svg>
</template>
