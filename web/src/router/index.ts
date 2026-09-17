import { createRouter, createWebHashHistory } from 'vue-router'
import HomePage from '../pages/HomePage.vue'
import SkillsPage from '../pages/SkillsPage.vue'
import ExperiencePage from '../pages/ExperiencePage.vue'
import UsePage from '../pages/UsePage.vue'
import DetailPage from '../pages/DetailPage.vue'
import GuidePage from '../pages/GuidePage.vue'
import MissingPage from '../pages/MissingPage.vue'
import { bySlug } from '../data/skills'

/* 兼容旧地址：/catalog → /skills */
const routes = [
  { path: '/', name: 'home', component: HomePage, meta: { title: 'Skill搭子', nav: '' } },
  { path: '/skills', name: 'skills', component: SkillsPage, meta: { title: 'SKILL 广场 · Skill搭子', nav: 'skills' } },
  { path: '/catalog', redirect: '/skills' },
  { path: '/skill/:slug', name: 'detail', component: DetailPage, meta: { nav: 'skills' } },
  { path: '/experience', name: 'experience', component: ExperiencePage, meta: { title: '在线对话 · Skill搭子', nav: 'experience' } },
  { path: '/use/:slug?', name: 'use', component: UsePage, meta: { nav: 'use' } },
  { path: '/guide', name: 'guide', component: GuidePage, meta: { title: '使用指南 · Skill搭子', nav: 'guide' } },
  { path: '/:pathMatch(.*)*', name: 'missing', component: MissingPage, meta: { title: '没有这个地址 · Skill搭子', nav: 'skills' } },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach(to => {
  if (to.name === 'detail') {
    const slug = typeof to.params.slug === 'string' ? to.params.slug : ''
    const skill = bySlug.get(slug)
    document.title = (skill ? skill.name + ' · ' : '没有这个 SKILL · ') + 'Skill搭子'
  } else if (to.name === 'use') {
    const slug = typeof to.params.slug === 'string' ? to.params.slug : ''
    const skill = bySlug.get(slug)
    document.title = (skill ? '在线运行 · ' + skill.name : '在线运行') + ' · Skill搭子'
  } else if (to.meta.title) {
    document.title = to.meta.title as string
  }
})

export default router
