<script setup lang="ts">
import SiteHead from './components/SiteHead.vue'
import SiteFoot from './components/SiteFoot.vue'
import LoginModal from './components/LoginModal.vue'
import { toasts } from './composables/toast'
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()
const hideFoot = computed(() => route.name === 'experience')
</script>

<template>
  <!-- ============ 图标 ============ -->
  <svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
    <symbol id="i-industry" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 20.5V10l5-2.4V20.5" /><path d="M8 20.5V6.8l6.4 3v10.7" />
      <path d="M14.4 20.5v-6l6.6-3v9" /><path d="M2 20.5h20" />
    </symbol>
    <symbol id="i-teaching" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 7.2C10.2 5.7 7.6 5.1 4.5 5.4v11.7c3.1-.3 5.7.3 7.5 1.8 1.8-1.5 4.4-2.1 7.5-1.8V5.4c-3.1-.3-5.7.3-7.5 1.8Z" />
      <path d="M12 7.2v11.6" />
    </symbol>
    <symbol id="i-career" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="7.4" width="18" height="12.6" rx="2.6" />
      <path d="M8.6 7.4V6a2 2 0 0 1 2-2h2.8a2 2 0 0 1 2 2v1.4" /><path d="M3 12.6h18" />
    </symbol>
    <symbol id="i-data" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <ellipse cx="12" cy="5.8" rx="7.6" ry="2.9" />
      <path d="M4.4 5.8v6.1c0 1.6 3.4 2.9 7.6 2.9s7.6-1.3 7.6-2.9V5.8" />
      <path d="M4.4 11.9v6.1c0 1.6 3.4 2.9 7.6 2.9s7.6-1.3 7.6-2.9v-6.1" />
    </symbol>
    <symbol id="i-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 5.5l6.5 6.5L9 18.5" />
    </symbol>
    <symbol id="i-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4.5 12h14.5" /><path d="M13.5 6l6 6-6 6" />
    </symbol>
    <symbol id="i-chev-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5.5 9l6.5 6.5L18.5 9" />
    </symbol>
    <symbol id="i-back" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19.5 12H4.5" /><path d="M11 18.5L4.5 12 11 5.5" />
    </symbol>
    <symbol id="i-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="10.8" cy="10.8" r="6.3" /><path d="M15.5 15.5L20.5 20.5" />
    </symbol>
    <symbol id="i-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="10.8" cy="10.8" r="6.3" /><path d="M15.5 15.5L20.5 20.5" /><path d="M8.3 10.8h5" />
    </symbol>
    <symbol id="i-ext" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13.5 4H20v6.5" /><path d="M19.6 4.4l-8.4 8.4" />
      <path d="M18 14.2v4.3A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h4.3" />
    </symbol>
    <symbol id="i-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="11" height="11" rx="2.2" />
      <path d="M15 6.6V5.2A2.2 2.2 0 0 0 12.8 3H5.2A2.2 2.2 0 0 0 3 5.2v7.6A2.2 2.2 0 0 0 5.2 15h1.4" />
    </symbol>
    <symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4.5 12.5l5 5 10-11" />
    </symbol>
    <symbol id="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" />
    </symbol>
    <symbol id="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.2 14.8A8.6 8.6 0 0 1 9.2 3.8a8.6 8.6 0 1 0 11 11Z" />
    </symbol>
    <symbol id="i-note" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="8.4" /><path d="M12 11.2v5.2" /><path d="M12 7.9h.01" />
    </symbol>
    <symbol id="i-brand" viewBox="0 0 24 24">
      <path d="M12 3.2 20.8 8 12 12.8 3.2 8Z" fill="currentColor" />
      <path d="M4.8 13.4 12 17.2l7.2-3.8" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round" />
    </symbol>
    <symbol id="i-logo" viewBox="0 0 24 24">
      <!-- Skill搭子：两块拼图（页头品牌标） -->
      <g transform="rotate(-4 7.5 9)">
        <circle cx="7.5" cy="4.4" r="2.1" fill="#2E7CF6" />
        <rect x="2.6" y="4.8" width="10" height="10" rx="2.6" fill="#2E7CF6" />
      </g>
      <g transform="rotate(5 16.5 14.5)">
        <circle cx="16.4" cy="8.2" r="1.9" fill="#F6C21F" />
        <circle cx="20.6" cy="18.4" r="1.7" fill="#F6C21F" />
        <rect x="11" y="8.6" width="10" height="10" rx="2.6" fill="#F6C21F" />
      </g>
    </symbol>
    <linearGradient id="foru-scene-white" x1="0" y1="0" x2=".5" y2="1"><stop stop-color="#FFF" /><stop offset="1" stop-color="#DDE9F6" /></linearGradient>
    <linearGradient id="foru-scene-blue" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#A7E6FF" /><stop offset=".55" stop-color="#67ABFA" /><stop offset="1" stop-color="#3C65EF" /></linearGradient>
    <filter id="foru-scene-shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#6B9FE9" flood-opacity=".20" /></filter>
    <symbol id="foru-scene-ai" viewBox="0 0 360 310">
      <path d="m0 230 177-82 183 82v80H0Z" fill="url(#foru-scene-white)" />
      <path d="m-4 267 187-95 190 97M-4 285l187-95 190 97" fill="none" stroke="#D0DEEB" stroke-width="2" />
      <g filter="url(#foru-scene-shadow)">
        <ellipse cx="198" cy="238" rx="126" ry="44" fill="#85BDF4" />
        <ellipse cx="198" cy="230" rx="126" ry="44" fill="#EEF7FD" />
        <ellipse cx="198" cy="230" rx="110" ry="34" fill="#D8EAF9" />
        <path d="M198 94c-33-31-74-7-74 21-20 8-30 32-16 49-10 25 12 46 31 46l19 26h49l-2-33c20-3 34-20 25-36 26-10 26-40 7-48 3-20-15-30-39-25Z" fill="url(#foru-scene-blue)" />
        <path d="m175 118-8 27 16 13m-43-7 17 15-4 18m-16 3 16 9m57-60-18 13 5 15m-33 44 18-13m-50-87 12 7" fill="none" stroke="#407DE8" stroke-width="5" stroke-linecap="round" />
        <path d="m55 227 41-19 30 13-42 20Z" fill="#5BAAF3" />
        <path d="m59 225 1-31 36-16v30Z" fill="#8BD8FF" />
        <path d="m276 192 20-9 23 11-20 10Z" fill="#75C8FF" />
        <path d="m297 184 4-20 21 11-3 20Z" fill="#5D9CE8" />
        <path d="M198 233v15m-73-22-13 8m167-8 14 8" stroke="#B0CCE8" stroke-width="2" />
      </g>
    </symbol>
  </svg>

  <a class="skip" href="#main">跳至内容</a>

  <SiteHead />

  <main id="main" tabindex="-1">
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
    <noscript>
      <div class="wrap wrap-read">
        <p class="note">这份页面用 JavaScript 渲染 SKILL 清单、筛选和复制。请开启 JavaScript 后重新打开；页面不需要联网。</p>
      </div>
    </noscript>
  </main>

  <SiteFoot v-if="!hideFoot" />

  <LoginModal />

  <div class="toast-host" id="toast-host" aria-live="polite">
    <div v-for="t in toasts" :key="t.id" class="toast">{{ t.message }}</div>
  </div>

</template>

