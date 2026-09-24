<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AGENTS, AUDIENCES, CATEGORIES, SKILLS, bySlug, type Skill } from '../data/skills'
import SkillCard from '../components/SkillCard.vue'

/* 列表 = 24 个智能体：已上线的渲染真实 SKILL 卡，未上线的置灰占位 */
interface Entry {
  kind: 'skill' | 'ghost'
  code: string
  name: string
  categoryId: string
  audiences: string[]
  skill?: Skill
}

const entries: Entry[] = AGENTS
  .map((a): Entry => {
    const skill = a.skillSlug ? bySlug.get(a.skillSlug) : undefined
    return {
      kind: skill ? 'skill' : 'ghost',
      code: a.code,
      name: skill ? skill.name : a.name,
      categoryId: a.categoryId,
      audiences: a.audiences,
      skill,
    }
  })
  /* 已上线的排前面，未上线置灰的排后面，各自按编号升序 */
  .sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'skill' ? -1 : 1
    return a.code.localeCompare(b.code)
  })

const route = useRoute()
const router = useRouter()

const q = ref(typeof route.query.q === 'string' ? route.query.q : '')
const role = ref(typeof route.query.role === 'string' ? route.query.role : 'all')
const category = ref(typeof route.query.category === 'string' ? route.query.category : 'all')

const searchInput = ref<HTMLInputElement | null>(null)
let hashTimer: ReturnType<typeof setTimeout> | undefined

/* 从 URL 进入（含返回键）时同步本地状态 */
watch(() => route.fullPath, () => {
  if (route.name !== 'skills') return
  const nextQ = typeof route.query.q === 'string' ? route.query.q : ''
  const nextRole = typeof route.query.role === 'string' ? route.query.role : 'all'
  const nextCategory = typeof route.query.category === 'string' ? route.query.category : 'all'
  if (nextQ !== q.value) q.value = nextQ
  role.value = nextRole
  category.value = nextCategory
})

function matches(entry: Entry, except: 'q' | 'role' | 'category' | null, r: string, c: string, needle: string) {
  if (except !== 'q' && needle) {
    const hay = [entry.name, entry.code, entry.categoryId].join(' ').toLowerCase()
    if (!hay.includes(needle)) return false
  }
  if (except !== 'role' && r !== 'all' && !entry.audiences.includes(r)) return false
  if (except !== 'category' && c !== 'all' && entry.categoryId !== c) return false
  return true
}

const needle = computed(() => q.value.trim().toLowerCase())
const isFiltered = computed(() => Boolean(q.value.trim()) || role.value !== 'all' || category.value !== 'all')

const visible = computed(() =>
  entries.filter(e => matches(e, null, role.value, category.value, needle.value)),
)

const roleItems = computed(() => [{ id: 'all', name: '全部' }, ...AUDIENCES].map(item => ({
  ...item,
  count: entries.filter(e => matches(e, 'role', role.value, category.value, needle.value) && (item.id === 'all' || e.audiences.includes(item.id))).length,
})))

const catItems = computed(() => [{ id: 'all', name: '全部' }, ...CATEGORIES].map(item => ({
  ...item,
  count: entries.filter(e => matches(e, 'category', role.value, category.value, needle.value) && (item.id === 'all' || e.categoryId === item.id)).length,
})))

function commit() {
  const query: Record<string, string> = {}
  if (q.value.trim()) query.q = q.value
  if (role.value !== 'all') query.role = role.value
  if (category.value !== 'all') query.category = category.value
  router.replace({ path: '/skills', query })
}

function setRole(id: string) { role.value = id; commit() }
function setCategory(id: string) { category.value = id; commit() }

function onSearchInput() {
  clearTimeout(hashTimer)
  hashTimer = setTimeout(commit, 200)
}

function clearFilters(focusSearch: boolean) {
  q.value = ''
  role.value = 'all'
  category.value = 'all'
  commit()
  if (focusSearch) searchInput.value?.focus()
}
</script>

<template>
  <section class="page page-skills" id="page-skills">
    <div class="wrap">
      <div class="section-head" v-reveal>
        <h2>发现值得使用的 SKILL</h2>
        <p>按角色或业务分类收窄，进详情复制安装提示词。</p>
      </div>

      <div class="filters" v-reveal="70">
        <div class="facet" id="facet-role">
          <span class="facet-label" id="lbl-role">适用角色</span>
          <div class="chips" role="group" aria-labelledby="lbl-role">
            <button
              v-for="item in roleItems"
              :key="item.id"
              type="button"
              class="chip"
              :class="{ 'is-on': item.id === role, 'is-empty': item.count === 0 && item.id !== role }"
              :aria-pressed="item.id === role"
              @click="setRole(item.id)"
            >{{ item.name }}<span class="n">{{ item.count }}</span></button>
          </div>
        </div>
        <div class="facet" id="facet-category">
          <span class="facet-label" id="lbl-category">业务分类</span>
          <div class="chips" role="group" aria-labelledby="lbl-category">
            <button
              v-for="item in catItems"
              :key="item.id"
              type="button"
              class="chip"
              :class="{ 'is-on': item.id === category, 'is-empty': item.count === 0 && item.id !== category }"
              :aria-pressed="item.id === category"
              @click="setCategory(item.id)"
            >{{ item.name }}<span class="n">{{ item.count }}</span></button>
          </div>
        </div>
        <div class="facet" id="facet-search">
          <span class="facet-label" id="lbl-search">搜索</span>
          <div class="search" id="search-box">
            <svg class="ic" width="17" height="17" aria-hidden="true"><use href="#i-search" /></svg>
            <input ref="searchInput" v-model="q" @input="onSearchInput" type="search" autocomplete="off" aria-labelledby="lbl-search" placeholder="名称、用途或关键词">
          </div>
        </div>
      </div>

      <div class="list-status" role="status" aria-live="polite" v-reveal="140">
        <span id="list-status">
          <template v-if="isFiltered">筛选出 <strong>{{ visible.length }}</strong> 个 · 全部 <strong>{{ entries.length }}</strong> 个</template>
          <template v-else>共 <strong>{{ entries.length }}</strong> 个智能体 · <strong>{{ SKILLS.length }}</strong> 个已上线 SKILL</template>
        </span>
        <button type="button" class="text-btn" :hidden="!isFiltered" @click="clearFilters(true)">清除筛选</button>
      </div>

      <div class="grid" id="skill-grid" :hidden="visible.length === 0">
        <template v-for="entry in visible" :key="entry.code">
          <SkillCard v-if="entry.skill" v-reveal="Math.min(entries.indexOf(entry), 8) * 40" :skill="entry.skill" />
          <article v-else class="card is-ghost" v-reveal="Math.min(entries.indexOf(entry), 8) * 40">
            <div class="card-top">
              <span class="card-pic is-ghost-pic">{{ entry.code }}</span>
              <div class="card-head">
                <h2 class="card-name">{{ entry.name }}</h2>
                <p class="card-id">{{ entry.code }}</p>
              </div>
            </div>
            <span class="card-cat is-ghost-cat">{{ (CATEGORIES.find(c => c.id === entry.categoryId) || { name: entry.categoryId }).name }}</span>
            <p class="card-summary">智能体已在规划中，上线后即可安装使用。</p>
            <div class="card-foot">
              <span class="ghost-soon">即将上线</span>
            </div>
          </article>
        </template>
      </div>
    </div>
  </section>
</template>
