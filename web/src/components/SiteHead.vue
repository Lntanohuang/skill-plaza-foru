<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSession } from '../composables/session'
import { SKILLS, catOf } from '../data/skills'
import Icon from './Icon.vue'

/* 角色入口：与原版一致的分组与描述，链接到对应工作台 */
const ROLES: { label: string; items: [slug: string, description: string][] }[] = [
  { label: '院校管理者', items: [['industry-education-report', '产业与专业建设'], ['classroom-assistant', '课程实施支持']] },
  { label: '教师', items: [['classroom-assistant', '课程与教学开发'], ['ai-interview', '学生就业训练']] },
  { label: '学生', items: [['ai-interview', '面试练习与复盘'], ['classroom-assistant', '课程答疑与练习']] },
  { label: '数据团队', items: [['training-data-qa', '数据治理与质检'], ['industry-education-report', '决策数据分析']] },
]

const roleSkill = (slug: string) => {
  const skill = SKILLS.find(item => item.slug === slug)
  return skill ? { name: skill.name, catId: catOf(skill.categoryId).id } : null
}

const route = useRoute()
const open = ref(false)
const isDark = ref(document.documentElement.getAttribute('data-mode') === 'dark')
const navToggle = ref<HTMLButtonElement | null>(null)
const menuOpen = ref(false)
const roleOpen = ref(false)
const scrolled = ref(false)
const { user, openLogin, logout } = useSession()

/* 滚动后头部切换为液态玻璃；首屏顶部保持透明 */
function onScroll() { scrolled.value = window.scrollY > 12 }

const maskedPhone = () => {
  const p = user.value?.phone ?? ''
  return p.length === 11 ? `${p.slice(0, 3)}****${p.slice(7)}` : p
}

function toggleMenu() { menuOpen.value = !menuOpen.value }
function closeMenu() { menuOpen.value = false }
function onLogout() { logout(); closeMenu() }
function toggleRole() { roleOpen.value = !roleOpen.value }
function closeRole() { roleOpen.value = false }

function applyMode(mode: 'dark' | 'light') {
  if (mode === 'dark') document.documentElement.setAttribute('data-mode', 'dark')
  else document.documentElement.removeAttribute('data-mode')
  isDark.value = mode === 'dark'
  try { localStorage.setItem('skill-plaza:mode', mode) } catch { /* 忽略 */ }
}

function toggleMode() {
  applyMode(isDark.value ? 'light' : 'dark')
}

function closeNav(restore = false) {
  if (!open.value) return
  open.value = false
  document.body.style.overflow = ''
  if (restore) navToggle.value?.focus()
}

function toggleNav() {
  if (open.value) { closeNav(true); return }
  open.value = true
  document.body.style.overflow = 'hidden'
  document.querySelector<HTMLAnchorElement>('#site-nav a')?.focus()
}

function onDocClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (menuOpen.value && !target?.closest('.user-wrap')) closeMenu()
  if (roleOpen.value && !target?.closest('.role-wrap')) closeRole()
  if (!open.value) return
  const head = document.getElementById('site-head')
  if (head && !target?.closest('#site-head')) closeNav()
}

const onMedia = () => closeNav()
let media: MediaQueryList | undefined
onMounted(() => {
  document.addEventListener('click', onDocClick)
  media = matchMedia('(min-width: 901px)')
  media.addEventListener('change', onMedia)
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  media?.removeEventListener('change', onMedia)
  window.removeEventListener('scroll', onScroll)
})

/* 路由变化收起移动菜单、用户菜单与角色菜单 */
watch(() => route.fullPath, () => { closeNav(); closeMenu(); closeRole() })
</script>

<template>
  <header class="site-head" id="site-head" :class="{ 'is-open': open, 'is-scrolled': scrolled || open }">
    <div class="wrap head-inner">
      <RouterLink class="brand" to="/">
        <span class="brand-mark"><img src="/logo.png" alt="Skill搭子"></span>
      </RouterLink>
      <button ref="navToggle" id="nav-toggle" class="nav-toggle" aria-expanded="false" aria-controls="head-panel" @click="toggleNav">
        {{ open ? '关闭' : '菜单' }}
      </button>
      <div class="head-panel" id="head-panel">
        <nav class="site-nav" id="site-nav" aria-label="主导航">
          <RouterLink to="/" :aria-current="route.name === 'home' ? 'page' : undefined">首页</RouterLink>
          <div class="role-wrap" @keydown.escape="closeRole">
            <button type="button" class="role-btn" :class="{ 'is-on': roleOpen }" :aria-expanded="roleOpen" aria-haspopup="menu" @click="toggleRole">
              角色入口
              <svg class="ic" width="14" height="14" aria-hidden="true"><use href="#i-chev-down" /></svg>
            </button>
            <div v-if="roleOpen" class="role-menu" role="menu">
              <div v-for="role in ROLES" :key="role.label" class="role-group">
                <h3>面向{{ role.label }}</h3>
                <RouterLink v-for="[slug, description] in role.items" :key="slug + description" class="role-item" role="menuitem"
                  :to="{ name: 'use', params: { slug } }">
                  <span v-if="roleSkill(slug)" class="role-item-icon" :data-cat="roleSkill(slug)!.catId">
                    <Icon :name="roleSkill(slug)!.catId" :size="17" />
                  </span>
                  <span class="role-item-copy">
                    <strong>{{ roleSkill(slug)?.name }}</strong>
                    <small>{{ description }}</small>
                  </span>
                </RouterLink>
              </div>
            </div>
          </div>
          <RouterLink to="/skills" :aria-current="route.name === 'skills' || route.name === 'detail' ? 'page' : undefined">SKILL 广场</RouterLink>
          <RouterLink to="/use" :aria-current="route.name === 'use' ? 'page' : undefined">在线运行</RouterLink>
          <RouterLink to="/experience" :aria-current="route.name === 'experience' ? 'page' : undefined">在线对话</RouterLink>
          <RouterLink to="/runs" :aria-current="route.name === 'runs' || route.name === 'runDetail' ? 'page' : undefined">运行记录</RouterLink>
          <RouterLink to="/guide" :aria-current="route.name === 'guide' ? 'page' : undefined">使用指南</RouterLink>
        </nav>
        <div class="head-tools">
          <RouterLink class="text-btn" to="/guide">怎么用？</RouterLink>
          <button type="button" class="icon-btn" id="mode-toggle" :aria-pressed="isDark" @click="toggleMode">
            <svg class="ic" width="18" height="18" aria-hidden="true"><use :href="isDark ? '#i-sun' : '#i-moon'" /></svg>
            <span class="vh">{{ isDark ? '切换浅色模式' : '切换深色模式' }}</span>
          </button>

          <template v-if="user">
            <div class="user-wrap" @keydown.escape="closeMenu">
              <button type="button" class="user-btn" :aria-expanded="menuOpen" aria-haspopup="menu" @click="toggleMenu">
                <span class="user-avatar" aria-hidden="true">{{ user.nickname.slice(-1) }}</span>
                <span class="user-name">{{ user.nickname }}</span>
                <svg class="ic" width="14" height="14" aria-hidden="true"><use href="#i-chev-down" /></svg>
              </button>
              <div v-if="menuOpen" class="user-menu" role="menu">
                <p class="user-menu-phone">{{ maskedPhone() }}</p>
                <button type="button" class="user-menu-item" role="menuitem" @click="onLogout">退出登录</button>
              </div>
            </div>
          </template>
          <button v-else type="button" class="login-btn" @click="openLogin">登录</button>
        </div>
      </div>
    </div>
  </header>
</template>
